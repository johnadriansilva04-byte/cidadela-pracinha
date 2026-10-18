/**
 * Adaptador para Dominó
 * Jogo de encaixe de peças.
 */
import { UniversalGameEngine, UniversalGameState, GameMove, UniversalGameUtils, GamePiece } from "../UniversalGameEngine";

export interface DominoState extends UniversalGameState {
  customState: {
    leftEnd: number;
    rightEnd: number;
    boneyard: GamePiece[];
  };
}

export class DominoAdapter implements UniversalGameEngine {
  /**
   * Inicializa um jogo de dominó.
   */
  initializeGame(category: string, playerCount: number, variant?: string): UniversalGameState {
    const boneyard = this.createDominoSet();

    return {
      gameCategory: "domino_block" as any,
      gameId: `domino-${Date.now()}`,
      players: Array.from({ length: playerCount }, (_, i) =>
        UniversalGameUtils.createPlayer(i, `Jogador ${i + 1}`, i > 0)
      ),
      currentPlayer: 0,
      turnOrder: Array.from({ length: playerCount }, (_, i) => i),
      board: { type: "custom", customState: {} },
      pieces: [],
      deck: { cards: boneyard },
      phase: "dealing",
      round: 1,
      scores: {},
      activeRules: ["standard"],
      variant: variant || "block",
      moveHistory: [],
      lastMove: null,
      gameOver: false,
      winner: null,
      reason: null,
      customState: {
        leftEnd: -1,
        rightEnd: -1,
        boneyard,
      },
    };
  }

  /**
   * Cria um conjunto de dominó (duplo-6).
   */
  private createDominoSet(): GamePiece[] {
    const pieces: GamePiece[] = [];
    let id = 0;

    for (let i = 0; i <= 6; i++) {
      for (let j = i; j <= 6; j++) {
        pieces.push({
          id: `domino-${i}-${j}`,
          type: "domino",
          owner: null,
          data: { left: i, right: j },
        });
        id++;
      }
    }

    return this.shuffleDominoes(pieces);
  }

  /**
   * Embaralha dominós.
   */
  private shuffleDominoes(pieces: GamePiece[]): GamePiece[] {
    const shuffled = [...pieces];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Distribui peças iniciais.
   */
  private dealInitialPieces(state: UniversalGameState): UniversalGameState {
    const newState = UniversalGameUtils.cloneState(state);
    const piecesPerPlayer = 7;

    for (const player of newState.players) {
      for (let i = 0; i < piecesPerPlayer; i++) {
        const piece = newState.customState.boneyard.pop();
        if (piece) {
          piece.owner = player.id;
          player.hand.push(piece);
        }
      }
    }

    newState.phase = "playing";
    return newState;
  }

  /**
   * Retorna jogadas legais.
   */
  getValidMoves(state: UniversalGameState): GameMove[] {
    const moves: GameMove[] = [];
    const player = state.currentPlayer;
    const hand = state.players[player].hand;

    if (state.phase === "dealing") {
      // Primeira jogada - qualquer peça
      for (const piece of hand) {
        moves.push(
          UniversalGameUtils.createMove(player, "play", {
            pieceId: piece.id,
            side: "left",
          })
        );
      }
    } else {
      // Jogadas normais
      const { leftEnd, rightEnd } = state.customState;

      for (const piece of hand) {
        const { left, right } = piece.data;

        // Verifica se encaixa na esquerda
        if (left === leftEnd || right === leftEnd) {
          moves.push(
            UniversalGameUtils.createMove(player, "play", {
              pieceId: piece.id,
              side: "left",
              flipped: right === leftEnd,
            })
          );
        }

        // Verifica se encaixa na direita
        if (left === rightEnd || right === rightEnd) {
          moves.push(
            UniversalGameUtils.createMove(player, "play", {
              pieceId: piece.id,
              side: "right",
              flipped: left === rightEnd,
            })
          );
        }
      }

      // Comprar do boneyard (se variante draw)
      if (state.variant === "draw" && state.customState.boneyard.length > 0) {
        moves.push(UniversalGameUtils.createMove(player, "draw", { count: 1 }));
      }

      // Passar se não tiver jogada
      if (moves.length === 0) {
        moves.push(UniversalGameUtils.createMove(player, "pass", {}));
      }
    }

    return moves;
  }

  /**
   * Aplica jogada.
   */
  applyMove(state: UniversalGameState, move: GameMove): UniversalGameState {
    const newState = UniversalGameUtils.cloneState(state);
    const player = newState.currentPlayer;

    if (state.phase === "dealing") {
      // Distribui peças e volta
      return this.dealInitialPieces(state);
    }

    if (move.type === "draw") {
      // Compra peça
      const piece = newState.customState.boneyard.pop();
      if (piece) {
        piece.owner = player;
        newState.players[player].hand.push(piece);
      }
    } else if (move.type === "play") {
      const { pieceId, side, flipped } = move.data;
      const pieceIndex = newState.players[player].hand.findIndex((p) => p.id === pieceId);
      if (pieceIndex === -1) return state;

      const piece = newState.players[player].hand[pieceIndex]!;
      newState.players[player].hand.splice(pieceIndex, 1);

      // Adiciona ao tabuleiro
      newState.pieces.push(piece);

      // Atualiza extremidades
      const { left, right } = piece.data;
      if (flipped) {
        piece.data.left = right;
        piece.data.right = left;
      }

      if (state.phase === "dealing" || newState.pieces.length === 1) {
        newState.customState.leftEnd = piece.data.left;
        newState.customState.rightEnd = piece.data.right;
      } else if (side === "left") {
        newState.customState.leftEnd = piece.data.left;
      } else {
        newState.customState.rightEnd = piece.data.right;
      }
    } else if (move.type === "pass") {
      // Passa turno
    }

    // Verifica vitória
    if (newState.players[player].hand.length === 0) {
      newState.gameOver = true;
      newState.winner = player;
      newState.reason = "domino";
    }

    // Verifica bloqueio
    const allPassed = newState.moveHistory.slice(-newState.players.length).every((m) => m.type === "pass");
    if (allPassed && newState.pieces.length > 0) {
      newState.gameOver = true;
      newState.winner = this.calculateWinnerByPips(newState);
      newState.reason = "blocked";
    }

    newState.currentPlayer = (player + 1) % newState.players.length;
    newState.moveHistory.push(move);
    newState.lastMove = move;

    return newState;
  }

  /**
   * Calcula vencedor por pontos quando bloqueado.
   */
  private calculateWinnerByPips(state: UniversalGameState): number {
    let minPips = Infinity;
    let winner = 0;

    for (const player of state.players) {
      const pips = player.hand.reduce((sum, piece) => sum + piece.data.left + piece.data.right, 0);
      if (pips < minPips) {
        minPips = pips;
        winner = player.id;
      }
    }

    return winner;
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

    const handPips = state.players[player].hand.reduce(
      (sum, piece) => sum + piece.data.left + piece.data.right,
      0
    );

    // Menos pontos = melhor
    return -handPips;
  }

  /**
   * Retorna jogador atual.
   */
  getCurrentPlayer(state: UniversalGameState): number {
    return state.currentPlayer;
  }
}
