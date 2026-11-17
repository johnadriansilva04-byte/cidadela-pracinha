/**
 * Ponte entre o estado REAL do `UniversalGameFactory` e o que as telas dos
 * jogos precisam mostrar.
 *
 * Por que isto existe: o estado do engine NÃO é uma matriz de tabuleiro.
 * `state.board` é `{ type, width, height, cells }` e `cells` é uma lista de
 * casas com `{ id, position:{x,y}, content }` — as peças de verdade vivem em
 * `state.pieces` (a `content` das casas fica `null`). Já os dados específicos
 * de cada jogo (dados do Yahtzee, mão do dealer no Blackjack, pontas do
 * dominó) ficam em `state.customState`.
 *
 * As telas originais liam `board[linha][coluna]`, `.hands`, `.dice` no topo —
 * formatos que não existem, o que derrubava o render com o error boundary
 * ("This page didn't load"). Estas funções concentram a leitura correta num
 * só lugar, em vez de repetir a tradução em cada tela.
 */
import type { GamePiece, UniversalGameState } from "./UniversalGameEngine";

/** Uma casa do tabuleiro, já resolvida para a peça que a ocupa. */
export type CelulaTabuleiro = {
  x: number;
  y: number;
  piece: GamePiece | null;
};

type BoardGrid = {
  width?: number;
  height?: number;
  cells?: Array<{ position?: { x: number; y: number }; content?: GamePiece | null }>;
};

/**
 * Converte o tabuleiro do engine numa matriz `[y][x]` de peças.
 *
 * A peça é procurada em `state.pieces` (fonte de verdade) e, se a casa tiver
 * `content` preenchido, ele tem prioridade — cobre os adapters que usam a
 * casa como depósito.
 */
export function lerTabuleiro(state: UniversalGameState | null): CelulaTabuleiro[][] {
  if (!state) return [];

  const board = state.board as BoardGrid | undefined;
  const largura = board?.width ?? 8;
  const altura = board?.height ?? 8;
  const celulas = board?.cells ?? [];

  // Índice por coordenada: evita O(n²) ao procurar a peça de cada casa.
  const porCoordenada = new Map<string, GamePiece>();
  for (const piece of state.pieces ?? []) {
    const pos = piece.position;
    if (pos && typeof pos === "object") {
      porCoordenada.set(`${pos.x}-${pos.y}`, piece);
    }
  }

  const matriz: CelulaTabuleiro[][] = [];
  for (let y = 0; y < altura; y += 1) {
    const linha: CelulaTabuleiro[] = [];
    for (let x = 0; x < largura; x += 1) {
      const casa = celulas.find((c) => c.position?.x === x && c.position?.y === y);
      linha.push({ x, y, piece: casa?.content ?? porCoordenada.get(`${x}-${y}`) ?? null });
    }
    matriz.push(linha);
  }
  return matriz;
}

/**
 * Forma mínima que os helpers precisam de uma jogada. Genérico para que a
 * função devolva o MESMO tipo recebido (o `GameMove` do engine), preservando
 * o tipo nas telas.
 */
type JogadaComOrigemEDestino = { data?: { from?: unknown; to?: unknown } };

/** Chave canônica de uma jogada de tabuleiro: "x-y" (formato do engine). */
export function chaveDaCasa(x: number, y: number): string {
  return `${x}-${y}`;
}

/**
 * Movimentos legais que SAEM da casa informada.
 *
 * O engine identifica a origem pelo **id da peça** (`data.from`) e o destino
 * por `"x-y"` (`data.to`) — não por arrays `[linha, coluna]`.
 */
export function movimentosDaPeca<T extends JogadaComOrigemEDestino>(
  moves: T[],
  pieceId: string | undefined,
): T[] {
  if (!pieceId) return [];
  return moves.filter((m) => m.data?.from === pieceId);
}

