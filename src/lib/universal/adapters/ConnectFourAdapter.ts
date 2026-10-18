/**
 * Adaptador de LIGA 4 (Connect Four).
 *
 * Regras implementadas:
 *  - tabuleiro 7 colunas x 6 linhas; a peça cai até a casa mais baixa livre
 *  - vitória com 4 em linha (horizontal, vertical ou diagonal)
 *  - empate quando o tabuleiro enche sem vencedor
 *
 * A jogada é identificada pela COLUNA (`data.col`), não pela casa: é assim que
 * o jogador pensa e permite que a UI e a IA compartilhem o mesmo espaço de
 * busca. O estado mantém a matriz em `customState.grid` (a UI desenha direto).
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

export const CONNECT_FOUR_COLS = 7;
export const CONNECT_FOUR_ROWS = 6;
const CONNECT = 4;

export type ConnectFourCell = "r" | "y" | null;

export interface ConnectFourCustomState {
  /** Matriz [linha][coluna]; linha 0 = topo (a gravidade empilha para baixo). */
  grid: ConnectFourCell[][];
  /** Vencedor já resolvido (null = segue). */
  winner: ConnectFourCell;
}

export interface ConnectFourState extends UniversalGameState {
  customState: ConnectFourCustomState;
}

export interface ConnectFourMove extends GameMove {
  data: { col: number; row: number };
}

export class ConnectFourAdapter implements UniversalGameEngine {
  initializeGame(category: GameCategory, playerCount: number, variant?: string): ConnectFourState {
    const grid: ConnectFourCell[][] = Array.from({ length: CONNECT_FOUR_ROWS }, () =>
      Array.from({ length: CONNECT_FOUR_COLS }, () => null),
    );

    const state: ConnectFourState = {
      gameCategory: "board_connect_four",
      gameId: `connect4-${Date.now()}`,
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
      activeRules: ["standard", "gravity"],
      variant: variant ?? "standard",
      moveHistory: [],
      lastMove: null,
      gameOver: false,
      winner: null,
      reason: null,
      customState: { grid, winner: null },
    };
    state.pieces = this.syncPieces(state);
    return state;
  }

  private buildBoard(): GameBoard {
    const board = UniversalGameUtils.createGridBoard(CONNECT_FOUR_COLS, CONNECT_FOUR_ROWS);
    board.customState = { cols: CONNECT_FOUR_COLS, rows: CONNECT_FOUR_ROWS };
    return board;
  }

  private colorOf(player: number): ConnectFourCell {
    return player === 0 ? "r" : "y";
  }

  /** Primeira linha livre de uma coluna (de baixo para cima), ou -1 se cheia. */
  private dropRow(state: ConnectFourState, col: number): number {
    const grid = state.customState.grid;
    for (let y = CONNECT_FOUR_ROWS - 1; y >= 0; y--) {
      if (grid[y]![col] === null) return y;
    }
    return -1;
  }

  /** Casa que recebeu a última peça — usada para checar vitória sem varrer tudo. */
  private winningLine(
    grid: ConnectFourCell[][],
    col: number,
    row: number,
    color: ConnectFourCell,
  ): boolean {
    const directions: Array<[number, number]> = [
      [1, 0], // horizontal
      [0, 1], // vertical
      [1, 1], // diagonal ↗
      [1, -1], // diagonal ↘
    ];
    for (const [dx, dy] of directions) {
      let total = 1;
      for (const sign of [1, -1] as const) {
        let x = col + dx * sign;
        let y = row + dy * sign;
        while (x >= 0 && x < CONNECT_FOUR_COLS && y >= 0 && y < CONNECT_FOUR_ROWS) {
          if (grid[y]![x] !== color) break;
          total++;
          x += dx * sign;
          y += dy * sign;
        }
      }
      if (total >= CONNECT) return true;
    }
    return false;
  }

  private syncPieces(state: ConnectFourState): GamePiece[] {
    const pieces: GamePiece[] = [];
    const grid = state.customState.grid;
    for (let y = 0; y < CONNECT_FOUR_ROWS; y++) {
      for (let x = 0; x < CONNECT_FOUR_COLS; x++) {
        const cell = grid[y]![x];
        if (!cell) continue;
        pieces.push({
          id: `cf-${x}-${y}`,
          type: "token",
          owner: cell === "r" ? 0 : 1,
          position: { x, y },
          data: {},
        });
      }
    }
    return pieces;
  }

