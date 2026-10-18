/**
 * Adaptador de REVERSI / OTHELLO.
 *
 * Regras implementadas:
 *  - lance só é legal se VIRA ao menos uma peça adversária (em 8 direções)
 *  - todas as peças viradas em qualquer direção mudam de dono
 *  - se o jogador da vez não tem lance legal, ele PASSA (a vez volta ao outro)
 *  - fim: os dois passam seguidos, ou o tabuleiro enche; vence quem tem mais peças
 *
 * O `pass` é uma jogada de verdade (`type: "pass"`), não um efeito colateral:
 * assim a UI consegue mostrar "você passou" e a IA não entra em laço quando
 * `getValidMoves` devolve lista vazia.
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

export const REVERSI_SIZE = 8;

export type ReversiCell = "b" | "w" | null;

export interface ReversiCustomState {
  grid: ReversiCell[][];
  /** Passes consecutivos; dois encerram a partida. */
  passes: number;
}

export interface ReversiState extends UniversalGameState {
  customState: ReversiCustomState;
}

export interface ReversiMove extends GameMove {
  data: { x: number; y: number };
}

const DIRECTIONS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function inside(x: number, y: number): boolean {
  return x >= 0 && x < REVERSI_SIZE && y >= 0 && y < REVERSI_SIZE;
}

export class ReversiAdapter implements UniversalGameEngine {
  initializeGame(category: GameCategory, playerCount: number, variant?: string): ReversiState {
    const grid: ReversiCell[][] = Array.from({ length: REVERSI_SIZE }, () =>
      Array.from({ length: REVERSI_SIZE }, () => null),
    );
    // Posição inicial clássica: brancas em d4/e5, pretas em d5/e4.
    const meio = REVERSI_SIZE / 2;
    grid[meio - 1]![meio - 1] = "w";
    grid[meio]![meio] = "w";
    grid[meio - 1]![meio] = "b";
    grid[meio]![meio - 1] = "b";

    const state: ReversiState = {
      gameCategory: "board_reversi",
      gameId: `reversi-${Date.now()}`,
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
      scores: { 0: 2, 1: 2 },
      activeRules: ["standard", "flip", "pass"],
      variant: variant ?? "standard",
      moveHistory: [],
      lastMove: null,
      gameOver: false,
      winner: null,
      reason: null,
      customState: { grid, passes: 0 },
    };
    state.pieces = this.syncPieces(state);
    state.scores = this.countScore(state);
    return state;
  }

  private buildBoard(): GameBoard {
    const board = UniversalGameUtils.createGridBoard(REVERSI_SIZE, REVERSI_SIZE);
    board.customState = { size: REVERSI_SIZE };
    return board;
  }

  private colorOf(player: number): ReversiCell {
    return player === 0 ? "b" : "w";
  }

  /** Peças que este lance viraria (vazio se o lance é ilegal). */
  private flipsFor(grid: ReversiCell[][], x: number, y: number, color: ReversiCell): Array<[number, number]> {
    if (!inside(x, y) || grid[y]![x] !== null) return [];
    const foe = color === "b" ? "w" : "b";
    const flips: Array<[number, number]> = [];

    for (const [dx, dy] of DIRECTIONS) {
      const linha: Array<[number, number]> = [];
      let cx = x + dx;
      let cy = y + dy;
      while (inside(cx, cy) && grid[cy]![cx] === foe) {
        linha.push([cx, cy]);
        cx += dx;
        cy += dy;
      }
      // Só vale se a linha termina numa peça PRÓPRIA (senão não fecha).
      if (linha.length > 0 && inside(cx, cy) && grid[cy]![cx] === color) {
        flips.push(...linha);
      }
    }
    return flips;
  }

  private countScore(state: ReversiState): Record<number, number> {
    let b = 0;
    let w = 0;
    for (const row of state.customState.grid) {
      for (const cell of row) {
        if (cell === "b") b++;
        else if (cell === "w") w++;
      }
    }
    return { 0: b, 1: w };
  }

  private syncPieces(state: ReversiState): GamePiece[] {
    const pieces: GamePiece[] = [];
    const grid = state.customState.grid;
    for (let y = 0; y < REVERSI_SIZE; y++) {
      for (let x = 0; x < REVERSI_SIZE; x++) {
        const cell = grid[y]![x];
        if (!cell) continue;
        pieces.push({
          id: `rev-${x}-${y}`,
          type: "token",
          owner: cell === "b" ? 0 : 1,
          position: { x, y },
          data: {},
        });
      }
    }
    return pieces;
  }

  /** Casas legais do jogador; vazio = precisa passar. */
  private legalFor(state: ReversiState, player: number): Array<[number, number]> {
    const color = this.colorOf(player);
    const grid = state.customState.grid;
    const out: Array<[number, number]> = [];
    for (let y = 0; y < REVERSI_SIZE; y++) {
      for (let x = 0; x < REVERSI_SIZE; x++) {
        if (this.flipsFor(grid, x, y, color).length > 0) out.push([x, y]);
      }
    }
    return out;
  }

