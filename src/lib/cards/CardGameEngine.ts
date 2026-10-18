/**
 * Motor genérico para jogos de cartas.
 * Fornece a estrutura base para implementar qualquer jogo de cartas clássico.
 */
import { GameEngine, GameState, Move } from "../ai/GameEngine";

// ========================================
// TIPOS BASE DE CARTAS
// ========================================

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string; // Unique identifier (e.g., "A-hearts")
  faceUp?: boolean;
}

export interface Deck {
  cards: Card[];
  jokers?: number;
}

export type CardColor = "red" | "black";

// ========================================
// TIPOS DE JOGOS DE CARTAS
// ========================================

export type CardGameType =
  // Jogos de aposta/cassino
  | "poker"           // Texas Hold'em, Omaha, etc.
  | "blackjack"       // 21
  | "baccarat"        // Punto Banco
  | "casino_war"      // War contra a casa

  // Jogos de truco/bluff
  | "poker_draw"      // 5 Card Draw
  | "stud_poker"      // 7 Card Stud
  | "bullshit"        // Cheat
  | "president"       // Asshole

  // Jogos de formação de sequências
  | "rummy"           // Gin Rummy
  | "canasta"         // Canasta
  | "buraco"          // Buraco brasileiro
  | "cribbage"        // Cribbage

  // Jogos de truque/parceria
  | "bridge"          // Bridge
  | "whist"           // Whist
  | "hearts"          // Hearts
  | "spades"          // Spades
  | "euchre"          // Euchre
  | "truco"           // Truco brasileiro
  | "sueca"           // Sueca portuguesa
  | "vira"            // Vira brasileiro

  // Jogos de descarte
  | "uno"             // Uno
  | "crazy_eights"    // Crazy Eights
  | "mau_mau"         // Mau Mau
  | "pif_paf"         // Pif Paf brasileiro

  // Jogos de memória/empate
  | "war"             // War
  | "egyptian_ratscrew" // Egyptian Ratscrew
  | "old_maid"        // Velha (Old Maid)
  | "go_fish"         // Go Fish

  // Jogos solitários
  | "klondike"        // Solitário Klondike
  | "freecell"        // FreeCell
  | "spider"          // Spider Solitaire
  | "pyramid"         // Pyramid Solitaire

  // Jogos regionais brasileiros
  | "hole"            // Hole
  | "tranca"          // Tranca
  | "pif_paf"         // Pif Paf (já listado)
  | "canastra"        // Canasta brasileiro;

// ========================================
// ESTADO GENÉRICO DE JOGO DE CARTAS
// ========================================

export interface CardGameState extends GameState {
  gameType: CardGameType;
  deck: Deck;
  players: CardPlayer[];
  currentPlayer: number;
  phase: string; // "betting", "playing", "scoring", etc.
  round: number;
  pot?: number; // Para jogos de aposta
  communityCards?: Card[]; // Para Poker
  dealerPosition: number;
  gameOver: boolean;
  winner: number | null;
  // Estado específico do jogo (flexível)
  customState?: Record<string, any>;
}

export interface CardPlayer {
  id: number;
  name: string;
  hand: Card[];
  score: number;
  chips?: number; // Para jogos de aposta
  folded?: boolean;
  isBot?: boolean;
  // Estado específico do jogador
  customState?: Record<string, any>;
}

// ========================================
// MOVIMENTOS GENÉRICOS DE CARTAS
// ========================================

export type CardMove =
  | { type: "play"; card: Card; target?: number }
  | { type: "draw"; count: number }
  | { type: "discard"; card: Card }
  | { type: "pass" }
  | { type: "fold" }
  | { type: "bet"; amount: number }
  | { type: "call" }
  | { type: "raise"; amount: number }
  | { type: "check" }
  | { type: "swap"; cards: Card[] }
  | { type: "arrange"; hand: Card[] }
  | { type: "custom"; action: string; data?: any };

// ========================================
// INTERFACE GENÉRICA PARA JOGOS DE CARTAS
// ========================================

export interface CardGameEngine extends GameEngine<CardGameState, CardMove> {
  /**
   * Cria um baralho padrão de 52 cartas.
   */
  createStandardDeck(includeJokers?: boolean): Deck;

  /**
   * Embaralha o baralho.
   */
  shuffleDeck(deck: Deck): Deck;

  /**
   * Distribui cartas para os jogadores.
   */
  dealCards(state: CardGameState, count: number): CardGameState;

  /**
   * Valida se uma jogada é legal no contexto do jogo específico.
   */
  validateCardMove(state: CardGameState, move: CardMove): boolean;

  /**
   * Avalia a mão de um jogador (para jogos de pontuação).
   */
  evaluateHand(hand: Card[], context?: any): number;

  /**
   * Determina o vencedor de uma rodada.
   */
  determineRoundWinner(state: CardGameState): number | null;

  /**
   * Inicializa o estado do jogo com configuração específica.
   */
  initializeGame(gameType: CardGameType, playerCount: number): CardGameState;
}

// ========================================
// UTILITÁRIOS DE CARTAS
// ========================================

export class CardUtils {
  static createStandardDeck(includeJokers = false): Deck {
    const suits: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
    const ranks: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

    const cards: Card[] = [];
    let idCounter = 0;

    for (const suit of suits) {
      for (const rank of ranks) {
        cards.push({
          suit,
          rank,
          id: `${rank}-${suit}`,
          faceUp: false,
        });
        idCounter++;
      }
    }

    if (includeJokers) {
      cards.push({ suit: "hearts" as Suit, rank: "Joker" as Rank, id: "joker-1", faceUp: false });
      cards.push({ suit: "spades" as Suit, rank: "Joker" as Rank, id: "joker-2", faceUp: false });
    }

    return { cards, jokers: includeJokers ? 2 : 0 };
  }

  static shuffleDeck(deck: Deck): Deck {
    const shuffled = [...deck.cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return { cards: shuffled, jokers: deck.jokers };
  }

  static getCardValue(rank: Rank): number {
    const values: Record<Rank, number> = {
      "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
      "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
    };
    return values[rank] || 0;
  }

  static getCardColor(card: Card): CardColor {
    return card.suit === "hearts" || card.suit === "diamonds" ? "red" : "black";
  }

  static sortHand(hand: Card[]): Card[] {
    const suitOrder: Record<Suit, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
    return [...hand].sort((a, b) => {
      if (suitOrder[a.suit] !== suitOrder[b.suit]) {
        return suitOrder[a.suit] - suitOrder[b.suit];
      }
      return this.getCardValue(a.rank) - this.getCardValue(b.rank);
    });
  }

  static dealFromDeck(deck: Deck, count: number): { deck: Deck; cards: Card[] } {
    const cards = deck.cards.slice(0, count);
    const remaining = deck.cards.slice(count);
    return { deck: { cards: remaining, jokers: deck.jokers }, cards };
  }
}
