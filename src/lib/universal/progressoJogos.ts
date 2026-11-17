import { supabase } from "@/integrations/supabase/client";
import { registrarTransacaoSov } from "@/lib/financial/sovApi";
import { registrarEventoMissao } from "@/lib/cidadela/pracinhaCore";
import {
  MISSAO_DO_JOGO,
  aplicarResultado,
  chaveRecompensa,
  normalizarProgresso,
  progressoInicial,
  type ProgressoJogo,
  type ResultadoPartida,
} from "./campanhaJogos";

/**
 * Persistência do progresso de campanha dos jogos.
 *
 * Fonte de verdade: `cidadela_perfis.estado.jogos[jogoId]` (JSONB), gravado
 * pela RPC `atualizar_estado_cidadela` — que faz MERGE no JSONB e já era usada
 * pelo onboarding/profissão. Não criamos tabela de progresso: seria uma
 * segunda fonte para o mesmo dado.
 *
 * Espelho local (localStorage) para quem não está logado: a partida offline
 * continua contando e sobe quando entrar.
 */

const CHAVE_LOCAL = (userId: string | null) => `cidadela:jogos:${userId ?? "anon"}`;

export type EstadoJogos = Record<string, ProgressoJogo>;

export function lerJogosLocal(userId: string | null): EstadoJogos {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(CHAVE_LOCAL(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const saida: EstadoJogos = {};
    for (const [jogoId, valor] of Object.entries(parsed)) {
      saida[jogoId] = normalizarProgresso(jogoId, valor);
    }
    return saida;
  } catch {
    return {};
  }
}

function salvarJogosLocal(userId: string | null, estado: EstadoJogos): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CHAVE_LOCAL(userId), JSON.stringify(estado));
  } catch {
    /* sem storage */
  }
}

/** Extrai o bloco de jogos do JSONB `estado` do perfil. */
export function extrairJogosDoPerfil(estado: unknown): EstadoJogos {
  const bruto = (estado as Record<string, unknown> | null)?.["jogos"];
  if (!bruto || typeof bruto !== "object") return {};
  const saida: EstadoJogos = {};
  for (const [jogoId, valor] of Object.entries(bruto as Record<string, unknown>)) {
    saida[jogoId] = normalizarProgresso(jogoId, valor);
  }
  return saida;
}

/** Carrega o progresso: RPC primeiro (autenticado), depois espelho local. */
export async function carregarJogos(userId: string | null): Promise<EstadoJogos> {
  const local = lerJogosLocal(userId);
  if (!userId) return local;
  try {
    const { data, error } = await supabase.rpc("obter_perfil_cidadela");
    if (error) return local;
    const remoto = extrairJogosDoPerfil(
      (data as { estado?: unknown } | null)?.estado ?? null,
    );
    // Remoto vence por jogo; o que só existe local é preservado (offline).
    const juntos: EstadoJogos = { ...local, ...remoto };
    salvarJogosLocal(userId, juntos);
    return juntos;
  } catch {
    return local;
  }
}

async function gravarJogos(userId: string | null, estado: EstadoJogos): Promise<void> {
  salvarJogosLocal(userId, estado);
  if (!userId) return;
  try {
    const { error } = await supabase.rpc("atualizar_estado_cidadela", {
      p_estado: { jogos: estado },
    });
    if (error) console.error("[Jogos] gravar progresso falhou:", error.message);
  } catch (err) {
    console.error("[Jogos] gravar progresso falhou:", err);
  }
}

export type ResultadoRegistrado = {
  progresso: ProgressoJogo;
  avancou: boolean;
  concluiu: boolean;
  /** SOV efetivamente creditado (0 se o ledger recusou ou já tinha pago). */
  sovPago: number;
  mensagem: string;
  /** Missão diária que avançou, se houver. */
  missao: string | null;
  /** Recorde do jogador neste jogo (do servidor). */
  recorde: Recorde | null;
};

export type Recorde = {
  vitorias: number;
  derrotas: number;
  empates: number;
  partidas: number;
  sequencia_atual: number;
  melhor_sequencia: number;
};

