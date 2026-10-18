/**
 * Adaptador para Xadrez (Chess)
 * Implementação completa para demonstrar o sistema universal.
 */
import { UniversalGameEngine, UniversalGameState, GameMove, UniversalGameUtils, GameBoard, GamePiece } from "../UniversalGameEngine";
import { GameEngine } from "../../ai/GameEngine";

export interface ChessState extends UniversalGameState {
  // Estado específico do xadrez
  customState: {
    castlingRights: Record<number, { kingSide: boolean; queenSide: boolean }>;
    enPassantTarget: string | null;
    halfMoveClock: number;
    fullMoveNumber: number;
  };
}

export interface ChessMove extends GameMove {
  type: "move" | "capture" | "castle" | "en_passant" | "promotion";
  from: string;
  to: string;
  piece: string;
  promotionPiece?: string;
}

export class ChessAdapter implements UniversalGameEngine {
  /**
   * Inicializa um jogo de xadrez.
   */
  initializeGame(category: string, playerCount: number, variant?: string): UniversalGameState {
    const board = this.setupChessBoard();
    const pieces = this.setupChessPieces();

    return {
      gameCategory: "board_chess" as any,
      gameId: `chess-${Date.now()}`,
      players: [0, 1].map((id) => UniversalGameUtils.createPlayer(id, id === 0 ? "Brancas" : "Pretas", id === 1)),
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
        castlingRights: {
          0: { kingSide: true, queenSide: true },
          1: { kingSide: true, queenSide: true },
        },
        enPassantTarget: null,
        halfMoveClock: 0,
        fullMoveNumber: 1,
      },
    };
  }

  /**
   * Configura o tabuleiro de xadrez (8x8).
   */
  private setupChessBoard(): GameBoard {
    return UniversalGameUtils.createGridBoard(8, 8);
  }

  /**
   * Configura as peças iniciais do xadrez.
   */
  private setupChessPieces(): GamePiece[] {
    const pieces: GamePiece[] = [];
    const pieceOrder = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

    // Peças brancas (jogador 0)
    for (let i = 0; i < 8; i++) {
      pieces.push({
        id: `white-rook-${i}`,
        type: "checker",
        owner: 0,
        position: { x: i, y: 0 },
        data: { pieceType: pieceOrder[i] },
      });
    }
    for (let i = 0; i < 8; i++) {
      pieces.push({
        id: `white-pawn-${i}`,
        type: "checker",
        owner: 0,
        position: { x: i, y: 1 },
        data: { pieceType: "pawn" },
      });
    }

    // Peças pretas (jogador 1)
    for (let i = 0; i < 8; i++) {
      pieces.push({
        id: `black-pawn-${i}`,
        type: "checker",
        owner: 1,
        position: { x: i, y: 6 },
        data: { pieceType: "pawn" },
      });
    }
    for (let i = 0; i < 8; i++) {
      pieces.push({
        id: `black-rook-${i}`,
        type: "checker",
        owner: 1,
        position: { x: i, y: 7 },
        data: { pieceType: pieceOrder[i] },
      });
    }

    return pieces;
  }

  /**
   * Retorna todas as jogadas legais para o estado atual.
   */
  getValidMoves(state: UniversalGameState): GameMove[] {
    const moves: GameMove[] = [];
    const player = state.currentPlayer;
    const playerPieces = state.pieces.filter((p) => p.owner === player);

    for (const piece of playerPieces) {
      const pieceMoves = this.getPieceMoves(state, piece);
      moves.push(...pieceMoves);
    }

    return moves;
  }

  /**
   * Retorna jogadas legais para uma peça específica.
   */
  private getPieceMoves(state: UniversalGameState, piece: GamePiece): GameMove[] {
    const moves: GameMove[] = [];
    const { x, y } = piece.position as { x: number; y: number };
    const pieceType = piece.data.pieceType;
    const player = piece.owner;
    const direction = player === 0 ? 1 : -1; // Brancas sobem, pretas descem

    switch (pieceType) {
      case "pawn":
        // Movimento para frente
        const forwardY = y + direction;
        if (this.isValidPosition(x, forwardY) && !this.getPieceAt(state, x, forwardY)) {
          moves.push(
            UniversalGameUtils.createMove(player, "move", {
              from: piece.id,
              to: `${x}-${forwardY}`,
              piece: pieceType,
            })
          );

          // Movimento duplo inicial
          const initialRow = player === 0 ? 1 : 6;
          if (y === initialRow && !this.getPieceAt(state, x, forwardY + direction)) {
            moves.push(
              UniversalGameUtils.createMove(player, "move", {
                from: piece.id,
                to: `${x}-${forwardY + direction}`,
                piece: pieceType,
              })
            );
          }
        }

        // Capturas diagonais
        for (const dx of [-1, 1]) {
          const captureX = x + dx;
          const captureY = y + direction;
          if (this.isValidPosition(captureX, captureY)) {
            const target = this.getPieceAt(state, captureX, captureY);
            if (target && target.owner !== player) {
              moves.push(
                UniversalGameUtils.createMove(player, "capture", {
                  from: piece.id,
                  to: `${captureX}-${captureY}`,
                  piece: pieceType,
                })
              );
            }
          }
        }
        break;

      case "rook":
        // Movimento em linha reta
        this.addLineMoves(state, piece, moves, [[0, 1], [0, -1], [1, 0], [-1, 0]]);
        break;

      case "bishop":
        // Movimento diagonal
        this.addLineMoves(state, piece, moves, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
        break;

      case "queen":
        // Movimento em linha + diagonal
        this.addLineMoves(state, piece, moves, [
          [0, 1], [0, -1], [1, 0], [-1, 0],
          [1, 1], [1, -1], [-1, 1], [-1, -1],
        ]);
        break;

      case "king":
        // Movimento 1 casa em qualquer direção
        for (const [dx, dy] of [
          [0, 1], [0, -1], [1, 0], [-1, 0],
          [1, 1], [1, -1], [-1, 1], [-1, -1],
        ]) {
          const newX = x + dx;
          const newY = y + dy;
          if (this.isValidPosition(newX, newY)) {
            const target = this.getPieceAt(state, newX, newY);
            if (!target || target.owner !== player) {
              moves.push(
                UniversalGameUtils.createMove(player, target ? "capture" : "move", {
                  from: piece.id,
                  to: `${newX}-${newY}`,
                  piece: pieceType,
                })
              );
            }
          }
        }
        break;

      case "knight":
        // Movimento em L
        for (const [dx, dy] of [
          [2, 1], [2, -1], [-2, 1], [-2, -1],
          [1, 2], [1, -2], [-1, 2], [-1, -2],
        ]) {
          const newX = x + dx;
          const newY = y + dy;
          if (this.isValidPosition(newX, newY)) {
            const target = this.getPieceAt(state, newX, newY);
            if (!target || target.owner !== player) {
              moves.push(
                UniversalGameUtils.createMove(player, target ? "capture" : "move", {
                  from: piece.id,
                  to: `${newX}-${newY}`,
                  piece: pieceType,
                })
              );
            }
          }
        }
        break;
    }

    return moves;
  }

  /**
   * Adiciona movimentos em linha (para torre, bispo, rainha).
   */
  private addLineMoves(state: UniversalGameState, piece: GamePiece, moves: GameMove[], directions: number[][]): void {
    const { x, y } = piece.position as { x: number; y: number };
    const player = piece.owner;

    for (const [dx, dy] of directions) {
      let newX = x + dx;
      let newY = y + dy;

      while (this.isValidPosition(newX, newY)) {
        const target = this.getPieceAt(state, newX, newY);
        if (!target) {
          moves.push(
            UniversalGameUtils.createMove(player, "move", {
              from: piece.id,
              to: `${newX}-${newY}`,
              piece: piece.data.pieceType,
            })
          );
        } else {
          if (target.owner !== player) {
            moves.push(
              UniversalGameUtils.createMove(player, "capture", {
                from: piece.id,
                to: `${newX}-${newY}`,
                piece: piece.data.pieceType,
              })
            );
          }
          break; // Bloqueado por peça
        }
        newX += dx;
        newY += dy;
      }
    }
  }

  /**
   * Verifica se uma posição é válida no tabuleiro.
   */
  private isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < 8 && y >= 0 && y < 8;
  }

  /**
   * Retorna a peça em uma posição específica.
   */
  private getPieceAt(state: UniversalGameState, x: number, y: number): GamePiece | null {
    return state.pieces.find((p) => {
      const pos = p.position as { x: number; y: number };
      return pos.x === x && pos.y === y;
    }) || null;
  }

  /**
   * Aplica uma jogada ao estado.
   */
  applyMove(state: UniversalGameState, move: GameMove): UniversalGameState {
    const newState = UniversalGameUtils.cloneState(state);
    const { from, to, piece } = move.data;

    // Encontra a peça
    const pieceIndex = newState.pieces.findIndex((p) => p.id === from);
    if (pieceIndex === -1) return state;

    const movedPiece = newState.pieces[pieceIndex]!;

    // Captura
    if (move.type === "capture") {
      const [toX, toY] = to.split("-").map(Number);
      const capturedIndex = newState.pieces.findIndex((p) => {
        const pos = p.position as { x: number; y: number };
        return pos.x === toX && pos.y === toY;
      });
      if (capturedIndex !== -1) {
        const captured = newState.pieces[capturedIndex]!;
        newState.pieces.splice(capturedIndex, 1);
        newState.players[newState.currentPlayer].captured.push(captured);
      }
    }

    // Move a peça
    const [toX, toY] = to.split("-").map(Number);
    movedPiece.position = { x: toX, toY };

    // Verifica promoção de peão
    if (piece === "pawn" && (toY === 0 || toY === 7)) {
      movedPiece.data.pieceType = "queen"; // Promoção automática para rainha
    }

    // Verifica xeque-mate (simplificado)
    const opponent = newState.currentPlayer === 0 ? 1 : 0;
    const opponentKing = newState.pieces.find(
      (p) => p.owner === opponent && p.data.pieceType === "king"
    );
    if (!opponentKing) {
      newState.gameOver = true;
      newState.winner = newState.currentPlayer;
      newState.reason = "checkmate";
    }

    // Troca turno
    newState.currentPlayer = opponent;
    newState.moveHistory.push(move);
    newState.lastMove = move;

    return newState;
  }

  /**
   * Verifica se o jogo acabou.
   */
  isGameOver(state: UniversalGameState): boolean {
    return state.gameOver;
  }

  /**
   * Retorna o vencedor.
   */
  getWinner(state: UniversalGameState): number | null {
    return state.winner;
  }

  /**
   * Avaliação heurística para IA.
   */
  evaluate(state: UniversalGameState, player: number): number {
    if (state.gameOver && state.winner === player) return 100000;
    if (state.gameOver && state.winner !== null) return -100000;

    // Contagem material simplificada
    const pieceValues: Record<string, number> = {
      pawn: 1,
      knight: 3,
      bishop: 3,
      rook: 5,
      queen: 9,
      king: 0,
    };

    let score = 0;
    for (const piece of state.pieces) {
      if (piece.owner === player) {
        score += pieceValues[piece.data.pieceType] || 0;
      } else {
        score -= pieceValues[piece.data.pieceType] || 0;
      }
    }

    return score;
  }

  /**
   * Retorna o jogador atual.
   */
  getCurrentPlayer(state: UniversalGameState): number {
    return state.currentPlayer;
  }
}
