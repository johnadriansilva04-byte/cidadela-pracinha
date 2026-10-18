/**
 * Adaptador de BLACKJACK (21).
 *
 * Fluxo de uma rodada:
 *   1. `betting`  — o jogador aposta (a UI oferece os valores)
 *   2. `playing`  — o jogador pede carta (`hit`) ou para (`stand`)
 *   3. `dealer`   — o dealer compra até 17
 *   4. `settled`  — pagamento e resultado
 *
 * O estado expõe as mãos em `customState.playerHand` / `customState.dealerHand`
 * (mais legíveis que `players[].hand` para uma UI de mesa) e cada mão sabe o
 * seu total — a UI nunca recalcula regra de Ás.
 */
import {
  UniversalGameUtils,
  type GameCategory,
  type GameMove,
  type GamePiece,
  type UniversalGameEngine,
  type UniversalGameState,
} from "../UniversalGameEngine";

export interface BlackjackCard {
  /** "hearts" | "diamonds" | "clubs" | "spades" */
  suit: string;
  /** "A" | "2".."10" | "J" | "Q" | "K" */
  rank: string;
  /** Valor já resolvido para esta mão (Ás vale 1 ou 11). */
  value: number;
  faceUp: boolean;
}

export type BlackjackOutcome = "win" | "lose" | "push" | "blackjack" | "bust" | null;

export interface BlackjackCustomState {
  deck: BlackjackCard[];
  playerHand: BlackjackCard[];
  dealerHand: BlackjackCard[];
  /** Total da mão do jogador (Ás ajustado). */
  playerTotal: number;
  /** Total do dealer (a 2ª carta conta só depois do reveal). */
  dealerTotal: number;
  /** Aposta da rodada atual. */
  bet: number;
  chips: number;
  /** Resultado da rodada, quando liquidada. */
  outcome: BlackjackOutcome;
  /** O dealer já revelou a carta fechada? */
  dealerRevealed: boolean;
}

export interface BlackjackState extends UniversalGameState {
  customState: BlackjackCustomState;
}

const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const START_CHIPS = 1000;
const BET_OPTIONS = [10, 25, 50, 100];

/** Valor base de uma carta (Ás entra como 11 e a mão corrige). */
function baseValue(rank: string): number {
  if (rank === "A") return 11;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number(rank);
}

/** Total da mão com Ás rebaixado de 11 para 1 enquanto estourar. */
export function handTotal(hand: readonly BlackjackCard[]): number {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === "A") {
      aces++;
      total += 11;
    } else {
      total += baseValue(card.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function buildShoe(count: number): BlackjackCard[] {
  const cards: BlackjackCard[] = [];
  for (let d = 0; d < count; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ suit, rank, value: baseValue(rank), faceUp: true });
      }
    }
  }
  return UniversalGameUtils.shuffle(cards);
}

export class BlackjackAdapter implements UniversalGameEngine {
  initializeGame(category: GameCategory, playerCount: number, variant?: string): BlackjackState {
    const deck = buildShoe(2); // sapata de 2 baralhos
    const state: BlackjackState = {
      gameCategory: "card_blackjack",
      gameId: `blackjack-${Date.now()}`,
      players: [
        UniversalGameUtils.createPlayer(0, "Você", false),
        UniversalGameUtils.createPlayer(1, "Dealer", true),
      ],
      currentPlayer: 0,
      turnOrder: [0, 1],
      board: { type: "custom", customState: {} },
      pieces: [],
      deck: [],
      phase: "betting",
      round: 1,
      scores: { 0: 0, 1: 0 },
      resources: { 0: { chips: START_CHIPS } },
      activeRules: ["standard", "dealer-stands-17"],
      variant: variant ?? "standard",
      moveHistory: [],
      lastMove: null,
      gameOver: false,
      winner: null,
      reason: null,
      customState: {
        deck,
        playerHand: [],
        dealerHand: [],
        playerTotal: 0,
        dealerTotal: 0,
        bet: 0,
        chips: START_CHIPS,
        outcome: null,
        dealerRevealed: false,
      },
    };
    return state;
  }

