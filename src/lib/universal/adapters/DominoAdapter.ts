/**
 * Adaptador de DOMINÓ (duplo-6, variante bloco e compra).
 *
 * Regras implementadas:
 *  - 28 peças (0-0 a 6-6), 7 na mão de cada jogador
 *  - a primeira peça define a mesa; depois só encaixa nas extremidades
 *  - peça pode ser virada para encaixar (`flipped`)
 *  - variante `draw`: compra do monte quando não há jogada
 *  - passa o turno quando não há jogada nem monte
 *  - vitória por bater (mão vazia) ou por bloqueio (menor soma de pontos)
 *
 * O estado expõe `customState.hands` (as mãos por jogador) e
 * `customState.table` (a mesa na ordem de encaixe) — é o que a UI desenha.
 */
import {
  UniversalGameUtils,
  type GameCategory,
  type GameMove,
  type UniversalGameEngine,
  type UniversalGameState,
} from "../UniversalGameEngine";

export interface DominoTile {
  left: number;
  right: number;
}

export interface DominoCustomState {
  /** Mão de cada jogador (índice = id do jogador). */
  hands: DominoTile[][];
  /** Mesa, na ordem de encaixe. */
  table: DominoTile[];
  /** Extremidade esquerda e direita (-1 enquanto a mesa está vazia). */
  leftEnd: number;
  rightEnd: number;
  /** Monte de compra. */
  boneyard: DominoTile[];
  /** Passes consecutivos (2 = mesa bloqueada). */
  consecutivePasses: number;
}

export interface DominoState extends UniversalGameState {
  customState: DominoCustomState;
}

const MAX_PIP = 6;
const HAND_SIZE = 7;

function createSet(): DominoTile[] {
  const tiles: DominoTile[] = [];
  for (let i = 0; i <= MAX_PIP; i++) {
    for (let j = i; j <= MAX_PIP; j++) tiles.push({ left: i, right: j });
  }
  return tiles;
}

export function pips(tile: DominoTile): number {
  return tile.left + tile.right;
}

export function handPips(hand: readonly DominoTile[]): number {
  return hand.reduce((sum, tile) => sum + pips(tile), 0);
}

export class DominoAdapter implements UniversalGameEngine {
  initializeGame(category: GameCategory, playerCount: number, variant?: string): DominoState {
    const players = Math.max(2, Math.min(4, playerCount));
    const set = UniversalGameUtils.shuffle(createSet());
    const hands: DominoTile[][] = [];
    for (let i = 0; i < players; i++) {
      hands.push(set.splice(0, HAND_SIZE));
    }

    // A mão já vem distribuída: a fase é "playing" (a UI não tem passo de
    // distribuição, então o estado inicial precisa ser jogável).
    const state: DominoState = {
      gameCategory: "domino_block",
      gameId: `domino-${Date.now()}`,
      players: Array.from({ length: players }, (_, i) =>
        UniversalGameUtils.createPlayer(i, i === 0 ? "Você" : `Oponente ${i}`, i > 0),
      ),
      currentPlayer: 0,
      turnOrder: Array.from({ length: players }, (_, i) => i),
      board: { type: "custom", customState: {} },
      pieces: [],
      deck: [],
      phase: "playing",
      round: 1,
      scores: Object.fromEntries(Array.from({ length: players }, (_, i) => [i, 0])),
      activeRules: variant === "draw" ? ["standard", "draw"] : ["standard", "block"],
      variant: variant ?? "block",
      moveHistory: [],
      lastMove: null,
      gameOver: false,
      winner: null,
      reason: null,
      customState: {
        hands,
        table: [],
        leftEnd: -1,
        rightEnd: -1,
        boneyard: set,
        consecutivePasses: 0,
      },
    };
    state.players.forEach((p, i) => {
      p.hand = (hands[i] ?? []).map((tile, idx) => ({
        id: `d-${i}-${idx}-${tile.left}-${tile.right}`,
        type: "domino" as const,
        owner: i,
        data: { left: tile.left, right: tile.right },
      }));
    });
    return state;
  }

  private clone(state: DominoState): DominoState {
    return UniversalGameUtils.cloneState(state) as DominoState;
  }

  /** A peça encaixa nesta extremidade? */
  private fits(tile: DominoTile, end: number): boolean {
    return tile.left === end || tile.right === end;
  }

