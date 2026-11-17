/**
 * Motor do DUELO do GUERRA DE BRIO — regras da partida (PURO, sem I/O).
 *
 * Regras (§4.3 do documento):
 *   1. APRESENTAÇÃO — a mesma pergunta para os dois jogadores ao mesmo tempo.
 *   2. CONTAGEM — 7 segundos por pergunta.
 *   3. REGISTRO — a resposta é travada; não pode ser alterada; fica OCULTA
 *      para o adversário até a revelação.
 *   4. REVELAÇÃO — quando ambos respondem ou o tempo acaba.
 *   5. RESULTADO — ambos acertam → ambos pontuam; ambos erram → ninguém;
 *      um acerta → só ele pontua. Quem respondeu primeiro leva o bônus de
 *      rapidez (o duelo precisa do fator velocidade).
 *   6. PRÓXIMA PERGUNTA — automática.
 *
 * O relógio aqui é apenas o ESPELHO da UI. A autoridade é o servidor: ele
 * carimba `liberada_em` e calcula o tempo decorrido. Em modo local (migration
 * ainda não aplicada) o espelho é a própria referência, com aviso ao jogador.
 */

import type { Dificuldade } from "./categorias";
import { DUELO, LETRAS, type Letra, type PerguntaPublica } from "./types";

/** Dificuldade crescente ao longo da partida (1..5 → 5 níveis). */
export function dificuldadeDaRodada(rodada: number, total: number): number {
  if (total <= 1) return 3;
  // 1..total → 1..5 com os extremos preservados.
  return Math.max(1, Math.min(5, Math.round(1 + ((rodada - 1) / (total - 1)) * 4)));
}

const DIFICULDADE_POR_ORDEM: Record<number, Dificuldade> = {
  1: "facil",
  2: "intermediaria",
  3: "dificil",
  4: "avancada",
  5: "especialista",
};

export function dificuldadePorOrdem(ordem: number): Dificuldade {
  return DIFICULDADE_POR_ORDEM[Math.max(1, Math.min(5, ordem))] ?? "dificil";
}

/** Valida que a pergunta tem as SEIS alternativas A–F (§3.5). */
export function perguntaValida(p: PerguntaPublica): boolean {
  if (!p.id || !p.enunciado.trim()) return false;
  if (p.alternativas.length !== DUELO.ALTERNATIVAS) return false;
  const letras = p.alternativas.map((a) => a.letra).join("");
  if (letras !== LETRAS.join("")) return false;
  return p.alternativas.every((a) => a.texto.trim().length > 0);
}

/** Alternativas de uma pergunta que NÃO devem ser aceitas (ambíguas/vazias). */
export function alternativasDistintas(p: PerguntaPublica): boolean {
  const normalizadas = p.alternativas.map((a) =>
    a.texto.trim().toLowerCase().replace(/\s+/g, " "),
  );
  return new Set(normalizadas).size === normalizadas.length;
}

export interface ResultadoRodada {
  acertos: Record<string, boolean>;
  /** Pontos por jogador nesta rodada. */
  pontos: Record<string, number>;
  /** Quem respondeu primeiro (null se ninguém respondeu ou se empatou). */
  primeiro: string | null;
}

/**
 * Apura UMA rodada. `respostas` mapeia jogador → letra (null = não respondeu).
 * `tempos` mapeia jogador → ms desde a liberação (null = não respondeu).
 */
export function apurarRodada(
  jogadores: string[],
  respostas: Record<string, Letra | null>,
  tempos: Record<string, number | null>,
  letraCorreta: Letra,
): ResultadoRodada {
  const acertos: Record<string, boolean> = {};
  const pontos: Record<string, number> = {};

  for (const j of jogadores) {
    acertos[j] = respostas[j] === letraCorreta;
    pontos[j] = 0;
  }

  // Quem respondeu primeiro (só conta entre quem respondeu dentro do tempo).
  let primeiro: string | null = null;
  let menorTempo = Infinity;
  let empateTempo = false;
  for (const j of jogadores) {
    const t = tempos[j];
    if (respostas[j] == null || t == null) continue;
    if (t < menorTempo - 1) {
      menorTempo = t;
      primeiro = j;
      empateTempo = false;
    } else if (Math.abs(t - menorTempo) <= 1) {
      empateTempo = true;
    }
  }
  if (empateTempo) primeiro = null;

  for (const j of jogadores) {
    if (!acertos[j]) continue;
    pontos[j] = DUELO.PONTOS_ACERTO;
    // Bônus de rapidez: o duelo premia quem assume a resposta primeiro.
    if (primeiro === j) pontos[j] += DUELO.PONTOS_RAPIDEZ;
  }

  return { acertos, pontos, primeiro };
}

