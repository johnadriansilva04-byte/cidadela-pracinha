/**
 * Motor de partida LOCAL do GUERRA DE BRIO (fallback determinístico).
 *
 * Existe para quando a migration `guerra_de_brio.sql` ainda não foi aplicada:
 * o jogo continua jogável e HONESTO — as mesmas regras, o mesmo acervo e o
 * mesmo rigor de sigilo (o gabarito não fica exposto na pergunta enviada à
 * arena). O que muda é a autoridade do relógio (passa a ser o cliente) e a
 * persistência (não há) — a UI avisa isso ao jogador.
 *
 * PURO: sem I/O. Testável com jiti.
 */
import { ACERVO_BRIO_EQUILIBRADO } from "./acervo";
import { apurarRodada, chanceAcertoBot, letraErrada, vencedorDoPlacar } from "./duelo";
import { rngDe, selecionarPerguntas, type PerguntaBruta } from "./selecao";
import { DUELO, LETRAS, type Letra, type PerguntaPublica } from "./types";

/** Rodada do motor local (mesma forma da versão servidor). */
export interface RodadaLocal {
  numero: number;
  pergunta_id: string;
  enunciado: string;
  area_slug: string;
  subcategoria_slug: string;
  dificuldade: string;
  alternativas: Array<{ letra: Letra; texto: string }>;
  revelada: boolean;
  letra_correta: Letra | null;
  explicacao: string | null;
  referencia: string | null;
}

export interface RespostaLocal {
  rodada: number;
  jogador_id: string;
  letra: Letra | null;
  tempo_ms: number;
  acertou: boolean | null;
  pontos: number;
}

export interface PartidaLocal {
  id: string;
  jogador_1_id: string;
  jogador_2_id: string | null;
  bot_nivel: number | null;
  modalidade: string;
  area_slug: string | null;
  subcategoria_slug: string | null;
  status: "em_andamento" | "finalizado";
  rodada_atual: number;
  total_perguntas: number;
  segundos_por_pergunta: number;
  placar_1: number;
  placar_2: number;
  acertos_1: number;
  acertos_2: number;
  desempate: boolean;
  vencedor_id: string | null;
  empate: boolean;
  rodada_liberada_em: number;
  rodadas: RodadaLocal[];
  respostas: RespostaLocal[];
  /** Id sintético do adversário virtual nesta partida. */
  bot_id: string | null;
}

const BOT_SUFIXO = ":bot";

/** Cria uma partida local com o acervo do código. */
export function criarPartidaLocal(opcoes: {
  userId: string;
  modalidade: string;
  areaSlug?: string | null;
  subcategoriaSlug?: string | null;
  botNivel?: number | null;
  total?: number;
  segundos?: number;
  historico?: string[];
  semente?: string;
}): PartidaLocal {
  const total = opcoes.total ?? DUELO.PERGUNTAS_POR_PARTIDA;
  const semente = opcoes.semente ?? `${opcoes.userId}:${Date.now()}`;
  const selecao = selecionarPerguntas(
    ACERVO_BRIO_EQUILIBRADO,
    {
      modalidade: opcoes.modalidade as never,
      areaSlug: opcoes.areaSlug ?? null,
      subcategoriaSlug: opcoes.subcategoriaSlug ?? null,
    },
    { total, historico: opcoes.historico ?? [], semente },
  );

  const rodadas: RodadaLocal[] = selecao.perguntas.map((p, idx) => {
    const rodada = idx + 1;
    const rng = rngDe(`local:${semente}:${rodada}:${p.id}`);
    const ordem = embaralharLocal(p.alternativas, rng);
    const textoCorreto = p.alternativas.find((a) => a.letra === p.letraCorreta)?.texto;
    const letraCorreta =
      ordem.find((a) => a.texto === textoCorreto)?.letra ?? p.letraCorreta;
    return {
      numero: rodada,
      pergunta_id: p.id,
      enunciado: p.enunciado,
      area_slug: p.areaSlug,
      subcategoria_slug: p.subcategoriaSlug,
      dificuldade: p.dificuldade,
      alternativas: ordem,
      // O gabarito fica AQUI (local) e a UI só o exibe na revelação.
      revelada: false,
      letra_correta: letraCorreta,
      explicacao: p.explicacao,
      referencia: p.referencia,
    };
  });

  const botNivel = opcoes.botNivel ?? null;
  return {
    id: `local-${semente}`,
    jogador_1_id: opcoes.userId,
    jogador_2_id: null,
    bot_nivel: botNivel,
    modalidade: opcoes.modalidade,
    area_slug: opcoes.areaSlug ?? null,
    subcategoria_slug: opcoes.subcategoriaSlug ?? null,
    status: "em_andamento",
    rodada_atual: 1,
    total_perguntas: rodadas.length,
    segundos_por_pergunta: opcoes.segundos ?? DUELO.SEGUNDOS_POR_PERGUNTA,
    placar_1: 0,
    placar_2: 0,
    acertos_1: 0,
    acertos_2: 0,
    desempate: false,
    vencedor_id: null,
    empate: false,
    rodada_liberada_em: Date.now(),
    rodadas,
    respostas: [],
    bot_id: botNivel != null ? `${opcoes.userId}${BOT_SUFIXO}` : null,
  };
}

