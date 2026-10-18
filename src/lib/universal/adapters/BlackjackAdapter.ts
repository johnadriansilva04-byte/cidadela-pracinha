/**
 * Adaptador para Blackjack (21)
 * Jogo de cartas simples de aposta.
 */
import { UniversalGameEngine, UniversalGameState, GameMove, UniversalGameUtils, GamePiece } from "../UniversalGameEngine";

export interface BlackjackState extends UniversalGameState {
  customState: {
    dealerHand: GamePiece[];
    deck: GamePiece[];
    shoePenetration: number; // Quando embaralhar de novo
  };
}

export class BlackjackAdapter implements UniversalGameEngine {
  /**
   * Inicializa um jogo de blackjack.
   */
  initializeGame(category: string, playerCount: number, variant?: string): UniversalGameState {
    const deck = this.createDeck();
    const shuffledDeck = this.shuffleDeck(deck);

    return {
      gameCategory: "card_blackjack" as any,
      gameId: `blackjack-${Date.now()}`,
      players: Array.from({ length: playerCount }, (_, i) =>
        UniversalGameUtils.createPlayer(i, `Jogador ${i + 1}`, i > 0)
      ),
      currentPlayer: 0,
      turnOrder: Array.from({ length: playerCount }, (_, i) => i),
      board: { type: "custom", customState: {} },
      pieces: [],
      deck: { cards: shuffledDeck },
      phase: "betting",
      round: 1,
      scores: {},
      resources: {},
      activeRules: ["standard"],
      variant: variant || "standard",
      moveHistory: [],
      lastMove: null,
      gameOver: false,
      winner: null,
      reason: null,
      customState: {
        dealerHand: [],
        deck: shuffledDeck,
        shoePenetration: 0.75,
      },
    };
  }

