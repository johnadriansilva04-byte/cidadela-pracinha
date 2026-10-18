/**
 * Adaptador de DAMAS (Checkers).
 *
 * Regras implementadas:
 *  - movimento diagonal simples para frente
 *  - captura por salto (obrigatória quando existe)
 *  - capturas em cadeia (multi-salto) com escolha da linha
 *  - promoção a dama na última linha (e dama anda em qualquer direção)
 *  - vitória por captura total ou por bloqueio
 *
 * O estado mantém a matriz em `customState.grid` (a UI desenha direto) e
 * espelha as peças em `pieces` para a IA genérica.
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

export type CheckersColor = "r" | "b";

export interface CheckersCustomState {
  /** Matriz 8x8; linha 0 = topo. Casas claras nunca têm peça. */
  grid: (string | null)[][];
  turn: CheckersColor;
  /** Quantas capturas encadeadas a peça que acabou de jogar ainda pode fazer. */
  chainFrom: string | null;
  /**
   * Meios-lances desde a última captura ou coroação. Atingido o limite, a
   * partida é declarada empatada — sem isso dois reis podem se perseguir para
   * sempre e a partida nunca termina (a IA ficaria em loop indefinido).
   */
  halfMoveClock: number;
}

export interface CheckersState extends UniversalGameState {
  customState: CheckersCustomState;
}

/** Jogada de damas (payload de `data`). */
export interface CheckersMove extends GameMove {
  data: { from: string; to: string; captured?: string };
}

const SIZE = 8;
/** Lances sem captura/coroação até declarar empate (regra dos 40 lances). */
const DRAW_HALF_MOVES = 80;