  private clone(state: BlackjackState): BlackjackState {
    return UniversalGameUtils.cloneState(state) as BlackjackState;
  }

  private draw(state: BlackjackState): BlackjackCard | null {
    const card = state.customState.deck.pop();
    if (!card) return null;
    return { ...card };
  }

  getValidMoves(state: UniversalGameState): GameMove[] {
    const s = state as BlackjackState;
    if (s.gameOver) return [];

    if (s.phase === "betting") {
      return BET_OPTIONS.filter((amount) => amount <= s.customState.chips).map((amount) => ({
        playerId: 0,
        type: "bet" as const,
        timestamp: 0,
        data: { amount, action: "bet" },
      }));
    }

    if (s.phase === "playing") {
      const moves: GameMove[] = [];
      if (s.customState.playerTotal < 21) {
        moves.push({ playerId: 0, type: "draw", timestamp: 0, data: { action: "hit" } });
      }
      moves.push({ playerId: 0, type: "pass", timestamp: 0, data: { action: "stand" } });
      return moves;
    }

    if (s.phase === "settled") {
      return [{ playerId: 0, type: "custom", timestamp: 0, data: { action: "new-round" } }];
    }

    return [];
  }

  applyMove(state: UniversalGameState, move: GameMove): UniversalGameState {
    const s = state as BlackjackState;
    const action = String(move.data["action"] ?? "");

    if (s.phase === "betting" && (action === "bet" || move.type === "bet")) {
      const next = this.clone(s);
      const amount = Number(move.data["amount"] ?? 0);
      if (amount <= 0 || amount > next.customState.chips) return s;

      next.customState.bet = amount;
      next.customState.chips -= amount;
      next.customState.playerHand = [];
      next.customState.dealerHand = [];
      next.customState.outcome = null;
      next.customState.dealerRevealed = false;
      // Registrado antes de qualquer retorno antecipado (blackjack natural
      // encerra a rodada dentro desta mesma chamada).
      next.moveHistory = [...s.moveHistory, move];
      next.lastMove = move;

      // Duas cartas para cada lado; a 2ª do dealer fica fechada.
      for (let i = 0; i < 2; i++) {
        const pc = this.draw(next);
        if (pc) next.customState.playerHand.push(pc);
      }
      for (let i = 0; i < 2; i++) {
        const dc = this.draw(next);
        if (dc) {
          dc.faceUp = i === 0;
          next.customState.dealerHand.push(dc);
        }
      }
      next.customState.playerTotal = handTotal(next.customState.playerHand);
      next.customState.dealerTotal = handTotal(next.customState.dealerHand);
      next.phase = "playing";

      // Blackjack natural: 21 com duas cartas encerra na hora.
      if (next.customState.playerTotal === 21) {
        return this.settle(next, "blackjack");
      }
      return next;
    }

    if (s.phase === "playing" && action === "hit") {
      const next = this.clone(s);
      const card = this.draw(next);
      if (!card) return s;
      card.faceUp = true;
      next.customState.playerHand.push(card);
      next.customState.playerTotal = handTotal(next.customState.playerHand);
      next.moveHistory = [...s.moveHistory, move];
      next.lastMove = move;

      if (next.customState.playerTotal > 21) return this.settle(next, "bust");
      if (next.customState.playerTotal === 21) return this.settle(next, null);
      return next;
    }

    if (s.phase === "playing" && action === "stand") {
      const next = this.clone(s);
      next.moveHistory = [...s.moveHistory, move];
      next.lastMove = move;
      return this.settle(next, null);
    }

    if (action === "new-round") {
      const next = this.clone(s);
      next.phase = "betting";
      next.gameOver = false;
      next.winner = null;
      next.reason = null;
      next.customState.outcome = null;
      next.customState.playerHand = [];
      next.customState.dealerHand = [];
      next.customState.playerTotal = 0;
      next.customState.dealerTotal = 0;
      next.customState.bet = 0;
      next.customState.dealerRevealed = false;
      if (next.customState.chips < Math.min(...BET_OPTIONS)) {
        next.customState.chips = START_CHIPS; // recarrega para não travar a mesa
      }
      if (next.customState.deck.length < 26) next.customState.deck = buildShoe(2);
      next.round += 1;
      return next;
    }

    return s;
  }