/** Destinos possíveis ("x-y") a partir da casa informada. */
export function destinosDaCasa(
  moves: JogadaComOrigemEDestino[],
  pieceId: string | undefined,
): Set<string> {
  const destinos = new Set<string>();
  for (const move of movimentosDaPeca(moves, pieceId)) {
    if (typeof move.data?.to === "string") destinos.add(move.data.to);
  }
  return destinos;
}

/** A jogada que leva a peça da casa informada até o destino informado. */
export function acharJogada<T extends JogadaComOrigemEDestino>(
  moves: T[],
  pieceId: string | undefined,
  destino: string,
): T | undefined {
  return movimentosDaPeca(moves, pieceId).find((m) => m.data?.to === destino);
}

/** Dados do Yahtzee: vivem em `customState`, não no topo do estado. */
export function lerDadosYahtzee(state: UniversalGameState | null): number[] {
  const dados = (state?.customState as { dice?: unknown } | undefined)?.dice;
  return Array.isArray(dados) ? (dados as number[]) : [];
}

/** Rolagens restantes do Yahtzee. */
export function lerRolagensRestantes(state: UniversalGameState | null): number {
  const restantes = (state?.customState as { rollsLeft?: unknown } | undefined)?.rollsLeft;
  return typeof restantes === "number" ? restantes : 3;
}

/** Categorias já marcadas pelo jogador (por id de jogador). */
export function lerCategoriasMarcadas(
  state: UniversalGameState | null,
  player: number,
): string[] {
  const categorias = (state?.customState as { categories?: Record<number, string[]> } | undefined)
    ?.categories;
  return categorias?.[player] ?? [];
}

/** Placar por categoria do Yahtzee (por id de jogador). */
export function lerPlacarYahtzee(
  state: UniversalGameState | null,
  player: number,
): Record<string, number> {
  const placar = (state?.customState as { scores?: Record<number, Record<string, number>> } | undefined)
    ?.scores;
  return placar?.[player] ?? {};
}

/** Mão do dealer no Blackjack. */
export function lerMaoDealer(state: UniversalGameState | null): GamePiece[] {
  const mao = (state?.customState as { dealerHand?: unknown } | undefined)?.dealerHand;
  return Array.isArray(mao) ? (mao as GamePiece[]) : [];
}

/** Mão de um jogador no Blackjack. */
export function lerMao(state: UniversalGameState | null, player: number): GamePiece[] {
  return state?.players?.[player]?.hand ?? [];
}

/** Pontas abertas do dominó (`-1` = mesa ainda vazia). */
export function lerPontasDomino(state: UniversalGameState | null): { left: number; right: number } {
  const custom = state?.customState as { leftEnd?: number; rightEnd?: number } | undefined;
  return { left: custom?.leftEnd ?? -1, right: custom?.rightEnd ?? -1 };
}

/** Peças já jogadas na mesa (o `pieces` do estado do dominó). */
export function lerMesaDomino(state: UniversalGameState | null): GamePiece[] {
  return state?.pieces ?? [];
}

/** Valor de uma carta no Blackjack, tratando o Ás como 1 ou 11. */
export function valorDaMao(cartas: GamePiece[]): number {
  let total = 0;
  let ases = 0;
  for (const carta of cartas) {
    total += Number(carta.data?.["value"] ?? 0);
    if (carta.data?.["rank"] === "A") ases += 1;
  }
  while (total > 21 && ases > 0) {
    total -= 10;
    ases -= 1;
  }
  return total;
}

/** Nome legível de uma carta (ex.: "A♥"). */
export function simboloDaCarta(carta: GamePiece): string {
  const naipes: Record<string, string> = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠",
  };
  const rank = String(carta.data?.["rank"] ?? "?");
  return `${rank}${naipes[String(carta.data?.["suit"] ?? "")] ?? ""}`;
}

/** Naipe é vermelho? (para pintar a carta) */
export function cartaVermelha(carta: GamePiece): boolean {
  const naipe = String(carta.data?.["suit"] ?? "");
  return naipe === "hearts" || naipe === "diamonds";
}