/** Vencedor de uma partida a partir do placar acumulado. */
export function vencedorDoPlacar(
  jogadores: string[],
  placar: Record<string, number>,
): { vencedorId: string | null; empate: boolean } {
  let melhor = -Infinity;
  let pior = Infinity;
  let vencedor: string | null = null;
  for (const j of jogadores) {
    const p = placar[j] ?? 0;
    if (p > melhor) {
      melhor = p;
      vencedor = j;
    }
    if (p < pior) pior = p;
  }
  if (melhor === pior) return { vencedorId: null, empate: true };
  return { vencedorId: vencedor, empate: false };
}

/**
 * Empatou no tempo regulamentar → pergunta extra de desempate (§4.5).
 * O desempate é MORTE SÚBITA: a primeira pergunta em que só um acerta decide.
 */
export function precisaDesempate(placar: Record<string, number>): boolean {
  const valores = Object.values(placar);
  if (valores.length < 2) return false;
  return valores.every((v) => v === valores[0]);
}

export interface EstadoDesempate {
  rodada: number;
  resolvido: boolean;
  vencedorId: string | null;
}

/**
 * Avança a morte súbita. `acertosRodada` mapeia jogador → acertou.
 * Se os dois acertam ou os dois erram, continua; se um só acerta, decide.
 */
export function avancarDesempate(
  jogadores: string[],
  acertosRodada: Record<string, boolean>,
  rodadaAtual: number,
): EstadoDesempate {
  const acertaram = jogadores.filter((j) => acertosRodada[j]);
  if (acertaram.length === 1) {
    return { rodada: rodadaAtual, resolvido: true, vencedorId: acertaram[0] ?? null };
  }
  if (rodadaAtual >= DUELO.MAX_DESEMPATE) {
    // Esgotou o limite: decide por acerto acumulado e, se ainda igual, empate.
    return { rodada: rodadaAtual, resolvido: true, vencedorId: null };
  }
  return { rodada: rodadaAtual + 1, resolvido: false, vencedorId: null };
}

/** Aproveitamento percentual (0–100), arredondado. */
export function aproveitamento(acertos: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((acertos / total) * 100);
}

/**
 * Placar do adversário virtual a partir do nível escolhido (1..4).
 * O bot acerta conforme o nível, e a dificuldade da pergunta modula a chance
 * — um "especialista" (nível 4) erra mais nas fáceis que nas difíceis.
 */
export function chanceAcertoBot(
  nivel: number,
  dificuldade: Dificuldade,
  aleatorio: number,
): boolean {
  const base = [0.34, 0.5, 0.66, 0.8][Math.max(0, Math.min(3, nivel - 1))] ?? 0.5;
  const ajuste: Record<Dificuldade, number> = {
    facil: 0.12,
    intermediaria: 0.06,
    dificil: 0,
    avancada: -0.07,
    especialista: -0.14,
  };
  const p = Math.max(0.05, Math.min(0.95, base + (ajuste[dificuldade] ?? 0)));
  return aleatorio < p;
}

/**
 * Escolhe a letra errada do bot — nunca devolve a correta (o bot não "cola").
 * `aleatorio` em [0,1) seleciona entre as 5 alternativas restantes.
 */
export function letraErrada(letraCorreta: Letra, aleatorio: number): Letra {
  const outras = LETRAS.filter((l) => l !== letraCorreta);
  const idx = Math.min(outras.length - 1, Math.floor(aleatorio * outras.length));
  return outras[Math.max(0, idx)] ?? outras[0] ?? "A";
}

/** Nomes dos níveis do adversário virtual exibidos no lobby. */
export const NIVEIS_ADVERSARIO: Array<{ nivel: number; nome: string; descricao: string }> = [
  { nivel: 1, nome: "Estudante", descricao: "Ainda descobrindo o assunto" },
  { nivel: 2, nome: "Pesquisador", descricao: "Domina o básico com folga" },
  { nivel: 3, nome: "Mestre", descricao: "Consistente em todos os níveis" },
  { nivel: 4, nome: "Especialista", descricao: "Erra pouco até no nível avançado" },
];

/** Rótulo da modalidade para o placar e o histórico. */
export function rotuloConfronto(
  modalidade: string,
  areaNome: string | null,
  subNome: string | null,
): string {
  if (modalidade === "subcategoria" && subNome) return subNome;
  if (modalidade === "categoria" && areaNome) return areaNome;
  if (modalidade === "geral") return "Conhecimento geral";
  if (modalidade === "multidisciplinar") return "Multidisciplinar";
  return "Desafio aleatório";
}