function embaralharLocal(
  itens: readonly { letra: Letra; texto: string }[],
  rng: () => number,
): Array<{ letra: Letra; texto: string }> {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = copia[i];
    const b = copia[j];
    if (a === undefined || b === undefined) continue;
    copia[i] = b;
    copia[j] = a;
  }
  return copia.map((alt, idx) => ({ letra: LETRAS[idx] ?? "A", texto: alt.texto }));
}

/** Pergunta pública da rodada corrente (SEM o gabarito). */
export function perguntaAtualLocal(p: PartidaLocal): PerguntaPublica | null {
  const r = p.rodadas[p.rodada_atual - 1];
  if (!r) return null;
  return {
    id: r.pergunta_id,
    areaSlug: r.area_slug,
    subcategoriaSlug: r.subcategoria_slug,
    dificuldade: r.dificuldade as never,
    ordem: p.rodada_atual,
    enunciado: r.enunciado,
    alternativas: r.alternativas,
  };
}

/**
 * Registra a resposta do humano e, em seguida, a do adversário virtual.
 *
 * O bot responde AQUI (e não no fechamento) para que a rodada possa ser
 * apurada assim que ambos tiverem marcado — do contrário o jogo ficaria
 * esperando o cronômetro inteiro, já que o fechamento só acontece quando os
 * dois responderam. Imutável: uma resposta por jogador por rodada.
 */
export function responderLocal(p: PartidaLocal, letra: Letra, tempoMs: number): PartidaLocal {
  const rodada = p.rodadas[p.rodada_atual - 1];
  if (!rodada || rodada.revelada) return p;
  if (p.respostas.some((r) => r.rodada === rodada.numero && r.jogador_id === p.jogador_1_id)) return p;

  const novas: RespostaLocal[] = [
    {
      rodada: rodada.numero,
      jogador_id: p.jogador_1_id,
      letra,
      tempo_ms: Math.min(tempoMs, p.segundos_por_pergunta * 1000),
      acertou: null,
      pontos: 0,
    },
  ];

  if (p.bot_id && !p.respostas.some((r) => r.rodada === rodada.numero && r.jogador_id === p.bot_id)) {
    const rng = rngDe(`bot:${p.id}:${rodada.numero}`);
    const acerta = chanceAcertoBot(p.bot_nivel ?? 2, rodada.dificuldade as never, rng());
    novas.push({
      rodada: rodada.numero,
      jogador_id: p.bot_id,
      letra: acerta ? (rodada.letra_correta ?? "A") : letraErrada(rodada.letra_correta ?? "A", rng()),
      // O bot "pensa" entre 0,9s e 1,6s — nunca instantâneo.
      tempo_ms: Math.round(900 + rng() * 700),
      acertou: null,
      pontos: 0,
    });
  }

  return { ...p, respostas: [...p.respostas, ...novas] };
}

