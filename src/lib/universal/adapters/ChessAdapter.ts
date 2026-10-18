/**
 * Adaptador de XADREZ.
 *
 * Regras implementadas (o suficiente para uma partida completa e legítima):
 *  - movimentos de peão (inclui duplo inicial, captura diagonal, en passant)
 *  - torre, bispo, rainha, cavalo, rei (com roque)
 *  - xeque, xeque-mate e afogamento (empate)
 *  - promoção de peão (escolha da peça)
 *  - material para a heurística da IA
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

export type ChessColor = "w" | "b";
export type ChessPieceType = "p" | "n" | "b" | "r" | "q" | "k";

/** Peça no formato "cor+tipo", ex.: "wp", "bk". */
export type ChessSquare = string | null;

export interface ChessCustomState {
  /** Matriz 8x8; linha 0 = topo (peças pretas). */
  grid: ChessSquare[][];
  turn: ChessColor;
  castling: { wk: boolean; wq: boolean; bk: boolean; bq: boolean };
  /** Casa alvo de en passant (ex.: "5-2"), ou null. */
  enPassant: string | null;
  /** Meio-lances desde a última captura/peão (para regra dos 50 lances). */
  halfMoveClock: number;
  /** Cor em xeque, ou null. */
  check: ChessColor | null;
  /** Última jogada em notação simples, para o histórico da UI. */
  lastSan: string | null;
}

export interface ChessState extends UniversalGameState {
  customState: ChessCustomState;
}

export interface ChessMove extends GameMove {
  data: {
    from: string; // "x-y"
    to: string; // "x-y"
    promotion?: ChessPieceType;
    castle?: "k" | "q";
  };
}

const SIZE = 8;
const START_FEN_ROW: Record<ChessColor, ChessPieceType[]> = {
  b: ["r", "n", "b", "q", "k", "b", "n", "r"],
  w: ["r", "n", "b", "q", "k", "b", "n", "r"],
};

