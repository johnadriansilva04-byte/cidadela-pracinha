/**
 * Camada de acesso ao Supabase do GUERRA DE BRIO.
 *
 * Usa o MESMO client e a MESMA sessão dos outros jogos — não há segundo
 * sistema de autenticação. Quando a migration `guerra_de_brio.sql` ainda não
 * foi aplicada (RPC inexistente), o módulo degrada com segurança para o
 * acervo local determinístico e avisa que o resultado não persiste.
 *
 * Autoridade: o relógio, a revelação e a pontuação são do SERVIDOR. O cliente
 * só espelha. Em modo local, o espelho passa a ser a referência (e o aviso
 * deixa isso explícito para o jogador).
 */
import { supabase } from "@/integrations/supabase/client";
import { ACERVO_BRIO_EQUILIBRADO, GABARITO_LOCAL } from "./acervo";
import { AREAS } from "./categorias";
import { DUELO } from "./types";
import type { Letra } from "./types";

/** Resultado genérico de RPC (tipos do Supabase não conhecem as RPCs brio_*). */
type RpcRes<T> = { data: T | null; error: { code?: string; message?: string } | null };

type ClienteFlex = {
  rpc: (nome: string, args?: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
};

async function rpcBrio<T>(nome: string, args?: Record<string, unknown>): Promise<RpcRes<T>> {
  const s = supabase as unknown as ClienteFlex;
  const res = await s.rpc(nome, args);
  return { data: res.data as T | null, error: res.error };
}

/** true quando alguma RPC brio_* existe (migration aplicada). */
async function rpcExiste(nome: string): Promise<boolean> {
  try {
    const { error } = await rpcBrio<unknown>(nome, {});
    if (error && (error.code === "PGRST202" || error.message?.includes("Could not find the function"))) {
      return false;
    }
    // Erros de negócio (não autenticado, partida inexistente) provam que a
    // função EXISTE — é isso que interessa aqui.
    return true;
  } catch {
    return false;
  }
}

let backendAtivo: boolean | null = null;
let expiraEm = 0;
const CACHE_MS = 60_000;

export async function backendBrioAtivo(): Promise<boolean> {
  if (backendAtivo === null || Date.now() > expiraEm) {
    backendAtivo = await rpcExiste("brio_catalogo");
    expiraEm = Date.now() + CACHE_MS;
  }
  return backendAtivo;
}

// ---------------------------------------------------------------- catálogo

export interface AreaCatalogo {
  slug: string;
  nome: string;
  icone: string | null;
  perguntas: number;
  subcategorias: Array<{ slug: string; nome: string }>;
}

/** Catálogo de áreas/subcategorias com a contagem de perguntas aprovadas. */
export async function carregarCatalogo(): Promise<AreaCatalogo[]> {
  if (await backendBrioAtivo()) {
    const { data, error } = await rpcBrio<AreaCatalogo[]>("brio_catalogo");
    if (!error && Array.isArray(data) && data.length > 0) return data;
  }
  // Fallback: catálogo do código, com a contagem do acervo local.
  return AREAS.map((a) => ({
    slug: a.slug,
    nome: a.nome,
    icone: a.icone,
    perguntas: ACERVO_BRIO_EQUILIBRADO.filter((p) => p.areaSlug === a.slug).length,
    subcategorias: a.subcategorias.map((s) => ({ slug: s.slug, nome: s.nome })),
  }));
}

// ---------------------------------------------------------------- partida

/** Rodada como o servidor entrega (gabarito só quando revelada). */
export interface RodadaServidor {
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

export interface RespostaServidor {
  rodada: number;
  jogador_id: string;
  letra: Letra | null;
  tempo_ms: number;
  acertou: boolean | null;
  pontos: number;
}

export interface EstadoPartidaServidor {
  partida_id: string;
  jogador_1_id: string;
  jogador_2_id: string | null;
  bot_nivel: number | null;
  modalidade: string;
  area_slug: string | null;
  subcategoria_slug: string | null;
  status: "aguardando" | "em_andamento" | "finalizado" | "abandonada";
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
  rodada_liberada_em: string | null;
  iniciado_em: string | null;
  finalizado_em: string | null;
  rodadas: RodadaServidor[];
  respostas: RespostaServidor[];
}

export interface OpcoesPartida {
  modalidade: string;
  areaSlug?: string | null;
  subcategoriaSlug?: string | null;
  botNivel?: number | null;
  total?: number;
  segundos?: number;
  /** Sala de convite entre dois humanos: espera o assento 2 antes de começar. */
  aberta?: boolean;
}

/** Cria a partida no servidor (sorteio e relógio acontecem lá). */
export async function criarPartida(opcoes: OpcoesPartida): Promise<EstadoPartidaServidor | null> {
  if (!(await backendBrioAtivo())) return null;
  const { data, error } = await rpcBrio<EstadoPartidaServidor>("brio_criar_partida", {
    p_modalidade: opcoes.modalidade,
    p_area_slug: opcoes.areaSlug ?? null,
    p_subcategoria_slug: opcoes.subcategoriaSlug ?? null,
    p_bot_nivel: opcoes.botNivel ?? null,
    p_total: opcoes.total ?? DUELO.PERGUNTAS_POR_PARTIDA,
    p_segundos: opcoes.segundos ?? DUELO.SEGUNDOS_POR_PERGUNTA,
    p_aberta: opcoes.aberta ?? false,
  });
  if (error || !data) return null;
  return data;
}

/** Estado atual da partida (o gabarito só vem do que já foi revelado). */
export async function estadoPartida(partidaId: string): Promise<EstadoPartidaServidor | null> {
  if (!(await backendBrioAtivo())) return null;
  const { data, error } = await rpcBrio<EstadoPartidaServidor>("brio_estado_partida", {
    p_partida_id: partidaId,
  });
  if (error || !data) return null;
  return data;
}

/** Registra a resposta (o tempo é carimbado pelo SERVIDOR). */
export async function responder(
  partidaId: string,
  rodada: number,
  letra: Letra,
): Promise<EstadoPartidaServidor | null> {
  const { data, error } = await rpcBrio<EstadoPartidaServidor>("brio_responder", {
    p_partida_id: partidaId,
    p_rodada: rodada,
    p_letra: letra,
  });
  if (error || !data) return null;
  return data;
}

/** Fecha a rodada (revela e pontua). Idempotente no servidor. */
export async function fecharRodada(partidaId: string): Promise<EstadoPartidaServidor | null> {
  const { data, error } = await rpcBrio<EstadoPartidaServidor>("brio_fechar_rodada", {
    p_partida_id: partidaId,
  });
  if (error || !data) return null;
  return data;
}

/** Entra numa sala aberta (link direto de convite). */
export async function entrarPartida(partidaId: string): Promise<EstadoPartidaServidor | null> {
  if (!(await backendBrioAtivo())) return null;
  const { data, error } = await rpcBrio<EstadoPartidaServidor>("brio_entrar_partida", {
    p_partida_id: partidaId,
  });
  if (error || !data) return null;
  return data;
}

// ---------------------------------------------------------------- histórico

export interface PartidaResumo {
  partida_id: string;
  modalidade: string;
  area_slug: string | null;
  subcategoria_slug: string | null;
  meu_placar: number;
  placar_oponente: number;
  meus_acertos: number;
  total_perguntas: number;
  vencedor: boolean;
  empate: boolean;
  contra_bot: boolean;
  status: string;
  criado_em: string;
  finalizado_em: string | null;
}

export async function listarPartidas(limite = 30): Promise<PartidaResumo[]> {
  if (!(await backendBrioAtivo())) return [];
  const { data, error } = await rpcBrio<PartidaResumo[]>("brio_listar_partidas", { p_limite: limite });
  if (error || !Array.isArray(data)) return [];
  return data;
}

export interface HabilidadeLinha {
  area_slug: string | null;
  theta: number;
  erro_padrao: number;
  indice: number;
  respostas: number;
  confiabilidade: number;
  atualizado_em: string;
}

export async function meuIndice(): Promise<HabilidadeLinha[]> {
  if (!(await backendBrioAtivo())) return [];
  const { data, error } = await rpcBrio<HabilidadeLinha[]>("brio_meu_indice");
  if (error || !Array.isArray(data)) return [];
  return data;
}

/** Pede ao servidor para recalcular a TRI a partir do histórico real. */
export async function recalcularHabilidade(janela = 200): Promise<HabilidadeLinha[]> {
  if (!(await backendBrioAtivo())) return [];
  const { data, error } = await rpcBrio<HabilidadeLinha[]>("brio_recalcular_habilidade", {
    p_janela: janela,
  });
  if (error || !Array.isArray(data)) return [];
  return data;
}

// ---------------------------------------------------------------- modo local

/**
 * Gabarito do modo local. Em modo servidor esta função NÃO é usada durante a
 * partida — o gabarito vem do RPC apenas na revelação. Aqui ela existe porque
 * o acervo local é a própria autoridade quando a migration não foi aplicada.
 */
export function gabaritoLocal(perguntaId: string): Letra | null {
  return GABARITO_LOCAL[perguntaId] ?? null;
}

/**
 * Mensagem do aviso de modo local.
 *
 * Diferente do módulo de QI, o duelo local NÃO grava em `sessionStorage` nem
 * sincroniza depois: é um adversário virtual, resolvido no aparelho. O texto
 * diz exatamente isso — prometer sincronização seria mentir para o jogador.
 */
export const AVISO_MODO_LOCAL =
  "Modo offline: você duela contra o adversário virtual neste aparelho. O resultado não é salvo na sua conta nem entra no ranking.";

/** Nome curto de uma área a partir do slug (para placar/histórico). */
export function nomeArea(slug: string | null): string {
  if (!slug) return "Geral";
  return AREAS.find((a) => a.slug === slug)?.nome ?? slug;
}

/** Nome de uma subcategoria a partir do slug. */
export function nomeDaSubcategoria(slug: string | null): string {
  if (!slug) return "";
  for (const area of AREAS) {
    const sub = area.subcategorias.find((s) => s.slug === slug);
    if (sub) return sub.nome;
  }
  return slug;
}