function inside(x: number, y: number): boolean {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

function colorOf(cell: string | null): CheckersColor | null {
  if (!cell) return null;
  return cell[0] as CheckersColor;
}

function isKing(cell: string | null): boolean {
  return cell !== null && cell.endsWith("K");
}

/** Só as casas escuras (x + y ímpar) recebem peças. */
function isDark(x: number, y: number): boolean {
  return (x + y) % 2 === 1;
}

export class CheckersAdapter implements UniversalGameEngine {
  initializeGame(category: GameCategory, playerCount: number, variant?: string): CheckersState {
    const grid: (string | null)[][] = Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, () => null),
    );
    // Vermelhas (jogador 0) nas 3 primeiras linhas; pretas nas 3 últimas.
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < SIZE; x++) if (isDark(x, y)) grid[y]![x] = "r";
    }
    for (let y = 5; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) if (isDark(x, y)) grid[y]![x] = "b";
    }

    const state: CheckersState = {
      gameCategory: "board_checkers",
      gameId: `checkers-${Date.now()}`,
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
      activeRules: ["standard", "mandatory-capture"],
      variant: variant ?? "standard",
      moveHistory: [],
      lastMove: null,
      gameOver: false,
      winner: null,
      reason: null,
      customState: { grid, turn: "r", chainFrom: null, halfMoveClock: 0 },
    };
    state.pieces = this.syncPieces(state);
    return state;
  }

  private buildBoard(): GameBoard {
    const board = UniversalGameUtils.createGridBoard(SIZE, SIZE);
    board.customState = { size: SIZE };
    return board;
  }

  private syncPieces(state: CheckersState): GamePiece[] {
    const pieces: GamePiece[] = [];
    const grid = state.customState.grid;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const cell = grid[y]?.[x] ?? null;
        if (!cell) continue;
        pieces.push({
          id: `${cell}-${x}-${y}`,
          type: "checker",
          owner: cell[0] === "r" ? 0 : 1,
          position: { x, y },
          data: { color: cell[0], king: cell.endsWith("K") },
        });
      }
    }
    return pieces;
  }

  private clone(state: CheckersState): CheckersState {
    const next = UniversalGameUtils.cloneState(state) as CheckersState;
    next.customState.grid = next.customState.grid.map((row) => row.slice());
    return next;
  }

  private cellAt(state: CheckersState, x: number, y: number): string | null {
    if (!inside(x, y)) return null;
    return state.customState.grid[y]?.[x] ?? null;
  }

  /** Direções de movimento; a dama anda nos 4 sentidos diagonais. */
  private directions(color: CheckersColor, king: boolean): Array<[number, number]> {
    if (king)
      return [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ];
    const dy = color === "r" ? 1 : -1; // vermelhas descem, pretas sobem
    return [
      [1, dy],
      [-1, dy],
    ];
  }

  /** Saltos disponíveis a partir de uma casa (sem recursão). */
  private jumpsFrom(state: CheckersState, x: number, y: number): GameMove[] {
    const cell = this.cellAt(state, x, y);
    if (!cell) return [];
    const color = colorOf(cell)!;
    const king = isKing(cell);
    const moves: GameMove[] = [];

    for (const [dx, dy] of this.directions(color, king)) {
      const mx = x + dx;
      const my = y + dy;
      const landX = x + dx * 2;
      const landY = y + dy * 2;
      if (!inside(landX, landY)) continue;
      const middle = this.cellAt(state, mx, my);
      if (!middle || colorOf(middle) === color) continue;
      if (this.cellAt(state, landX, landY)) continue;
      moves.push({
        playerId: color === "r" ? 0 : 1,
        type: "capture",
        timestamp: 0,
        data: { from: `${x}-${y}`, to: `${landX}-${landY}`, captured: `${mx}-${my}` },
      });
    }
    return moves;
  }

  private stepsFrom(state: CheckersState, x: number, y: number): GameMove[] {
    const cell = this.cellAt(state, x, y);
    if (!cell) return [];
    const color = colorOf(cell)!;
    const king = isKing(cell);
    const moves: GameMove[] = [];
    for (const [dx, dy] of this.directions(color, king)) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inside(nx, ny)) continue;
      if (this.cellAt(state, nx, ny)) continue;
      moves.push({
        playerId: color === "r" ? 0 : 1,
        type: "move",
        timestamp: 0,
        data: { from: `${x}-${y}`, to: `${nx}-${ny}` },
      });
    }
    return moves;
  }

  /** Todas as capturas disponíveis para a cor que deve jogar. */
  private allJumps(state: CheckersState): GameMove[] {
    const color = state.customState.turn;
    const out: GameMove[] = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const cell = state.customState.grid[y]?.[x] ?? null;
        if (!cell || colorOf(cell) !== color) continue;
        out.push(...this.jumpsFrom(state, x, y));
      }
    }
    return out;
  }

  getValidMoves(state: UniversalGameState): GameMove[] {
    const s = state as CheckersState;
    if (s.gameOver) return [];

    // Cadeia em andamento: a MESMA peça precisa continuar capturando.
    const chain = s.customState.chainFrom;
    if (chain) {
      const [cx, cy] = chain.split("-").map(Number) as [number, number];
      return this.jumpsFrom(s, cx, cy);
    }

    const jumps = this.allJumps(s);
    if (jumps.length > 0) return jumps; // captura obrigatória

    const steps: GameMove[] = [];
    const color = s.customState.turn;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const cell = s.customState.grid[y]?.[x] ?? null;
        if (!cell || colorOf(cell) !== color) continue;
        steps.push(...this.stepsFrom(s, x, y));
      }
    }
    return steps;
  }

  applyMove(state: UniversalGameState, move: GameMove): UniversalGameState {
    const s = state as CheckersState;
    const next = this.clone(s);
    const cs = next.customState;
    const data = move.data as { from: string; to: string; captured?: string };
    const [fx, fy] = data.from.split("-").map(Number) as [number, number];
    const [tx, ty] = data.to.split("-").map(Number) as [number, number];

    const piece = cs.grid[fy]?.[fx] ?? null;
    if (!piece) return s;

    cs.grid[fy]![fx] = null;
    if (data.captured) {
      const [cx, cy] = data.captured.split("-").map(Number) as [number, number];
      if (cs.grid[cy]) cs.grid[cy]![cx] = null;
      const captured = s.pieces.find((p) => {
        const pos = p.position as { x: number; y: number } | undefined;
        return pos?.x === cx && pos?.y === cy;
      });
      const owner = piece[0] === "r" ? 0 : 1;
      const player = next.players[owner];
      if (player && captured) player.captured.push(captured);
    }

    // Promoção
    const color = piece[0] as CheckersColor;
    // "promovida" = coroou AGORA. Um rei que já era rei e apenas anda pela
    // última fileira NÃO promove — tratar isso como promoção zerava o relógio
    // de empate a cada lance e abortava cadeias de captura.
    const jaEraRei = piece.endsWith("K");
    const promoted = !jaEraRei && ((color === "r" && ty === SIZE - 1) || (color === "b" && ty === 0));
    cs.grid[ty]![tx] = promoted ? `${color}K` : piece;

    next.pieces = this.syncPieces(next);
    next.moveHistory = [...s.moveHistory, move];
    next.lastMove = move;

    // Cadeia de captura? Só continua se houver novo salto E a peça não promoveu.
    if (move.type === "capture" && !promoted) {
      const further = this.jumpsFrom(next, tx, ty);
      if (further.length > 0) {
        cs.chainFrom = `${tx}-${ty}`;
        cs.turn = color;
        next.currentPlayer = color === "r" ? 0 : 1;
        return next;
      }
    }
    cs.chainFrom = null;

    // Reinicia a contagem em captura ou coroação; senão acumula.
    cs.halfMoveClock = move.type === "capture" || promoted ? 0 : cs.halfMoveClock + 1;

    const foe: CheckersColor = color === "r" ? "b" : "r";
    cs.turn = foe;
    next.currentPlayer = foe === "r" ? 0 : 1;
    next.round = Math.floor(next.moveHistory.length / 2) + 1;

    // Fim de jogo: sem peças ou sem jogadas
    const foePieces = next.pieces.filter((p) => p.owner === (foe === "r" ? 0 : 1)).length;
    if (foePieces === 0) {
      next.gameOver = true;
      next.winner = color === "r" ? 0 : 1;
      next.reason = "all_captured";
    } else if (this.getValidMoves(next).length === 0) {
      next.gameOver = true;
      next.winner = color === "r" ? 0 : 1;
      next.reason = "blockade";
    } else if (cs.halfMoveClock >= DRAW_HALF_MOVES) {
      // Regra dos 40 lances: sem captura nem coroação, empate. Impede que dois
      // reis se persigam indefinidamente.
      next.gameOver = true;
      next.winner = null;
      next.reason = "draw";
    }

    return next;
  }

  isGameOver(state: UniversalGameState): boolean {
    return state.gameOver;
  }

  getWinner(state: UniversalGameState): number | null {
    return state.winner;
  }

  evaluate(state: UniversalGameState, player: number): number {
    const s = state as CheckersState;
    if (s.gameOver) {
      if (s.winner === null) return 0;
      return s.winner === player ? 100_000 : -100_000;
    }

    const myColor: CheckersColor = player === 0 ? "r" : "b";
    let score = 0;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const cell = s.customState.grid[y]?.[x] ?? null;
        if (!cell) continue;
        const mine = colorOf(cell) === myColor;
        const value = isKing(cell) ? 5 : 3;
        score += mine ? value : -value;
        // Avanço: peões mais perto da coroação valem um pouco mais.
        if (!isKing(cell) && mine) {
          const progress = myColor === "r" ? y / (SIZE - 1) : 1 - y / (SIZE - 1);
          score += progress * 0.4;
        }
      }
    }
    return score * 10;
  }

  getCurrentPlayer(state: UniversalGameState): number {
    return (state as CheckersState).customState.turn === "r" ? 0 : 1;
  }

  moveKey(move: GameMove): string {
    const d = move.data as { from: string; to: string; captured?: string };
    return `${d.from}>${d.to}${d.captured ? `x${d.captured}` : ""}`;
  }
}