const PIECE_VALUES: Record<ChessPieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function inside(x: number, y: number): boolean {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

function colorOf(piece: ChessSquare): ChessColor | null {
  if (!piece) return null;
  return piece[0] === "w" ? "w" : "b";
}

function typeOf(piece: ChessSquare): ChessPieceType | null {
  if (!piece) return null;
  return piece[1] as ChessPieceType;
}

export class ChessAdapter implements UniversalGameEngine {
  initializeGame(category: GameCategory, playerCount: number, variant?: string): ChessState {
    const grid: ChessSquare[][] = Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, () => null),
    );
    for (let x = 0; x < SIZE; x++) {
      grid[0]![x] = `b${START_FEN_ROW.b[x]!}`;
      grid[1]![x] = "bp";
      grid[6]![x] = "wp";
      grid[7]![x] = `w${START_FEN_ROW.w[x]!}`;
    }

    const state: ChessState = {
      gameCategory: "board_chess",
      gameId: `chess-${Date.now()}`,
      players: [
        UniversalGameUtils.createPlayer(0, "Brancas", false),
        UniversalGameUtils.createPlayer(1, "Pretas", true),
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
      customState: {
        grid,
        turn: "w",
        castling: { wk: true, wq: true, bk: true, bq: true },
        enPassant: null,
        halfMoveClock: 0,
        check: null,
        lastSan: null,
      },
    };
    state.pieces = this.syncPieces(state);
    return state;
  }

  private buildBoard(): GameBoard {
    const board = UniversalGameUtils.createGridBoard(SIZE, SIZE);
    board.customState = { size: SIZE };
    return board;
  }

  /** Reconstrói `pieces` a partir da matriz (fonte de verdade do xadrez). */
  private syncPieces(state: ChessState): GamePiece[] {
    const pieces: GamePiece[] = [];
    const grid = state.customState.grid;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const square = grid[y]?.[x] ?? null;
        if (!square) continue;
        pieces.push({
          id: `${square}-${x}-${y}`,
          type: "checker",
          owner: square[0] === "w" ? 0 : 1,
          position: { x, y },
          data: { color: square[0], pieceType: square[1] },
        });
      }
    }
    return pieces;
  }

  private clone(state: ChessState): ChessState {
    const next = UniversalGameUtils.cloneState(state) as ChessState;
    next.customState.grid = next.customState.grid.map((row) => row.slice());
    return next;
  }

  /* ------------------------------------------------------------- consulta */

  private pieceAt(state: ChessState, x: number, y: number): ChessSquare {
    if (!inside(x, y)) return null;
    return state.customState.grid[y]?.[x] ?? null;
  }

  private kingPos(state: ChessState, color: ChessColor): { x: number; y: number } | null {
    const grid = state.customState.grid;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (grid[y]?.[x] === `${color}k`) return { x, y };
      }
    }
    return null;
  }

  /** Casas atacadas pela cor (sem se importar com xeque). */
  private attackedSquares(state: ChessState, color: ChessColor): Set<string> {
    const out = new Set<string>();
    const grid = state.customState.grid;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const piece = grid[y]?.[x] ?? null;
        if (!piece || colorOf(piece) !== color) continue;
        const type = typeOf(piece)!;
        switch (type) {
          case "p": {
            const dir = color === "w" ? -1 : 1;
            for (const dx of [-1, 1]) out.add(`${x + dx}-${y + dir}`);
            break;
          }
          case "n":
            for (const [dx, dy] of [
              [1, 2],
              [2, 1],
              [2, -1],
              [1, -2],
              [-1, -2],
              [-2, -1],
              [-2, 1],
              [-1, 2],
            ]) {
              out.add(`${x + dx!}-${y + dy!}`);
            }
            break;
          case "k":
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                out.add(`${x + dx}-${y + dy}`);
              }
            }
            break;
          default: {
            const dirs =
              type === "r"
                ? [
                    [1, 0],
                    [-1, 0],
                    [0, 1],
                    [0, -1],
                  ]
                : type === "b"
                  ? [
                      [1, 1],
                      [1, -1],
                      [-1, 1],
                      [-1, -1],
                    ]
                  : [
                      [1, 0],
                      [-1, 0],
                      [0, 1],
                      [0, -1],
                      [1, 1],
                      [1, -1],
                      [-1, 1],
                      [-1, -1],
                    ];
            for (const [dx, dy] of dirs) {
              let nx = x + dx!;
              let ny = y + dy!;
              while (inside(nx, ny)) {
                out.add(`${nx}-${ny}`);
                if (this.pieceAt(state, nx, ny)) break;
                nx += dx!;
                ny += dy!;
              }
            }
          }
        }
      }
    }
    return out;
  }

  private inCheck(state: ChessState, color: ChessColor): boolean {
    const king = this.kingPos(state, color);
    if (!king) return true;
    return this.isAttacked(state.customState.grid, king.x, king.y, color === "w" ? "b" : "w");
  }

  /**
   * A casa (x,y) está atacada por `by`?
   *
   * Mesma resposta de `attackedSquares(...).has(...)`, mas olhando só as casas
   * que alcançam o alvo em vez de varrer o tabuleiro e montar um Set de
   * strings. `inCheck` roda uma vez por lance pseudo-legal — é o caminho mais
   * quente do gerador — e a versão antiga dominava o custo do rollout.
   */
  private isAttacked(grid: ChessSquare[][], x: number, y: number, by: ChessColor): boolean {
    const at = (px: number, py: number): ChessSquare =>
      inside(px, py) ? (grid[py]?.[px] ?? null) : null;
    const is = (px: number, py: number, type: ChessPieceType): boolean => {
      const p = at(px, py);
      return p !== null && p[0] === by && p[1] === type;
    };

    // Peões: o agressor ataca na diagonal "para frente" dele, ou seja, vem de
    // duas linhas atrás do alvo.
    const back = by === "w" ? 1 : -1;
    if (is(x - 1, y + back, "p") || is(x + 1, y + back, "p")) return true;

    // Cavalo.
    for (const [dx, dy] of [
      [1, 2],
      [2, 1],
      [2, -1],
      [1, -2],
      [-1, -2],
      [-2, -1],
      [-2, 1],
      [-1, 2],
    ]) {
      if (is(x + dx!, y + dy!, "n")) return true;
    }

    // Rei.
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (is(x + dx, y + dy, "k")) return true;
      }
    }

    // Deslizantes: torre/dama nas ortogonais, bispo/dama nas diagonais.
    const ray = (dirs: Array<[number, number]>, types: ChessPieceType[]): boolean => {
      for (const [dx, dy] of dirs) {
        let nx = x + dx;
        let ny = y + dy;
        while (inside(nx, ny)) {
          const p = at(nx, ny);
          if (p !== null) {
            if (p[0] === by && types.includes(p[1] as ChessPieceType)) return true;
            break; // bloqueado pela primeira peça
          }
          nx += dx;
          ny += dy;
        }
      }
      return false;
    };

    if (
      ray(
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ],
        ["r", "q"],
      )
    ) {
      return true;
    }
    return ray(
      [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ],
      ["b", "q"],
    );
  }

  /**
   * Grade resultante da jogada, sem clonar o estado inteiro.
   *
   * `legalMoves` precisa saber se a jogada deixa o próprio rei em xeque, e para
   * isso clonava o estado via JSON a cada lance pseudo-legal — o clone profundo
   * respondia por quase todo o custo da geração de lances. Só a grade influi em
   * `isAttacked`, então basta copiar as 8 linhas e replicar as mutações de
   * peças (inclusive en passant e a torre do roque).
   */
  private gridAfterMove(state: ChessState, move: ChessMove): ChessSquare[][] {
    const g = state.customState.grid.map((row) => row.slice());
    const [fx, fy] = move.data.from.split("-").map(Number) as [number, number];
    const [tx, ty] = move.data.to.split("-").map(Number) as [number, number];
    const piece = g[fy]?.[fx] ?? null;
    if (!piece) return g;
    const color = colorOf(piece)!;
    const type = typeOf(piece)!;

    const isEnPassant =
      type === "p" && fx !== tx && !this.pieceAt(state, tx, ty) && state.customState.enPassant === `${tx}-${ty}`;

    if (g[fy]) g[fy]![fx] = null;
    if (isEnPassant && g[fy]) g[fy]![tx] = null;

    const promoted = move.data.promotion && type === "p" && (ty === 0 || ty === 7);
    g[ty]![tx] = promoted ? `${color}${move.data.promotion}` : piece;

    if (move.data.castle === "k") {
      g[ty]![5] = g[ty]![7] ?? null;
      g[ty]![7] = null;
    } else if (move.data.castle === "q") {
      g[ty]![3] = g[ty]![0] ?? null;
      g[ty]![0] = null;
    }
    return g;
  }

  private kingPosInGrid(grid: ChessSquare[][], color: ChessColor): { x: number; y: number } | null {
    const alvo = `${color}k`;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (grid[y]?.[x] === alvo) return { x, y };
      }
    }
    return null;
  }

  /** Movimentos pseudo-legais de uma peça (podem deixar o rei em xeque). */
  private pseudoMoves(state: ChessState, x: number, y: number): ChessMove[] {
    const piece = this.pieceAt(state, x, y);
    if (!piece) return [];
    const color = colorOf(piece)!;
    const type = typeOf(piece)!;
    const moves: ChessMove[] = [];
    const push = (toX: number, toY: number, promotion?: ChessPieceType, castle?: "k" | "q") => {
      const data: ChessMove["data"] = { from: `${x}-${y}`, to: `${toX}-${toY}` };
      if (promotion) data.promotion = promotion;
      if (castle) data.castle = castle;
      moves.push({ playerId: color === "w" ? 0 : 1, type: "move", timestamp: 0, data });
    };

    if (type === "p") {
      const dir = color === "w" ? -1 : 1;
      const startRow = color === "w" ? 6 : 1;
      const lastRow = color === "w" ? 0 : 7;
      const oneY = y + dir;
      if (inside(x, oneY) && !this.pieceAt(state, x, oneY)) {
        if (oneY === lastRow) for (const p of ["q", "r", "b", "n"] as ChessPieceType[]) push(x, oneY, p);
        else push(x, oneY);
        const twoY = y + dir * 2;
        if (y === startRow && !this.pieceAt(state, x, twoY)) push(x, twoY);
      }
      for (const dx of [-1, 1]) {
        const cx = x + dx;
        const target = this.pieceAt(state, cx, oneY);
        const isEnPassant = state.customState.enPassant === `${cx}-${oneY}`;
        if (target && colorOf(target) !== color) {
          if (oneY === lastRow) for (const p of ["q", "r", "b", "n"] as ChessPieceType[]) push(cx, oneY, p);
          else push(cx, oneY);
        } else if (!target && isEnPassant) {
          push(cx, oneY);
        }
      }
      return moves;
    }

    if (type === "n") {
      for (const [dx, dy] of [
        [1, 2],
        [2, 1],
        [2, -1],
        [1, -2],
        [-1, -2],
        [-2, -1],
        [-2, 1],
        [-1, 2],
      ]) {
        const nx = x + dx!;
        const ny = y + dy!;
        if (!inside(nx, ny)) continue;
        const target = this.pieceAt(state, nx, ny);
        if (!target || colorOf(target) !== color) push(nx, ny);
      }
      return moves;
    }

    if (type === "k") {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (!inside(nx, ny)) continue;
          const target = this.pieceAt(state, nx, ny);
          if (!target || colorOf(target) !== color) push(nx, ny);
        }
      }
      // Roque (o xeque das casas é validado depois, em getValidMoves)
      const row = color === "w" ? 7 : 0;
      const rights = state.customState.castling;
      const canK = color === "w" ? rights.wk : rights.bk;
      const canQ = color === "w" ? rights.wq : rights.bq;
      if (y === row && x === 4) {
        if (canK && !this.pieceAt(state, 5, row) && !this.pieceAt(state, 6, row)) push(6, row, undefined, "k");
        if (canQ && !this.pieceAt(state, 3, row) && !this.pieceAt(state, 2, row) && !this.pieceAt(state, 1, row))
          push(2, row, undefined, "q");
      }
      return moves;
    }

    const dirs =
      type === "r"
        ? [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]
        : type === "b"
          ? [
              [1, 1],
              [1, -1],
              [-1, 1],
              [-1, -1],
            ]
          : [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
              [1, 1],
              [1, -1],
              [-1, 1],
              [-1, -1],
            ];
    for (const [dx, dy] of dirs) {
      let nx = x + dx!;
      let ny = y + dy!;
      while (inside(nx, ny)) {
        const target = this.pieceAt(state, nx, ny);
        if (!target) push(nx, ny);
        else {
          if (colorOf(target) !== color) push(nx, ny);
          break;
        }
        nx += dx!;
        ny += dy!;
      }
    }
    return moves;
  }

  /** Aplica a jogada no estado (sem validar legalidade plena). */
  private applyRaw(state: ChessState, move: ChessMove): ChessState {
    const next = this.clone(state);
    const cs = next.customState;
    const [fx, fy] = move.data.from.split("-").map(Number) as [number, number];
    const [tx, ty] = move.data.to.split("-").map(Number) as [number, number];
    const piece = cs.grid[fy]?.[fx] ?? null;
    if (!piece) return next;
    const color = colorOf(piece)!;
    const type = typeOf(piece)!;

    // En passant: peão captura na diagonal sem peça no destino
    const isEnPassant =
      type === "p" && fx !== tx && !this.pieceAt(state, tx, ty) && cs.enPassant === `${tx}-${ty}`;

    if (cs.grid[fy]) cs.grid[fy]![fx] = null;
    if (isEnPassant) {
      const capturedY = fy;
      if (cs.grid[capturedY]) cs.grid[capturedY]![tx] = null;
    }

    const promoted = move.data.promotion && type === "p" && (ty === 0 || ty === 7);
    cs.grid[ty]![tx] = promoted ? `${color}${move.data.promotion}` : piece;

    // Roque: move também a torre
    if (move.data.castle === "k") {
      const row = ty;
      cs.grid[row]![5] = cs.grid[row]![7] ?? null;
      cs.grid[row]![7] = null;
    } else if (move.data.castle === "q") {
      const row = ty;
      cs.grid[row]![3] = cs.grid[row]![0] ?? null;
      cs.grid[row]![0] = null;
    }

    // Atualiza direitos de roque
    if (type === "k") {
      if (color === "w") {
        cs.castling.wk = false;
        cs.castling.wq = false;
      } else {
        cs.castling.bk = false;
        cs.castling.bq = false;
      }
    }
    if (type === "r") {
      if (color === "w") {
        if (fx === 0) cs.castling.wq = false;
        if (fx === 7) cs.castling.wk = false;
      } else {
        if (fx === 0) cs.castling.bq = false;
        if (fx === 7) cs.castling.bk = false;
      }
    }
    // Torrezinha capturada nas quinas
    if (ty === 0 && tx === 0) cs.castling.wq = false;
    if (ty === 0 && tx === 7) cs.castling.wk = false;
    if (ty === 7 && tx === 0) cs.castling.bq = false;
    if (ty === 7 && tx === 7) cs.castling.bk = false;

    // Novo alvo de en passant
    cs.enPassant = type === "p" && Math.abs(ty - fy) === 2 ? `${tx}-${(ty + fy) / 2}` : null;
    cs.halfMoveClock = type === "p" || this.pieceAt(state, tx, ty) ? 0 : cs.halfMoveClock + 1;
    cs.turn = color === "w" ? "b" : "w";
    cs.check = this.inCheck(next, cs.turn) ? cs.turn : null;
    cs.lastSan = `${piece}${move.data.from}→${move.data.to}${promoted ? `=${move.data.promotion}` : ""}`;

    next.currentPlayer = cs.turn === "w" ? 0 : 1;
    next.pieces = this.syncPieces(next);
    next.round = Math.floor((next.moveHistory.length + 1) / 2) + 1;
    return next;
  }

  /** Filtra os movimentos que deixariam o próprio rei em xeque. */
  private legalMoves(state: ChessState, x: number, y: number): ChessMove[] {
    const piece = this.pieceAt(state, x, y);
    if (!piece) return [];
    const color = colorOf(piece)!;
    const legal: ChessMove[] = [];
    for (const move of this.pseudoMoves(state, x, y)) {
      const after = this.gridAfterMove(state, move);
      const king = this.kingPosInGrid(after, color);
      // Sem rei (não deveria acontecer numa partida legal) trata como xeque,
      // igual ao `inCheck`.
      if (!king || this.isAttacked(after, king.x, king.y, color === "w" ? "b" : "w")) continue;
      // O rei não pode atravessar casa atacada no roque
      if (move.data.castle) {
        const foe: ChessColor = color === "w" ? "b" : "w";
        const atual = this.kingPosInGrid(state.customState.grid, color);
        if (!atual || this.isAttacked(state.customState.grid, atual.x, atual.y, foe)) continue;
        const row = color === "w" ? 7 : 0;
        const pass = move.data.castle === "k" ? 5 : 3;
        const mid = this.gridAfterMove(state, {
          ...move,
          data: { from: move.data.from, to: `${pass}-${row}` },
        });
        if (this.isAttacked(mid, pass, row, foe)) continue;
      }
      legal.push(move);
    }
    return legal;
  }

  getValidMoves(state: UniversalGameState): GameMove[] {
    const s = state as ChessState;
    const color = s.customState.turn;
    const moves: GameMove[] = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const piece = s.customState.grid[y]?.[x] ?? null;
        if (!piece || colorOf(piece) !== color) continue;
        moves.push(...this.legalMoves(s, x, y));
      }
    }
    return moves;
  }

  applyMove(state: UniversalGameState, move: GameMove): UniversalGameState {
    const s = state as ChessState;
    const next = this.applyRaw(s, move as ChessMove);
    next.moveHistory = [...s.moveHistory, move];
    next.lastMove = move;

    // Fim de jogo: sem jogadas legais ⇒ mate (xeque) ou afogamento (empate)
    const nextMoves = this.getValidMoves(next);
    if (nextMoves.length === 0) {
      next.gameOver = true;
      next.reason = next.customState.check ? "checkmate" : "stalemate";
      next.winner = next.customState.check ? (next.customState.turn === "w" ? 1 : 0) : null;
    } else if (next.customState.halfMoveClock >= 100) {
      next.gameOver = true;
      next.reason = "fifty-move-rule";
      next.winner = null;
    }
    return next;
  }

  isGameOver(state: UniversalGameState): boolean {
    return state.gameOver;
  }

  getWinner(state: UniversalGameState): number | null {
    return state.winner;
  }

  /** Material + mobilidade + segurança do rei (negamax-friendly). */
  evaluate(state: UniversalGameState, player: number): number {
    const s = state as ChessState;
    if (s.gameOver) {
      if (s.winner === null) return 0;
      return s.winner === player ? 100_000 : -100_000;
    }

    let material = 0;
    let mobility = 0;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const piece = s.customState.grid[y]?.[x] ?? null;
        if (!piece) continue;
        const type = typeOf(piece)!;
        const value = PIECE_VALUES[type];
        const owner = colorOf(piece) === "w" ? 0 : 1;
        material += owner === player ? value : -value;
      }
    }

    // Mobilidade: barata e já embutida no cálculo de xeque.
    const myColor: ChessColor = player === 0 ? "w" : "b";
    const foeColor: ChessColor = player === 0 ? "b" : "w";
    mobility = this.attackedSquares(s, myColor).size - this.attackedSquares(s, foeColor).size;

    const checkBonus = this.inCheck(s, foeColor) ? 3 : 0;
    const checkPenalty = this.inCheck(s, myColor) ? 4 : 0;

    return material * 10 + mobility * 0.2 + checkBonus - checkPenalty;
  }

  getCurrentPlayer(state: UniversalGameState): number {
    return (state as ChessState).customState.turn === "w" ? 0 : 1;
  }

  moveKey(move: GameMove): string {
    const d = (move as ChessMove).data;
    return `${d.from}>${d.to}${d.promotion ?? ""}${d.castle ?? ""}`;
  }
}