  /**
   * Cria um baralho padrão de 52 cartas.
   */
  private createDeck(): GamePiece[] {
    const suits = ["hearts", "diamonds", "clubs", "spades"];
    const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
    const deck: GamePiece[] = [];

    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({
          id: `${rank}-${suit}`,
          type: "card",
          owner: null,
          data: { suit, rank, value: this.getCardValue(rank) },
        });
      }
    }

    return deck;
  }

  /**
   * Embaralha o baralho.
   */
  private shuffleDeck(deck: GamePiece[]): GamePiece[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Retorna o valor de uma carta no blackjack.
   */
  private getCardValue(rank: string): number {
    if (rank === "A") return 11;
    if (["K", "Q", "J"].includes(rank)) return 10;
    return parseInt(rank) || 0;
  }

  /**
   * Calcula o valor de uma mão (tratando Ás como 1 ou 11).
   */
  private calculateHandValue(hand: GamePiece[]): number {
    let value = 0;
    let aces = 0;

    for (const card of hand) {
      value += card.data.value;
      if (card.data.rank === "A") aces++;
    }

    // Ajusta Ás de 11 para 1 se estourar
    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }

    return value;
  }

  /**
   * Retorna jogadas legais.
   */
  getValidMoves(state: UniversalGameState): GameMove[] {
    const moves: GameMove[] = [];
    const player = state.currentPlayer;
    const hand = state.players[player].hand;
    const handValue = this.calculateHandValue(hand);

    if (state.phase === "betting") {
      // Fase de apostas
      for (const amount of [10, 25, 50, 100]) {
        moves.push(UniversalGameUtils.createMove(player, "bet", { amount }));
      }
    } else if (state.phase === "playing") {
      // Fase de jogo
      if (handValue < 21) {
        moves.push(UniversalGameUtils.createMove(player, "draw", { count: 1 }));
      }
      moves.push(UniversalGameUtils.createMove(player, "pass", {}));
    }

    return moves;
  }

  /**
   * Aplica uma jogada.
   */
  applyMove(state: UniversalGameState, move: GameMove): UniversalGameState {
    const newState = UniversalGameUtils.cloneState(state);
    const player = newState.currentPlayer;

    if (move.type === "bet") {
      // Aposta
      const amount = move.data.amount;
      if (!newState.resources) newState.resources = {};
      if (!newState.resources[player]) newState.resources[player] = {};
      newState.resources[player].chips = (newState.resources[player].chips || 1000) - amount;
      newState.resources[player].currentBet = amount;

      // Avança para o próximo jogador ou fase de jogo
      const nextPlayer = (player + 1) % newState.players.length;
      if (nextPlayer === 0) {
        newState.phase = "playing";
        // Distribui cartas iniciais
        this.dealInitialCards(newState);
      } else {
        newState.currentPlayer = nextPlayer;
      }
    } else if (move.type === "draw") {
      // Puxa carta
      const card = newState.customState.deck.pop();
      if (card) {
        newState.players[player].hand.push(card);
      }

      // Verifica estouro
      const handValue = this.calculateHandValue(newState.players[player].hand);
      if (handValue > 21) {
        newState.players[player].eliminated = true;
      }
    } else if (move.type === "pass") {
      // Passa (stand)
      newState.players[player].eliminated = true; // Marcado como "parou"
    }

    newState.moveHistory.push(move);
    newState.lastMove = move;

    // Verifica se todos jogaram
    const allPlayed = newState.players.every((p) => p.eliminated || p.hand.length > 0);
    if (allPlayed && newState.phase === "playing") {
      // Vez do dealer
      this.playDealer(newState);
    }

    return newState;
  }

  /**
   * Distribui cartas iniciais.
   */
  private dealInitialCards(state: UniversalGameState): void {
    // 2 cartas para cada jogador
    for (const player of state.players) {
      for (let i = 0; i < 2; i++) {
        const card = state.customState.deck.pop();
        if (card) player.hand.push(card);
      }
    }

    // 2 cartas para o dealer (1 virada)
    for (let i = 0; i < 2; i++) {
      const card = state.customState.deck.pop();
      if (card) {
        card.data.faceUp = i === 0; // Primeira carta virada
        state.customState.dealerHand.push(card);
      }
    }
  }

  /**
   * Dealer joga até 17 ou mais.
   */
  private playDealer(state: UniversalGameState): void {
    while (this.calculateHandValue(state.customState.dealerHand) < 17) {
      const card = state.customState.deck.pop();
      if (card) {
        card.data.faceUp = true;
        state.customState.dealerHand.push(card);
      }
    }

    // Determina vencedores
    const dealerValue = this.calculateHandValue(state.customState.dealerHand);
    const dealerBusted = dealerValue > 21;

    for (const player of state.players) {
      if (player.isBot) continue;

      const playerValue = this.calculateHandValue(player.hand);
      const playerBusted = playerValue > 21;

      if (playerBusted) {
        // Jogador estourou, perde
        state.scores[player.id] = -1;
      } else if (dealerBusted) {
        // Dealer estourou, jogador ganha
        state.scores[player.id] = 1;
      } else if (playerValue > dealerValue) {
        // Jogador vence
        state.scores[player.id] = 1;
      } else if (playerValue < dealerValue) {
        // Dealer vence
        state.scores[player.id] = -1;
      } else {
        // Empate
        state.scores[player.id] = 0;
      }
    }

    state.gameOver = true;
    state.winner = Object.entries(state.scores).find(([_, score]) => score === 1)?.[0] ? 0 : null;
    state.reason = "round_complete";
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
   * Avaliação heurística (simplificada para blackjack).
   */
  evaluate(state: UniversalGameState, player: number): number {
    const handValue = this.calculateHandValue(state.players[player].hand);
    if (handValue > 21) return -100;
    if (handValue === 21) return 100;
    return handValue;
  }

  /**
   * Retorna o jogador atual.
   */
  getCurrentPlayer(state: UniversalGameState): number {
    return state.currentPlayer;
  }
}