/**
 * Fecha a rodada: o bot responde (se for partida contra o virtual), apura os
 * pontos e avança — ou finaliza. Mesmas regras do servidor.
 */
export function fecharRodadaLocal(p: PartidaLocal, tempoDecorridoMs: number): PartidaLocal {
  const rodada = p.rodadas[p.rodada_atual - 1];
  if (!rodada) return p;
  // Idempotência: uma rodada revelada NUNCA é reapurada (nem repontuada).
  if (rodada.revelada) return p;

  const jogadores = [p.jogador_1_id, p.bot_id].filter((x): x is string => x != null);
  const respostas = [...p.respostas];

  // O tempo acabou? Então a rodada fecha mesmo sem resposta do humano.
  const estourou = tempoDecorridoMs > p.segundos_por_pergunta * 1000;

  const apurou = apurarRodada(
    jogadores,
    Object.fromEntries(
      jogadores.map((j) => [j, respostas.find((r) => r.rodada === rodada.numero && r.jogador_id === j)?.letra ?? null]),
    ) as Record<string, Letra | null>,
    Object.fromEntries(
      jogadores.map((j) => [j, respostas.find((r) => r.rodada === rodada.numero && r.jogador_id === j)?.tempo_ms ?? null]),
    ) as Record<string, number | null>,
    rodada.letra_correta ?? "A",
  );

  const atualizadas = respostas.map((r) => {
    if (r.rodada !== rodada.numero) return r;
    return { ...r, acertou: apurou.acertos[r.jogador_id] ?? false, pontos: apurou.pontos[r.jogador_id] ?? 0 };
  });

  const soma = (id: string, campo: "pontos" | "acertos") =>
    atualizadas
      .filter((r) => r.jogador_id === id)
      .reduce((acc, r) => acc + (campo === "pontos" ? r.pontos : r.acertou ? 1 : 0), 0);

  const p1 = soma(p.jogador_1_id, "pontos");
  const p2 = p.bot_id ? soma(p.bot_id, "pontos") : 0;
  const a1 = soma(p.jogador_1_id, "acertos");
  const a2 = p.bot_id ? soma(p.bot_id, "acertos") : 0;

  const rodadas = p.rodadas.map((r) =>
    r.numero === rodada.numero
      ? {
          ...r,
          revelada: true,
          letra_correta: r.letra_correta,
          explicacao: r.explicacao,
          referencia: r.referencia,
        }
      : r,
  );

  const base: PartidaLocal = {
    ...p,
    respostas: atualizadas,
    rodadas,
    placar_1: p1,
    placar_2: p2,
    acertos_1: a1,
    acertos_2: a2,
  };

  const ehUltima = p.rodada_atual >= p.total_perguntas;

  if (ehUltima) {
    const venc = vencedorDoPlacar(jogadores, { [p.jogador_1_id]: p1, ...(p.bot_id ? { [p.bot_id]: p2 } : {}) });
    if (!venc.empate) {
      return {
        ...base,
        status: "finalizado",
        vencedor_id: venc.vencedorId,
        empate: false,
      };
    }
    // Empate: abre a morte súbita (uma pergunta extra).
    const extra = rodadaExtraLocal(p, rodadas.length + 1);
    if (!extra) {
      return { ...base, status: "finalizado", empate: true, vencedor_id: null };
    }
    return {
      ...base,
      desempate: true,
      rodada_atual: p.rodada_atual + 1,
      total_perguntas: p.total_perguntas + 1,
      rodadas: [...rodadas, extra],
      rodada_liberada_em: Date.now(),
    };
  }

  if (estourou) {
    // Sem mais rodadas? (defensivo — o fluxo normal avança normalmente.)
    return { ...base, rodada_atual: p.rodada_atual + 1, rodada_liberada_em: Date.now() };
  }

  return { ...base, rodada_atual: p.rodada_atual + 1, rodada_liberada_em: Date.now() };
}