  getValidMoves(state: ReversiState): ReversiMove[] {
    if (state.gameOver) return [];
    const legais = this.legalFor(state, state.currentPlayer);
    if (legais.length > 0) {
      return legais.map(([x, y]) => ({
        ...UniversalGameUtils.createMove(state.currentPlayer, "place", { x, y }),
        data: { x, y },
      }));
    }
    // Sem lance legal: a única jogada é passar.
    return [
      {
        ...UniversalGameUtils.createMove(state.currentPlayer, "pass", { x: -1, y: -1 }),
        data: { x: -1, y: -1 },
      },
    ];
  }

  applyMove(state: ReversiState, move: GameMove): ReversiState {
    const next = UniversalGameUtils.cloneState(state) as ReversiState;
    const data = move.data as { x?: unknown; y?: unknown };
    const x = Number(data.x);
    const y = Number(data.y);
    const passou = x < 0 || y < 0;

    if (!passou) {
      const color = this.colorOf(next.currentPlayer);
      const flips = this.flipsFor(next.customState.grid, x, y, color);
      if (flips.length === 0) return next; // lance ilegal: estado intacto
      next.customState.grid[y]![x] = color;
      for (const [fx, fy] of flips) next.customState.grid[fy]![fx] = color;
      next.customState.passes = 0;
    } else {
      next.customState.passes += 1;
    }

    next.pieces = this.syncPieces(next);
    next.scores = this.countScore(next);
    next.lastMove = { ...move, playerId: next.currentPlayer, data: { x, y } };
    next.moveHistory = [...next.moveHistory, next.lastMove];

    const cheio = next.moveHistory.length >= REVERSI_SIZE * REVERSI_SIZE;
    if (next.customState.passes >= 2 || cheio) {
      next.gameOver = true;
      next.phase = "finished";
      const b = next.scores[0] ?? 0;
      const w = next.scores[1] ?? 0;
      next.winner = b === w ? null : b > w ? 0 : 1;
      next.reason = cheio ? "tabuleiro cheio" : "sem lances para nenhum lado";
      return next;
    }

    // Troca de vez; se o outro não tem lance, ele passa na jogada seguinte.
    next.currentPlayer = next.currentPlayer === 0 ? 1 : 0;
    next.round = next.moveHistory.length + 1;
    return next;
  }

  isGameOver(state: ReversiState): boolean {
    return state.gameOver;
  }

  getWinner(state: ReversiState): number | null {
    return state.winner;
  }

  getCurrentPlayer(state: ReversiState): number {
    return state.currentPlayer;
  }

  /**
   * Avaliação posicional clássica do Reversi. Contar só peças é enganoso (nos
   * primeiros lances vale mais ter MENOS peças, para ter mais mobilidade), então
   * o peso vem de: cantos (estáveis e decisivos) > mobilidade > casas perigosas
   * ao lado dos cantos, que são penalizadas.
   */
  evaluate(state: ReversiState, player: number): number {
    const grid = state.customState.grid;
    const mine = this.colorOf(player);
    const foe = this.colorOf(player === 0 ? 1 : 0);
    const n = REVERSI_SIZE;

    // Pesos por casa: canto vale muito, casa adjacente ao canto vale negativo.
    const peso = (x: number, y: number): number => {
      const bx = Math.min(x, n - 1 - x);
      const by = Math.min(y, n - 1 - y);
      const borda = Math.min(bx, by);
      if (borda === 0 && bx + by === 0) return 100; // canto
      if (borda === 0) return 12; // outra borda
      if (borda === 1 && (bx === 1 || by === 1)) return -14; // X/C ao lado do canto
      return 2;
    };

    let score = 0;
    let pecasMinhas = 0;
    let pecasDele = 0;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const cell = grid[y]![x];
        if (cell === mine) {
          score += peso(x, y);
          pecasMinhas++;
        } else if (cell === foe) {
          score -= peso(x, y);
          pecasDele++;
        }
      }
    }

    // Mobilidade: quem tem mais lances disponíveis dita o jogo.
    const mobilidadeMinha = this.legalFor(state, player).length;
    const mobilidadeDele = this.legalFor(state, player === 0 ? 1 : 0).length;
    score += (mobilidadeMinha - mobilidadeDele) * 6;

    // Diferença de peças só pesa no fim, quando a partida se decide por isso.
    const vazias = n * n - pecasMinhas - pecasDele;
    if (vazias <= 12) score += (pecasMinhas - pecasDele) * 10;

    if (state.gameOver && state.winner !== null) {
      score += state.winner === player ? 100_000 : -100_000;
    }
    return score;
  }

  /** Prefere canto; senão o lance que vira mais peças. */
  suggestMove(state: ReversiState, player: number): GameMove | null {
    if (state.gameOver) return null;
    const moves = this.getValidMoves(state).filter((m) => (m.data as { x: number }).x >= 0);
    if (moves.length === 0) return null;

    const n = REVERSI_SIZE;
    const cantos = moves.filter((m) => {
      const { x, y } = m.data as { x: number; y: number };
      return (x === 0 || x === n - 1) && (y === 0 || y === n - 1);
    });
    if (cantos.length > 0) return cantos[0]!;

    let melhor = moves[0]!;
    let melhorTotal = -1;
    for (const move of moves) {
      const { x, y } = move.data as { x: number; y: number };
      const total = this.flipsFor(state.customState.grid, x, y, this.colorOf(player)).length;
      if (total > melhorTotal) {
        melhorTotal = total;
        melhor = move;
      }
    }
    return melhor;
  }
}