  getValidMoves(state: UniversalGameState): GameMove[] {
    const s = state as DominoState;
    if (s.gameOver) return [];
    const player = s.currentPlayer;
    const hand = s.customState.hands[player] ?? [];
    const moves: GameMove[] = [];

    if (s.customState.table.length === 0) {
      // Mesa vazia: qualquer peça abre o jogo.
      hand.forEach((tile, index) => {
        moves.push({
          playerId: player,
          type: "play",
          timestamp: 0,
          data: { tileIndex: index, side: "left", left: tile.left, right: tile.right },
        });
      });
      return moves;
    }

    const { leftEnd, rightEnd } = s.customState;
    hand.forEach((tile, index) => {
      const fitsLeft = this.fits(tile, leftEnd);
      const fitsRight = this.fits(tile, rightEnd);
      if (fitsLeft) {
        moves.push({
          playerId: player,
          type: "play",
          timestamp: 0,
          data: { tileIndex: index, side: "left", left: tile.left, right: tile.right },
        });
      }
      if (fitsRight && (!fitsLeft || leftEnd !== rightEnd)) {
        moves.push({
          playerId: player,
          type: "play",
          timestamp: 0,
          data: { tileIndex: index, side: "right", left: tile.left, right: tile.right },
        });
      }
    });

    if (moves.length === 0) {
      if (s.customState.boneyard.length > 0) {
        moves.push({ playerId: player, type: "draw", timestamp: 0, data: { action: "draw" } });
      } else {
        moves.push({ playerId: player, type: "pass", timestamp: 0, data: { action: "pass" } });
      }
    }

    return moves;
  }

  applyMove(state: UniversalGameState, move: GameMove): UniversalGameState {
    const s = state as DominoState;
    const next = this.clone(s);
    const cs = next.customState;
    const player = s.currentPlayer;

    if (move.type === "draw") {
      const tile = cs.boneyard.pop();
      if (tile) cs.hands[player]?.push(tile);
      // Comprou: o turno volta para o MESMO jogador decidir de novo.
      next.moveHistory = [...s.moveHistory, move];
      next.lastMove = move;
      next.pieces = [];
      next.players.forEach((p, i) => {
        p.hand = (cs.hands[i] ?? []).map((t, idx) => ({
          id: `d-${i}-${idx}-${t.left}-${t.right}`,
          type: "domino" as const,
          owner: i,
          data: { left: t.left, right: t.right },
        }));
      });
      return next;
    }

    if (move.type === "pass") {
      cs.consecutivePasses += 1;
      const players = next.players.length;
      if (cs.consecutivePasses >= players) {
        // Mesa bloqueada: vence quem tiver menos pontos na mão.
        next.gameOver = true;
        next.reason = "blocked";
        let best = Number.POSITIVE_INFINITY;
        let winner = 0;
        cs.hands.forEach((hand, i) => {
          const total = handPips(hand);
          if (total < best) {
            best = total;
            winner = i;
          }
        });
        next.winner = winner;
      } else {
        next.currentPlayer = (player + 1) % players;
      }
      next.moveHistory = [...s.moveHistory, move];
      next.lastMove = move;
      return next;
    }

    if (move.type === "play") {
      const index = Number(move.data["tileIndex"] ?? -1);
      const side = String(move.data["side"] ?? "left");
      const hand = cs.hands[player] ?? [];
      const tile = hand[index];
      if (!tile) return s;

      hand.splice(index, 1);

      // Normaliza a orientação para que a peça encaixe na extremidade.
      if (cs.table.length === 0) {
        cs.table.push({ left: tile.left, right: tile.right });
        cs.leftEnd = tile.left;
        cs.rightEnd = tile.right;
      } else if (side === "left") {
        const placed = tile.right === cs.leftEnd ? { left: tile.left, right: tile.right } : { left: tile.right, right: tile.left };
        cs.table.unshift(placed);
        cs.leftEnd = placed.left;
      } else {
        const placed = tile.left === cs.rightEnd ? { left: tile.left, right: tile.right } : { left: tile.right, right: tile.left };
        cs.table.push(placed);
        cs.rightEnd = placed.right;
      }

      cs.consecutivePasses = 0;
      next.moveHistory = [...s.moveHistory, move];
      next.lastMove = move;
      next.pieces = [];
      next.players.forEach((p, i) => {
        p.hand = (cs.hands[i] ?? []).map((t, idx) => ({
          id: `d-${i}-${idx}-${t.left}-${t.right}`,
          type: "domino" as const,
          owner: i,
          data: { left: t.left, right: t.right },
        }));
      });

      if (hand.length === 0) {
        next.gameOver = true;
        next.winner = player;
        next.reason = "domino";
        next.scores[player] = (next.scores[player] ?? 0) + 1;
      } else {
        next.currentPlayer = (player + 1) % next.players.length;
      }
      return next;
    }

    return s;
  }

  isGameOver(state: UniversalGameState): boolean {
    return state.gameOver;
  }

  getWinner(state: UniversalGameState): number | null {
    return state.winner;
  }

  /** Menos pontos na mão é melhor. */
  evaluate(state: UniversalGameState, player: number): number {
    const s = state as DominoState;
    if (s.gameOver) {
      if (s.winner === null) return 0;
      return s.winner === player ? 100_000 : -100_000;
    }
    const mine = handPips(s.customState.hands[player] ?? []);
    let foeBest = 0;
    s.customState.hands.forEach((hand, i) => {
      if (i === player) return;
      const total = handPips(hand);
      if (total > foeBest) foeBest = total;
    });
    return (foeBest - mine) * 10;
  }

  getCurrentPlayer(state: UniversalGameState): number {
    return (state as DominoState).currentPlayer;
  }

  moveKey(move: GameMove): string {
    return `${move.type}:${String(move.data["tileIndex"] ?? "")}:${String(move.data["side"] ?? "")}`;
  }
}