  /** Dealer joga, compara as mãos e paga. */
  private settle(state: BlackjackState, forced: BlackjackOutcome): BlackjackState {
    const cs = state.customState;
    cs.dealerRevealed = true;
    for (const card of cs.dealerHand) card.faceUp = true;

    if (forced === "bust") {
      cs.outcome = "bust";
    } else {
      // Dealer compra até 17 (para em soft 17).
      while (cs.dealerTotal < 17) {
        const card = this.draw(state);
        if (!card) break;
        card.faceUp = true;
        cs.dealerHand.push(card);
        cs.dealerTotal = handTotal(cs.dealerHand);
      }
      cs.dealerTotal = handTotal(cs.dealerHand);

      const playerNatural = forced === "blackjack" && cs.playerHand.length === 2;
      const dealerNatural = cs.dealerTotal === 21 && cs.dealerHand.length === 2;

      if (playerNatural && dealerNatural) cs.outcome = "push";
      else if (playerNatural) cs.outcome = "blackjack";
      else if (dealerNatural) cs.outcome = "lose";
      else if (cs.dealerTotal > 21) cs.outcome = "win";
      else if (cs.playerTotal > cs.dealerTotal) cs.outcome = "win";
      else if (cs.playerTotal < cs.dealerTotal) cs.outcome = "lose";
      else cs.outcome = "push";
    }

    // Pagamento: blackjack 3:2, vitória 1:1, empate devolve a aposta.
    const bet = cs.bet;
    if (cs.outcome === "blackjack") cs.chips += Math.round(bet * 2.5);
    else if (cs.outcome === "win") cs.chips += bet * 2;
    else if (cs.outcome === "push") cs.chips += bet;

    if (state.players[0]) state.players[0].hand = [];

    state.phase = "settled";
    state.scores[0] = (state.scores[0] ?? 0) + (cs.chips - START_CHIPS);
    state.winner = cs.outcome === "win" || cs.outcome === "blackjack" ? 0 : null;
    state.reason = cs.outcome;
    state.round += 1;
    return state;
  }

  isGameOver(state: UniversalGameState): boolean {
    return state.gameOver;
  }

  getWinner(state: UniversalGameState): number | null {
    return state.winner;
  }

  /**
   * Estratégia básica do blackjack — usada como dica e como IA do dealer.
   * (Também serve de "suggestMove" para o motor genérico.)
   */
  suggestMove(state: UniversalGameState, player: number): GameMove | null {
    const s = state as BlackjackState;
    if (player !== 0) return null;
    const moves = this.getValidMoves(s);
    if (moves.length === 0) return null;

    if (s.phase === "betting") {
      const bet = moves.find((m) => Number(m.data["amount"]) === 25) ?? moves[0]!;
      return bet;
    }

    if (s.phase !== "playing") return moves[0]!;

    const total = s.customState.playerTotal;
    const dealerUp = s.customState.dealerHand[0]?.rank ?? "10";
    const dealerValue = baseValue(dealerUp) === 11 ? 11 : baseValue(dealerUp);
    const hit = moves.find((m) => m.data["action"] === "hit");
    const stand = moves.find((m) => m.data["action"] === "stand");

    // Regras simples de estratégia básica.
    if (total >= 17) return stand ?? moves[0]!;
    if (total >= 13 && dealerValue <= 6) return stand ?? moves[0]!;
    if (total === 12 && dealerValue >= 4 && dealerValue <= 6) return stand ?? moves[0]!;
    return hit ?? moves[0]!;
  }

  evaluate(state: UniversalGameState, player: number): number {
    const s = state as BlackjackState;
    const total = s.customState.playerTotal;
    if (total > 21) return -100;
    if (total === 21) return 100;
    return total;
  }

  getCurrentPlayer(state: UniversalGameState): number {
    return (state as BlackjackState).currentPlayer;
  }

  moveKey(move: GameMove): string {
    return `${String(move.data["action"] ?? move.type)}${move.data["amount"] ? `:${move.data["amount"]}` : ""}`;
  }
}
