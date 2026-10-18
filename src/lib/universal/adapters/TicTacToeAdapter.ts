/**
 * Adaptador de JOGO DA VELHA (Tic-Tac-Toe).
 *
 * Regras: grade 3x3, alternância, vitória com 3 em linha, empate com a grade
 * cheia. A árvore é minúscula (~255k nós), então a verificação negamax com
 * profundidade 3 resolve o jogo perfeito: nas dificuldades altas a IA não pode
 * ser batida, o que é o comportamento esperado de um jogo já resolvido.
 */
import {
  UniversalGameUtils,
  type GameBoard,
  type GameCategory,
  type GameMove,
  type GamePiece,
  type UniversalGameEngine,
  type UniversalGameState,
} from "../UniversalGameEngine";

const SIZE = 3;
const CONNECT = 3;

export type TicTacToeCell = "X" | "O" | null;

export interface TicTacToeCustomState {
  grid: TicTacToeCell[][];
}

export interface TicTacToeState extends UniversalGameState {
  customState: TicTacToeCustomState;
}

export interface TicTacToeMove extends GameMove {
  data: { x: number; y: number };
}

/** As 8 linhas vencedoras (índices de linha/coluna). */
const LINES: Array<Array<[number, number]>> = [
  [
    [0, 0],
    [0, 1],
    [0, 2],
  ],
  [
    [1, 0],
    [1, 1],
    [1, 2],
  ],
  [
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  [
    [0, 2],
    [1, 1],
    [2, 0],
  ],
];

export class TicTacToeAdapter implements UniversalGameEngine {
  initializeGame(category: GameCategory, playerCount: number, variant?: string): TicTacToeState {
    const grid: TicTacToeCell[][] = Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, () => null),
    );

    const state: TicTacToeState = {
      gameCategory: "board_tic_tac_toe",
      gameId: `velha-${Date.now()}`,
      players: [
        UniversalGameUtils.createPlayer(0, "Você", false),
        UniversalGameUtils.createPlayer(1, "IA", true),
      ],
      currentPlayer: 0,
      turnOrder: [0, 1],
      board: this.buildBoard(),
      pieces: [],
      deck: [],
      phase: "playing",
      round: 1,
      scores: { 0: 0, 1: 0 },
      activeRules: ["standard"],
      variant: variant ?? "standard",
      moveHistory: [],
      lastMove: null,
      gameOver: false,
      winner: null,
      reason: null,
      customState: { grid },
    };
    state.pieces = this.syncPieces(state);
    return state;
  }

  private buildBoard(): GameBoard {
    const board = UniversalGameUtils.createGridBoard(SIZE, SIZE);
    board.customState = { size: SIZE };
    return board;
  }

  private symbolOf(player: number): TicTacToeCell {
    return player === 0 ? "X" : "O";
  }

  private winnerSymbol(grid: TicTacToeCell[][]): TicTacToeCell {
    for (const line of LINES) {
      const first = grid[line[0]![0]]![line[0]![1]];
      if (!first) continue;
      if (line.every(([y, x]) => grid[y]![x] === first)) return first;
    }
    return null;
  }

  private syncPieces(state: TicTacToeState): GamePiece[] {
    const pieces: GamePiece[] = [];
    const grid = state.customState.grid;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const cell = grid[y]![x];
        if (!cell) continue;
        pieces.push({
          id: `velha-${x}-${y}`,
          type: "token",
          owner: cell === "X" ? 0 : 1,
          position: { x, y },
          data: {},
        });
      }
    }
    return pieces;
  }

  getValidMoves(state: TicTacToeState): TicTacToeMove[] {
    if (state.gameOver) return [];
    const moves: TicTacToeMove[] = [];
    const grid = state.customState.grid;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (grid[y]![x] === null) {
          moves.push({ ...UniversalGameUtils.createMove(state.currentPlayer, "place", { x, y }), data: { x, y } });
        }
      }
    }
    return moves;
  }

  applyMove(state: TicTacToeState, move: GameMove): TicTacToeState {
    const next = UniversalGameUtils.cloneState(state) as TicTacToeState;
    const data = move.data as { x?: unknown; y?: unknown };
    const x = Number(data.x);
    const y = Number(data.y);
    if (next.customState.grid[y]![x] !== null) return next;

    const symbol = this.symbolOf(next.currentPlayer);
    next.customState.grid[y]![x] = symbol;
    next.pieces = this.syncPieces(next);
    next.lastMove = { ...move, playerId: next.currentPlayer, data: { x, y } };
    next.moveHistory = [...next.moveHistory, next.lastMove];

    if (this.winnerSymbol(next.customState.grid) === symbol) {
      next.gameOver = true;
      next.winner = next.currentPlayer;
      next.reason = "três em linha";
      next.phase = "finished";
      next.scores[next.currentPlayer] = (next.scores[next.currentPlayer] ?? 0) + 1;
      return next;
    }

    if (next.moveHistory.length >= SIZE * SIZE) {
      next.gameOver = true;
      next.winner = null;
      next.reason = "velha";
      next.phase = "finished";
      return next;
    }

    next.currentPlayer = next.currentPlayer === 0 ? 1 : 0;
    next.round = next.moveHistory.length + 1;
    return next;
  }

  isGameOver(state: TicTacToeState): boolean {
    return state.gameOver;
  }

  getWinner(state: TicTacToeState): number | null {
    return state.winner;
  }

  getCurrentPlayer(state: TicTacToeState): number {
    return state.currentPlayer;
  }

  /**
   * Avaliação: conta linhas ABERTAS. Uma linha com 2 peças próprias e 1 vazia é
   * ameaça real (vale 10); com 1 peça vale 1. O centro é o ponto mais forte do
   * tabuleiro (participa de 4 linhas), então recebe bônus.
   */
  evaluate(state: TicTacToeState, player: number): number {
    const grid = state.customState.grid;
    const mine = this.symbolOf(player);
    const foe = this.symbolOf(player === 0 ? 1 : 0);
    let score = 0;

    for (const line of LINES) {
      let meu = 0;
      let dele = 0;
      for (const [y, x] of line) {
        const cell = grid[y]![x];
        if (cell === mine) meu++;
        else if (cell === foe) dele++;
      }
      if (meu > 0 && dele > 0) continue; // linha morta
      if (meu === 2) score += 10;
      else if (meu === 1) score += 1;
      if (dele === 2) score -= 12;
      else if (dele === 1) score -= 1;
    }

    if (grid[1]![1] === mine) score += 4;
    else if (grid[1]![1] === foe) score -= 4;

    if (state.gameOver && state.winner !== null) {
      score += state.winner === player ? 100_000 : -100_000;
    }
    return score;
  }

  /** Vitória imediata ou bloqueio imediato. */
  suggestMove(state: TicTacToeState, player: number): GameMove | null {
    if (state.gameOver) return null;
    const moves = this.getValidMoves(state);

    for (const move of moves) {
      const next = this.applyMove(state, move);
      if (next.gameOver && next.winner === player) return move;
    }

    const foe = player === 0 ? 1 : 0;
    for (const move of moves) {
      const probe = { ...state, currentPlayer: foe } as TicTacToeState;
      const next = this.applyMove(probe, move);
      if (next.gameOver && next.winner === foe) return move;
    }
    return null;
  }
}
