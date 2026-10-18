/**
 * Adaptador para Damas (Checkers)
 * Jogo de tabuleiro clássico.
 */
import { UniversalGameEngine, UniversalGameState, GameMove, UniversalGameUtils, GamePiece } from "../UniversalGameEngine";

export interface CheckersState extends UniversalGameState {
  customState: {
    mandatoryCapture: boolean; // Captura obrigatória
  };
}

export class CheckersAdapter implements UniversalGameEngine {
  /**
   * Inicializa um jogo de damas.
   */
  initializeGame(category: string, playerCount: number, variant?: string): UniversalGameState {
    const board = UniversalGameUtils.createGridBoard(8, 8);
    const pieces = this.setupCheckersPieces();

    return {
      gameCategory: "board_checkers" as any,
      gameId: `checkers-${Date.now()}`,
      players: [0, 1].map((id) => UniversalGameUtils.createPlayer(id, id === 0 ? "Vermelho" : "Preto", id === 1)),
      currentPlayer: 0,
      turnOrder: [0, 1],
      board,
      pieces,
      phase: "playing",
      round: 1,
      scores: { 0: 0, 1: 0 },
      activeRules: ["standard"],
      variant: variant || "standard",
      moveHistory: [],
      lastMove: null,
      gameOver: false,
      winner: null,
      reason: null,
      customState: {
        mandatoryCapture: true,
      },
    };
  }

  /**
   * Configura as peças iniciais de damas.
   */
  private setupCheckersPieces(): GamePiece[] {
    const pieces: GamePiece[] = [];

    // Peças vermelhas (jogador 0) - linhas 0-2
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 8; x++) {
        if ((x + y) % 2 === 1) {
          pieces.push({
            id: `red-${x}-${y}`,
            type: "checker",
            owner: 0,
            position: { x, y },
            data: { isKing: false },
          });
        }
      }
    }

    // Peças pretas (jogador 1) - linhas 5-7
    for (let y = 5; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if ((x + y) % 2 === 1) {
          pieces.push({
            id: `black-${x}-${y}`,
            type: "checker",
            owner: 1,
            position: { x, y },
            data: { isKing: false },
          });
        }
      }
    }

    return pieces;
  }

  /**
   * Retorna jogadas legais.
   */
  getValidMoves(state: UniversalGameState): GameMove[] {
    const moves: GameMove[] = [];
    const player = state.currentPlayer;
    const playerPieces = state.pieces.filter((p) => p.owner === player);

    const captureMoves: GameMove[] = [];
    const regularMoves: GameMove[] = [];

    for (const piece of playerPieces) {
      const pieceMoves = this.getPieceMoves(state, piece);
      for (const move of pieceMoves) {
        if (move.type === "capture") {
          captureMoves.push(move);
        } else {
          regularMoves.push(move);
        }
      }
    }

    // Captura obrigatória
    if (state.customState.mandatoryCapture && captureMoves.length > 0) {
      return captureMoves;
    }

    return [...captureMoves, ...regularMoves];
  }

  /**
   * Retorna jogadas para uma peça.
   */
  private getPieceMoves(state: UniversalGameState, piece: GamePiece): GameMove[] {
    const moves: GameMove[] = [];
    const { x, y } = piece.position as { x: number; y: number };
    const player = piece.owner;
    const isKing = piece.data.isKing;
    const direction = player === 0 ? 1 : -1; // Vermelho sobe, preto desce

    // Movimentos diagonais
    const directions = isKing
      ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
      : [[1, direction], [-1, direction]];

    for (const [dx, dy] of directions) {
      const newX = x + dx;
      const newY = y + dy;

      if (this.isValidPosition(newX, newY)) {
        const target = this.getPieceAt(state, newX, newY);
        if (!target) {
          // Movimento normal
          moves.push(
            UniversalGameUtils.createMove(player, "move", {
              from: piece.id,
              to: `${newX}-${newY}`,
            })
          );
        } else if (target.owner !== player) {
          // Captura possível
          const jumpX = newX + dx;
          const jumpY = newY + dy;
          if (this.isValidPosition(jumpX, jumpY) && !this.getPieceAt(state, jumpX, jumpY)) {
            moves.push(
              UniversalGameUtils.createMove(player, "capture", {
                from: piece.id,
                to: `${jumpX}-${jumpY}`,
                captured: target.id,
              })
            );
          }
        }
      }
    }

    return moves;
  }

  /**
   * Verifica se posição é válida.
   */
  private isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < 8 && y >= 0 && y < 8;
  }

  /**
   * Retorna peça em posição.
   */
  private getPieceAt(state: UniversalGameState, x: number, y: number): GamePiece | null {
    return state.pieces.find((p) => {
      const pos = p.position as { x: number; y: number };
      return pos.x === x && pos.y === y;
    }) || null;
  }

  /**
   * Aplica jogada.
   */
  applyMove(state: UniversalGameState, move: GameMove): UniversalGameState {
    const newState = UniversalGameUtils.cloneState(state);
    const { from, to, captured } = move.data;
    const player = newState.currentPlayer;

    // Encontra peça
    const pieceIndex = newState.pieces.findIndex((p) => p.id === from);
    if (pieceIndex === -1) return state;

    const piece = newState.pieces[pieceIndex]!;
    const [toX, toY] = to.split("-").map(Number);

    // Move peça
    piece.position = { x: toX, y: toY };

    // Captura
    if (move.type === "capture" && captured) {
      const capturedIndex = newState.pieces.findIndex((p) => p.id === captured);
      if (capturedIndex !== -1) {
        const capturedPiece = newState.pieces[capturedIndex]!;
        newState.pieces.splice(capturedIndex, 1);
        newState.players[player].captured.push(capturedPiece);
      }
    }

    // Promoção a dama
    const promotionRow = player === 0 ? 7 : 0;
    if (toY === promotionRow && !piece.data.isKing) {
      piece.data.isKing = true;
    }

    // Verifica vitória
    const opponent = player === 0 ? 1 : 0;
    const opponentPieces = newState.pieces.filter((p) => p.owner === opponent);
    if (opponentPieces.length === 0) {
      newState.gameOver = true;
      newState.winner = player;
      newState.reason = "all_captured";
    }

    // Troca turno
    newState.currentPlayer = opponent;
    newState.moveHistory.push(move);
    newState.lastMove = move;

    return newState;
  }

  /**
   * Verifica se jogo acabou.
   */
  isGameOver(state: UniversalGameState): boolean {
    return state.gameOver;
  }

  /**
   * Retorna vencedor.
   */
  getWinner(state: UniversalGameState): number | null {
    return state.winner;
  }

  /**
   * Avaliação heurística.
   */
  evaluate(state: UniversalGameState, player: number): number {
    if (state.gameOver && state.winner === player) return 100000;
    if (state.gameOver && state.winner !== null) return -100000;

    const playerPieces = state.pieces.filter((p) => p.owner === player);
    const opponentPieces = state.pieces.filter((p) => p.owner !== player);

    let score = (playerPieces.length - opponentPieces.length) * 10;

    // Bonus por damas
    for (const piece of playerPieces) {
      if (piece.data.isKing) score += 5;
    }
    for (const piece of opponentPieces) {
      if (piece.data.isKing) score -= 5;
    }

    return score;
  }

  /**
   * Retorna jogador atual.
   */
  getCurrentPlayer(state: UniversalGameState): number {
    return state.currentPlayer;
  }
}
