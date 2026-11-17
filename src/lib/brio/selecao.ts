/**
 * Seleção de perguntas com ANTIRREPETIÇÃO (§3.6) — PURO, determinístico.
 *
 * Regras:
 *   • Não repetir pergunta na mesma partida.
 *   • Evitar repetição recente do MESMO jogador (janela de histórico).
 *   • Equilibrar a distribuição dos assuntos.
 *   • Controlar a frequência de uso de cada questão (quanto menos usada,
 *     mais provável).
 *
 * Determinístico por semente (FNV-1a + mulberry32 + Fisher-Yates): a mesma
 * partida re-deriva a MESMA seleção e a MESMA ordem de alternativas após F5,
 * e partidas diferentes variam. Nunca usar Math.random no caminho da partida.
 */

import type { Modalidade, Dificuldade } from "./categorias";
import { ordemDificuldade } from "./categorias";
import { dificuldadeDaRodada } from "./duelo";
import { DUELO, LETRAS, type Letra, type PerguntaPublica } from "./types";

/** Hash FNV-1a de 32 bits — base de todo o determinismo do módulo. */
export function fnv1a(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** PRNG mulberry32 — pequeno, rápido e reprodutível. */
export function mulberry32(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** PRNG derivado de uma chave textual (ex.: id da partida + rodada). */
export function rngDe(chave: string): () => number {
  return mulberry32(fnv1a(chave));
}

/** Fisher-Yates determinístico — devolve uma cópia, nunca muta a entrada. */
export function embaralhar<T>(itens: readonly T[], rng: () => number): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = copia[i];
    const b = copia[j];
    if (a === undefined || b === undefined) continue;
    copia[i] = b;
    copia[j] = a;
  }
  return copia;
}

/**
 * Embaralha as alternativas mantendo o id estável (letra + texto).
 * A resposta é gravada pela LETRA ORIGINAL canônica do banco — assim o
 * gabarito nunca depende da posição sorteada.
 */
export function embaralharAlternativas(
  alternativas: readonly { letra: Letra; texto: string }[],
  rng: () => number,
): Array<{ letra: Letra; texto: string }> {
  const ordem = embaralhar(alternativas, rng);
  return ordem.map((alt, idx) => ({ letra: LETRAS[idx] ?? "A", texto: alt.texto }));
}

/** Pergunta crua vinda do banco/acervo (com gabarito, uso interno). */
export interface PerguntaBruta extends Omit<PerguntaPublica, "alternativas"> {
  alternativas: Array<{ letra: Letra; texto: string }>;
  /** Letra correta no acervo — NUNCA enviada ao cliente antes da revelação. */
  letraCorreta: Letra;
  explicacao: string;
  referencia: string | null;
  /** Quantas vezes já foi usada no universo (controle de frequência). */
  usos: number;
}

export interface FiltroSelecao {
  modalidade: Modalidade;
  areaSlug: string | null;
  subcategoriaSlug: string | null;
}

/** A pergunta passa pelo filtro da modalidade escolhida? */
export function passaFiltro(p: PerguntaBruta, f: FiltroSelecao): boolean {
  switch (f.modalidade) {
    case "subcategoria":
      return f.subcategoriaSlug != null && p.subcategoriaSlug === f.subcategoriaSlug;
    case "categoria":
      return f.areaSlug != null && p.areaSlug === f.areaSlug;
    case "geral":
      return p.subcategoriaSlug === "conhecimentos-gerais" || p.dificuldade === "facil";
    case "multidisciplinar":
    case "aleatorio":
      return true;
    default:
      return true;
  }
}

export interface OpcoesSelecao {
  total: number;
  /** Ids usados recentemente pelo jogador (janela de histórico). */
  historico: readonly string[];
  /** Chave determinística da partida (ex.: id da partida). */
  semente: string;
  /** Distribuição-alvo por dificuldade; se ausente, usa progressão 1..5. */
  ordemFixa?: boolean;
}

export interface ResultadoSelecao {
  perguntas: PerguntaBruta[];
  /** Quantas perguntas foram descartadas por repetição recente. */
  descartadasPorHistorico: number;
  /** true quando o acervo não cobriu o pedido (o chamador avisa o jogador). */
  acervoInsuficiente: boolean;
}

/**
 * Seleciona `total` perguntas com dificuldade progressiva e antirrepetição.
 *
 * Estratégia: para cada rodada, calcula a ordem de dificuldade alvo, monta o
 * grupo elegível (filtro da modalidade + dificuldade alvo), REMOVE o que já
 * foi usado nesta partida, penaliza o que está no histórico recente do
 * jogador, e sorteia ponderando por `1 / (1 + usos)`. Se o grupo alvo está
 * vazio, relaxa para as dificuldades vizinhas — nunca devolve menos do que
 * pode.
 */