  getValidMoves(state: ConnectFourState): ConnectFourMove[] {
    if (state.gameOver) return [];
    const moves: ConnectFourMove[] = [];
    for (let col = 0; col < CONNECT_FOUR_COLS; col++) {
      const row = this.dropRow(state, col);
      if (row >= 0) {
        moves.push({ ...UniversalGameUtils.createMove(state.currentPlayer, "place", { col, row }), data: { col, row } });
      }
    }
    return moves;
  }

  applyMove(state: ConnectFourState, move: GameMove): ConnectFourState {
    const next = UniversalGameUtils.cloneState(state) as ConnectFourState;
    const col = Number((move.data as { col?: unknown }).col);
    const row = this.dropRow(next, col);
    if (row < 0) return next;

    const color = this.colorOf(next.currentPlayer);
    next.customState.grid[row]![col] = color;
    next.pieces = this.syncPieces(next);
    next.lastMove = { ...move, playerId: next.currentPlayer, data: { col, row } };
    next.moveHistory = [...next.moveHistory, next.lastMove];

    if (this.winningLine(next.customState.grid, col, row, color)) {
      next.gameOver = true;
      next.winner = next.currentPlayer;
      next.customState.winner = color;
      next.reason = "quatro em linha";
      next.phase = "finished";
      next.scores[next.currentPlayer] = (next.scores[next.currentPlayer] ?? 0) + 1;
      return next;
    }

    if (next.moveHistory.length >= CONNECT_FOUR_COLS * CONNECT_FOUR_ROWS) {
      next.gameOver = true;
      next.winner = null;
      next.reason = "tabuleiro cheio";
      next.phase = "finished";
      return next;
    }

    next.currentPlayer = next.currentPlayer === 0 ? 1 : 0;
    next.round = next.moveHistory.length + 1;
    return next;
  }

  isGameOver(state: ConnectFourState): boolean {
    return state.gameOver;
  }

  getWinner(state: ConnectFourState): number | null {
    return state.winner;
  }

  getCurrentPlayer(state: ConnectFourState): number {
    return state.currentPlayer;
  }

  /**
   * Avaliação heurística. Liga 4 é resolvido por ameaças, então a pontuação
   * conta as JANELAS de 4 casas: cada janela com 3 peças próprias e 1 vazia vale
   * muito mais que peças soltas, e a coluna central vale um bônus por dar mais
   * linhas de fuga. É essa função que a verificação negamax usa para decidir.
   */
  evaluate(state: ConnectFourState, player: number): number {
    const grid = state.customState.grid;
    const mine = this.colorOf(player);
    const foe = this.colorOf(player === 0 ? 1 : 0);
    const valor = (cell: ConnectFourCell): number =>
      cell === mine ? 1 : cell === foe ? -1 : 0;

    let score = 0;

    // Janelas de 4 em todas as direções.
    const directions: Array<[number, number]> = [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
    ];
    for (let y = 0; y < CONNECT_FOUR_ROWS; y++) {
      for (let x = 0; x < CONNECT_FOUR_COLS; x++) {
        for (const [dx, dy] of directions) {
          const endX = x + dx * (CONNECT - 1);
          const endY = y + dy * (CONNECT - 1);
          if (endX < 0 || endX >= CONNECT_FOUR_COLS || endY < 0 || endY >= CONNECT_FOUR_ROWS) continue;

          let soma = 0;
          for (let i = 0; i < CONNECT; i++) soma += valor(grid[y + dy * i]![x + dx * i]!);

          if (soma === 3) score += 50;
          else if (soma === 2) score += 8;
          else if (soma === -3) score -= 60;
          else if (soma === -2) score -= 10;
        }
      }
    }

    // Centro do tabuleiro: mais opções de conexão.
    for (let y = 0; y < CONNECT_FOUR_ROWS; y++) {
      score += valor(grid[y]![3]!) * 4;
    }

    // Vitória/derrota já decidida domina qualquer heurística.
    if (state.gameOver && state.winner !== null) {
      score += state.winner === player ? 100_000 : -100_000;
    }

    return score;
  }

  /** Vitória imediata; senão bloqueia a vitória iminente do adversário. */
  suggestMove(state: ConnectFourState, player: number): GameMove | null {
    if (state.gameOver) return null;
    const moves = this.getValidMoves(state);

    for (const move of moves) {
      const next = this.applyMove(state, move);
      if (next.gameOver && next.winner === player) return move;
    }

    const foe = player === 0 ? 1 : 0;
    for (const move of moves) {
      const probe = { ...state, currentPlayer: foe } as ConnectFourState;
      const next = this.applyMove(probe, move);
      if (next.gameOver && next.winner === foe) return move;
    }
    return null;
  }
}