/** Sorteia uma pergunta inédita para a morte súbita. */
function rodadaExtraLocal(p: PartidaLocal, numero: number): RodadaLocal | null {
  const usadas = new Set(p.rodadas.map((r) => r.pergunta_id));
  const rng = rngDe(`desempate:${p.id}:${numero}`);
  const candidatos = ACERVO_BRIO_EQUILIBRADO.filter((q) => !usadas.has(q.id));
  if (candidatos.length === 0) return null;
  const idx = Math.min(candidatos.length - 1, Math.floor(rng() * candidatos.length));
  const p2: PerguntaBruta | undefined = candidatos[idx];
  if (!p2) return null;
  const ordem = embaralharLocal(p2.alternativas, rng);
  const textoCorreto = p2.alternativas.find((a) => a.letra === p2.letraCorreta)?.texto;
  return {
    numero,
    pergunta_id: p2.id,
    enunciado: p2.enunciado,
    area_slug: p2.areaSlug,
    subcategoria_slug: p2.subcategoriaSlug,
    dificuldade: p2.dificuldade,
    alternativas: ordem,
    revelada: false,
    letra_correta: ordem.find((a) => a.texto === textoCorreto)?.letra ?? p2.letraCorreta,
    explicacao: p2.explicacao,
    referencia: p2.referencia,
  };
}

/** Finaliza a morte súbita quando um só acerta na rodada extra. */
export function resolverDesempateLocal(p: PartidaLocal): PartidaLocal {
  if (!p.desempate || p.status === "finalizado") return p;
  const jogadores = [p.jogador_1_id, p.bot_id].filter((x): x is string => x != null);
  const rodada = p.rodadas[p.rodada_atual - 1];
  if (!rodada) return p;
  const acertaram = jogadores.filter((j) =>
    p.respostas.some((r) => r.rodada === rodada.numero && r.jogador_id === j && r.acertou),
  );
  if (acertaram.length === 1) {
    return { ...p, status: "finalizado", vencedor_id: acertaram[0] ?? null, empate: false };
  }
  const extras = p.rodadas.length - p.total_perguntas + 1;
  if (extras >= DUELO.MAX_DESEMPATE) {
    return { ...p, status: "finalizado", empate: true, vencedor_id: null };
  }
  const extra = rodadaExtraLocal(p, p.rodadas.length + 1);
  if (!extra) return { ...p, status: "finalizado", empate: true, vencedor_id: null };
  return {
    ...p,
    rodadas: [...p.rodadas, extra],
    rodada_atual: p.rodada_atual + 1,
    total_perguntas: p.total_perguntas + 1,
    rodada_liberada_em: Date.now(),
  };
}

/** Converte o estado local para a forma que a UI consome (igual à do servidor). */
export function partidaLocalParaUi(p: PartidaLocal) {
  return {
    partida_id: p.id,
    jogador_1_id: p.jogador_1_id,
    jogador_2_id: p.bot_id,
    bot_nivel: p.bot_nivel,
    modalidade: p.modalidade,
    area_slug: p.area_slug,
    subcategoria_slug: p.subcategoria_slug,
    status: p.status,
    rodada_atual: p.rodada_atual,
    total_perguntas: p.total_perguntas,
    segundos_por_pergunta: p.segundos_por_pergunta,
    placar_1: p.placar_1,
    placar_2: p.placar_2,
    acertos_1: p.acertos_1,
    acertos_2: p.acertos_2,
    desempate: p.desempate,
    vencedor_id: p.vencedor_id,
    empate: p.empate,
    rodada_liberada_em: new Date(p.rodada_liberada_em).toISOString(),
    rodadas: p.rodadas,
    respostas: p.respostas,
  };
}

/** Pontuação máxima possível numa partida (usada nos rótulos da arena). */
export function pontuacaoMaxima(totalPerguntas: number): number {
  return totalPerguntas * (DUELO.PONTOS_ACERTO + DUELO.PONTOS_RAPIDEZ);
}
