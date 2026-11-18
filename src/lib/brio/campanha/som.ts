/**
 * SOM da campanha do Guerra de Brio — digitação ao vivo e ambiência.
 *
 * WebAudio puro (sem assets), na MESMA linha da `lib/notificacao.ts`: nenhum
 * AudioContext espalhado pelos componentes, tudo aqui. Falha em silêncio
 * quando o navegador bloqueia autoplay — o áudio só existe após interação.
 *
 * O teclado é um clique curto de ruído filtrado (não um beep): soa como tecla
 * mecânica, que é o que dá a sensação de "alguém está escrevendo isto agora".
 */
import { tocarSom, type CategoriaNotificacao } from "@/lib/notificacao";

let ctx: AudioContext | null = null;
/** Buffer de ruído reaproveitado — gerar por tecla seria caro. */
let ruido: AudioBuffer | null = null;

function contexto(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function bufferRuido(audio: AudioContext): AudioBuffer {
  if (ruido && ruido.sampleRate === audio.sampleRate) return ruido;
  const duracao = 0.2;
  const n = Math.floor(audio.sampleRate * duracao);
  const buf = audio.createBuffer(1, n, audio.sampleRate);
  const dados = buf.getChannelData(0);
  for (let i = 0; i < n; i += 1) dados[i] = Math.random() * 2 - 1;
  ruido = buf;
  return buf;
}

export type TipoTecla = "normal" | "espaco" | "enter" | "apagar";

/**
 * Um clique de tecla. `forca` (0..1) varia o volume — teclas diferentes soam
 * diferentes, o que evita o efeito "metralhadora idêntica".
 */
export function tocarTecla(tipo: TipoTecla = "normal", forca = 1): void {
  const audio = contexto();
  if (!audio) return;
  try {
    const t = audio.currentTime;
    const buf = bufferRuido(audio);

    const fonte = audio.createBufferSource();
    fonte.buffer = buf;

    // Filtro passa-banda: dá o "clac" curto da tecla em vez de um chiado.
    const filtro = audio.createBiquadFilter();
    filtro.type = "bandpass";
    const base =
      tipo === "espaco" ? 420 : tipo === "enter" ? 300 : tipo === "apagar" ? 620 : 900 + Math.random() * 500;
    filtro.frequency.value = base;
    filtro.Q.value = tipo === "enter" ? 1.2 : 2.4;

    const gain = audio.createGain();
    const vol = (tipo === "espaco" || tipo === "enter" ? 0.075 : 0.055) * forca;
    const dur = tipo === "enter" ? 0.09 : 0.035;

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    fonte.connect(filtro);
    filtro.connect(gain);
    gain.connect(audio.destination);
    fonte.start(t);
    fonte.stop(t + dur + 0.02);
  } catch {
    /* sem áudio, sem crash */
  }
}

/** Notificação da Cidadela (reusa a central de sons — não duplica padrões). */
export function tocarEvento(categoria: CategoriaNotificacao): void {
  tocarSom(categoria);
}

// --------------------------------------------------------------- ambiência

let ambiente: { osc: OscillatorNode[]; gain: GainNode; lfo: OscillatorNode } | null = null;

/**
 * Drone grave e contínuo (duas ondas quase afinadas) — a "sala fria" por trás
 * da narrativa. Intensidade 0..1 controla o volume; 0 desliga.
 */
export function ajustarAmbiencia(intensidade: number): void {
  const audio = contexto();
  if (!audio) return;
  const alvo = Math.max(0, Math.min(1, intensidade));

  try {
    if (alvo <= 0) {
      if (!ambiente) return;
      const { osc, gain, lfo } = ambiente;
      const t = audio.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      for (const o of osc) o.stop(t + 0.7);
      lfo.stop(t + 0.7);
      ambiente = null;
      return;
    }

    if (ambiente) {
      const t = audio.currentTime;
      ambiente.gain.gain.cancelScheduledValues(t);
      ambiente.gain.gain.setValueAtTime(ambiente.gain.gain.value, t);
      ambiente.gain.gain.linearRampToValueAtTime(0.02 + alvo * 0.05, t + 0.8);
      return;
    }

    const gain = audio.createGain();
    gain.gain.value = 0.0001;
    gain.connect(audio.destination);

    const filtro = audio.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = 220;
    filtro.connect(gain);

    // Duas frequências muito próximas: o batimento lento é o que dá o
    // desconforto. Não é acorde — é intervalo.
    const osc: OscillatorNode[] = [];
    for (const f of [55, 55.7]) {
      const o = audio.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(filtro);
      o.start();
      osc.push(o);
    }

    // LFO lentíssimo mexendo no filtro: a sala "respira".
    const lfo = audio.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = audio.createGain();
    lfoGain.gain.value = 40;
    lfo.connect(lfoGain);
    lfoGain.connect(filtro.frequency);
    lfo.start();

    const t = audio.currentTime;
    gain.gain.linearRampToValueAtTime(0.02 + alvo * 0.05, t + 1.2);
    ambiente = { osc, gain, lfo };
  } catch {
    /* sem áudio, sem crash */
  }
}

export function pararAmbiencia(): void {
  ajustarAmbiencia(0);
}

/**
 * Impacto grave e curto — usado nas viradas da narrativa (revelação, veredito).
 * Diferente do drone: tem ataque e decaimento, é um evento, não um ambiente.
 */
export function tocarImpacto(): void {
  const audio = contexto();
  if (!audio) return;
  try {
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.7);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.9);
  } catch {
    /* sem áudio, sem crash */
  }
}