export function selecionarPerguntas(
  acervo: readonly PerguntaBruta[],
  filtro: FiltroSelecao,
  opcoes: OpcoesSelecao,
): ResultadoSelecao {
  const elegiveis = acervo.filter((p) => passaFiltro(p, filtro));
  const rng = rngDe(`selecao:${opcoes.semente}:${filtro.modalidade}:${filtro.areaSlug ?? "-"}:${filtro.subcategoriaSlug ?? "-"}`);

  const historico = new Set(opcoes.historico);
  const usadosNaPartida = new Set<string>();
  const escolhidas: PerguntaBruta[] = [];
  let descartadasPorHistorico = 0;

  for (let rodada = 1; rodada <= opcoes.total; rodada += 1) {
    const ordemAlvo = dificuldadeDaRodada(rodada, opcoes.total);

    // Grupos por proximidade de dificuldade: alvo, depois vizinhos.
    const porOrdem = new Map<number, PerguntaBruta[]>();
    for (const p of elegiveis) {
      if (usadosNaPartida.has(p.id)) continue;
      const o = ordemDificuldade(p.dificuldade);
      const lista = porOrdem.get(o);
      if (lista) lista.push(p);
      else porOrdem.set(o, [p]);
    }

    const ordenadas = [...porOrdem.keys()].sort(
      (a, b) => Math.abs(a - ordemAlvo) - Math.abs(b - ordemAlvo) || a - b,
    );

    let escolhida: PerguntaBruta | null = null;
    for (const ordem of ordenadas) {
      const grupo = porOrdem.get(ordem) ?? [];
      if (grupo.length === 0) continue;

      // Antirrepetição recente: só descarta se houver alternativa fora do
      // histórico — caso contrário o acervo acabaria antes do fim da partida.
      const foraDoHistorico = grupo.filter((p) => !historico.has(p.id));
      const candidatos = foraDoHistorico.length > 0 ? foraDoHistorico : grupo;
      if (foraDoHistorico.length === 0) descartadasPorHistorico += grupo.length;

      escolhida = sortearPonderado(candidatos, rng);
      break;
    }

    if (!escolhida) break;
    usadosNaPartida.add(escolhida.id);
    escolhidas.push(escolhida);
  }

  return {
    perguntas: escolhidas,
    descartadasPorHistorico,
    acervoInsuficiente: escolhidas.length < opcoes.total,
  };
}

/** Sorteio ponderado por raridade: menos usado ⇒ mais provável. */
function sortearPonderado(candidatos: PerguntaBruta[], rng: () => number): PerguntaBruta {
  const pesos = candidatos.map((p) => 1 / (1 + Math.max(0, p.usos)));
  const total = pesos.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    const idx = Math.min(candidatos.length - 1, Math.floor(rng() * candidatos.length));
    return candidatos[Math.max(0, idx)] ?? candidatos[0]!;
  }
  let alvo = rng() * total;
  for (let i = 0; i < candidatos.length; i += 1) {
    alvo -= pesos[i] ?? 0;
    if (alvo <= 0) return candidatos[i]!;
  }
  return candidatos[candidatos.length - 1]!;
}

/**
 * Assinatura canônica de uma pergunta para detecção de duplicatas
 * (idênticas ou semanticamente muito próximas — §3.6).
 */
export function assinaturaPergunta(enunciado: string, alternativas: readonly { texto: string }[]): string {
  const limpar = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const alts = alternativas
    .map((a) => limpar(a.texto))
    .sort()
    .join("|");
  return `${limpar(enunciado)}##${alts}`;
}

/** Índice de similaridade de Jaccard entre duas assinaturas (0..1). */
export function similaridade(a: string, b: string): number {
  const conjunto = (s: string) => new Set(s.split(/[\s|#]+/).filter(Boolean));
  const sa = conjunto(a);
  const sb = conjunto(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let intersecao = 0;
  for (const t of sa) if (sb.has(t)) intersecao += 1;
  const uniao = sa.size + sb.size - intersecao;
  return uniao === 0 ? 0 : intersecao / uniao;
}

export interface DuplicataEncontrada {
  id: string;
  /** Id da pergunta já existente com que colide. */
  colideCom: string;
  similaridade: number;
  tipo: "identica" | "semelhante";
}

/** Limiar de similaridade que caracteriza quase-duplicata. */
export const LIMIAR_DUPLICATA = 0.9;

/** Detecta duplicatas no acervo (para a importação em lote). */
export function detectarDuplicatas(acervo: readonly PerguntaBruta[]): DuplicataEncontrada[] {
  const assinaturas = acervo.map((p) => ({
    id: p.id,
    assinatura: assinaturaPergunta(p.enunciado, p.alternativas),
  }));
  const achadas: DuplicataEncontrada[] = [];
  const exatas = new Map<string, string>();

  for (const { id, assinatura } of assinaturas) {
    const jaVisto = exatas.get(assinatura);
    if (jaVisto) {
      achadas.push({ id, colideCom: jaVisto, similaridade: 1, tipo: "identica" });
      continue;
    }
    exatas.set(assinatura, id);
  }

  // Comparação semântica: O(n²) é aceitável na importação em lote (não na UI).
  for (let i = 0; i < assinaturas.length; i += 1) {
    const a = assinaturas[i];
    if (!a) continue;
    if (achadas.some((d) => d.id === a.id)) continue;
    for (let j = i + 1; j < assinaturas.length; j += 1) {
      const b = assinaturas[j];
      if (!b) continue;
      if (achadas.some((d) => d.id === b.id)) continue;
      const s = similaridade(a.assinatura, b.assinatura);
      if (s >= LIMIAR_DUPLICATA) {
        achadas.push({ id: b.id, colideCom: a.id, similaridade: s, tipo: "semelhante" });
      }
    }
  }

  return achadas;
}

/** Garante o formato da pergunta pública entregue à arena. */
export function paraPerguntaPublica(
  p: PerguntaBruta,
  rodada: number,
  semente: string,
): PerguntaPublica {
  const rng = rngDe(`alts:${semente}:${rodada}:${p.id}`);
  return {
    id: p.id,
    areaSlug: p.areaSlug,
    subcategoriaSlug: p.subcategoriaSlug,
    dificuldade: p.dificuldade,
    ordem: dificuldadeDaRodada(rodada, DUELO.PERGUNTAS_POR_PARTIDA),
    enunciado: p.enunciado,
    alternativas: embaralharAlternativas(p.alternativas, rng),
  };
}