function normalizarRecorde(bruto: unknown): Recorde | null {
  if (!bruto || typeof bruto !== "object") return null;
  const r = bruto as Partial<Recorde>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  return {
    vitorias: n(r.vitorias),
    derrotas: n(r.derrotas),
    empates: n(r.empates),
    partidas: n(r.partidas),
    sequencia_atual: n(r.sequencia_atual),
    melhor_sequencia: n(r.melhor_sequencia),
  };
}

/**
 * Registra o fim de uma partida: contabiliza na campanha, paga a recompensa
 * da fase (uma vez), avança a missão diária e atualiza o ranking do servidor.
 *
 * A ordem importa: o SOV só é dado DEPOIS de o ledger confirmar. Se o ledger
 * falhar, o progresso da fase ainda é gravado (o jogador venceu de verdade) —
 * mas a recompensa não é mentida, e a chave idempotente deixa pagar depois.
 */
export async function registrarFimDePartida(
  userId: string | null,
  jogoId: string,
  resultado: ResultadoPartida,
  opcoes?: { nomeExibicao?: string | null; estadoAtual?: EstadoJogos },
): Promise<ResultadoRegistrado> {
  const estado = opcoes?.estadoAtual ?? (await carregarJogos(userId));
  const anterior = estado[jogoId] ?? progressoInicial(jogoId);
  const r = aplicarResultado(anterior, resultado);

  const proximo: EstadoJogos = { ...estado, [jogoId]: r.progresso };
  await gravarJogos(userId, proximo);

  // Recompensa: ledger-first, chave idempotente por fase (uma vez na vida).
  let sovPago = 0;
  if (userId && r.avancou && r.recompensa > 0) {
    const creditado = await registrarTransacaoSov(
      userId,
      r.recompensa,
      "reward",
      `Campanha ${jogoId} — fase ${anterior.fase}`,
      "campus",
      { jogoId, fase: anterior.fase },
      {
        sourceEvent: "campanha_jogo",
        idempotencyKey: chaveRecompensa(jogoId, anterior.fase),
      },
    );
    if (typeof creditado === "number") sovPago = r.recompensa;
  }

  // Missão diária: falha em silêncio (missão é bônus, não bloqueia o jogo).
  const missao = MISSAO_DO_JOGO[jogoId] ?? null;
  if (userId && missao) {
    void registrarEventoMissao(missao as never).catch(() => null);
    if (resultado === "vitoria") {
      const missaoVitoria =
        jogoId === "brio" ? "brio_vitoria" : `${missao}_vitoria`;
      void registrarEventoMissao(missaoVitoria as never).catch(() => null);
    }
  }

  // Ranking no servidor (o cliente manda o delta, não o total).
  let recorde: Recorde | null = null;
  if (userId) {
    try {
      const { data, error } = await supabase.rpc("cidadela_registrar_resultado_jogo", {
        p_jogo_id: jogoId,
        p_resultado: resultado,
        p_nome_exibicao: opcoes?.nomeExibicao ?? null,
      });
      if (!error) recorde = normalizarRecorde(data);
    } catch {
      /* ranking é acessório */
    }
  }

  return {
    progresso: r.progresso,
    avancou: r.avancou,
    concluiu: r.concluiu,
    sovPago,
    mensagem: r.mensagem,
    missao,
    recorde,
  };
}

/** Ranking público de um jogo. */
export type LinhaRanking = {
  posicao: number;
  nome: string;
  vitorias: number;
  partidas: number;
  melhorSequencia: number;
  souEu: boolean;
};

export async function carregarRanking(
  jogoId: string,
  limite = 20,
): Promise<LinhaRanking[]> {
  try {
    const { data, error } = await supabase.rpc("cidadela_ranking_do_jogo", {
      p_jogo_id: jogoId,
      p_limite: limite,
    });
    if (error || !Array.isArray(data)) return [];
    return data.map((l) => {
      const linha = l as Record<string, unknown>;
      const num = (v: unknown) => (typeof v === "number" ? v : 0);
      return {
        posicao: num(linha["posicao"]),
        nome: typeof linha["nome_exibicao"] === "string" ? linha["nome_exibicao"] : "Competidor",
        vitorias: num(linha["vitorias"]),
        partidas: num(linha["partidas"]),
        melhorSequencia: num(linha["melhor_sequencia"]),
        souEu: linha["sou_eu"] === true,
      };
    });
  } catch {
    return [];
  }
}
