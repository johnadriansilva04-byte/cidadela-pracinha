/**
 * Adaptador de YAHTZEE.
 *
 * Fluxo do turno:
 *   1. `rolling`  — até 3 rolagens; o jogador segura os dados que quer manter
 *   2. `scoring`  — escolhe uma categoria ainda livre (mesmo valendo 0)
 *
 * O estado expõe `customState.dice`, `customState.held` e
 * `customState.rollsLeft` — exatamente o que a UI desenha — além das
 * cartelas por jogador (`scorecards`).
 */
import {
  UniversalGameUtils,
  type GameCategory,
  type GameMove,
  type UniversalGameEngine,
  type UniversalGameState,
} from "../UniversalGameEngine";

export const YAHTZEE_CATEGORIES = [
  "ones",
  "twos",
  "threes",
  "fours",
  "fives",
  "sixes",
  "three_of_kind",
  "four_of_kind",
  "full_house",
  "small_straight",
  "large_straight",
  "yahtzee",
  "chance",
] as const;

export type YahtzeeCategory = (typeof YAHTZEE_CATEGORIES)[number];

export interface YahtzeeCustomState {
  dice: number[];
  held: boolean[];
  rollsLeft: number;
  /** Cartela de cada jogador: categoria → pontos (null = ainda livre). */
  scorecards: Record<string, number | null>[];
}

export interface YahtzeeState extends UniversalGameState {
  customState: YahtzeeCustomState;
}

const DICE = 5;
const ROLLS_PER_TURN = 3;

function rollDie(rng: () => number): number {
  return Math.floor(rng() * 6) + 1;
}

function countDice(dice: readonly number[]): Record<number, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const d of dice) counts[d] = (counts[d] ?? 0) + 1;
  return counts;
}

/** Sequência de `length` valores consecutivos distintos? */
function hasStraight(dice: readonly number[], length: number): boolean {
  const unique = [...new Set(dice)].sort((a, b) => a - b);
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    if (unique[i] === (unique[i - 1] ?? 0) + 1) run++;
    else run = 1;
    if (run >= length) return true;
  }
  return run >= length;
}

/** Pontuação de uma categoria para um conjunto de dados. */
export function scoreCategory(dice: readonly number[], category: YahtzeeCategory): number {
  const counts = countDice(dice);
  const sum = dice.reduce((a, b) => a + b, 0);
  const values = Object.values(counts);

  switch (category) {
    case "ones":
      return (counts[1] ?? 0) * 1;
    case "twos":
      return (counts[2] ?? 0) * 2;
    case "threes":
      return (counts[3] ?? 0) * 3;
    case "fours":
      return (counts[4] ?? 0) * 4;
    case "fives":
      return (counts[5] ?? 0) * 5;
    case "sixes":
      return (counts[6] ?? 0) * 6;
    case "three_of_kind":
      return values.some((c) => c >= 3) ? sum : 0;
    case "four_of_kind":
      return values.some((c) => c >= 4) ? sum : 0;
    case "full_house":
      return values.includes(3) && values.includes(2) ? 25 : 0;
    case "small_straight":
      return hasStraight(dice, 4) ? 30 : 0;
    case "large_straight":
      return hasStraight(dice, 5) ? 40 : 0;
    case "yahtzee":
      return values.includes(5) ? 50 : 0;
    case "chance":
      return sum;
    default:
      return 0;
  }
}

function emptyScorecard(): Record<string, number | null> {
  const card: Record<string, number | null> = {};
  for (const category of YAHTZEE_CATEGORIES) card[category] = null;
  return card;
}

/** Total da cartela (bônus de +35 quando o bloco superior chega a 63). */
export function scorecardTotal(card: Record<string, number | null>): number {
  let total = 0;
  let upper = 0;
  for (const category of YAHTZEE_CATEGORIES) {
    const value = card[category] ?? 0;
    total += value;
    if (["ones", "twos", "threes", "fours", "fives", "sixes"].includes(category)) upper += value;
  }
  if (upper >= 63) total += 35;
  return total;
}

export class YahtzeeAdapter implements UniversalGameEngine {
  private rng: () => number = Math.random;

  /** Permite fixar o RNG nos testes. */
  setRNG(rng: () => number): void {
    this.rng = rng;
  }

  initializeGame(category: GameCategory, playerCount: number, variant?: string): YahtzeeState {
    const players = Math.max(1, Math.min(4, playerCount));
    return {
      gameCategory: "dice_yahtzee",
      gameId: `yahtzee-${Date.now()}`,
      players: Array.from({ length: players }, (_, i) =>
        UniversalGameUtils.createPlayer(i, i === 0 ? "Você" : `Jogador ${i}`, i > 0),
      ),
      currentPlayer: 0,
      turnOrder: Array.from({ length: players }, (_, i) => i),
      board: { type: "custom", customState: {} },
      pieces: [],
      deck: [],
      phase: "rolling",
      round: 1,
      scores: Object.fromEntries(Array.from({ length: players }, (_, i) => [i, 0])),
      activeRules: ["standard", "upper-bonus-63"],
      variant: variant ?? "standard",
      moveHistory: [],
      lastMove: null,
      gameOver: false,
      winner: null,
      reason: null,
      customState: {
        dice: Array.from({ length: DICE }, () => rollDie(this.rng)),
        held: Array.from({ length: DICE }, () => false),
        rollsLeft: ROLLS_PER_TURN,
        scorecards: Array.from({ length: players }, () => emptyScorecard()),
      },
    };
  }

  private clone(state: YahtzeeState): YahtzeeState {
    return UniversalGameUtils.cloneState(state) as YahtzeeState;
  }

  getValidMoves(state: UniversalGameState): GameMove[] {
    const s = state as YahtzeeState;
    if (s.gameOver) return [];
    const player = s.currentPlayer;
    const moves: GameMove[] = [];

    if (s.customState.rollsLeft > 0) {
      // Rolar mantendo os dados segurados (máscara de 5 bits).
      for (let mask = 0; mask < 32; mask++) {
        const keep: number[] = [];
        for (let i = 0; i < DICE; i++) if (mask & (1 << i)) keep.push(i);
        // Pular "manter todos" e "não manter nenhum" já foi coberto pelo mask 0.
        if (keep.length === DICE) continue;
        moves.push({
          playerId: player,
          type: "roll",
          timestamp: 0,
          data: { action: "roll", keep },
        });
      }
    }

    if (s.customState.rollsLeft === 0) {
      const card = s.customState.scorecards[player] ?? emptyScorecard();
      for (const category of YAHTZEE_CATEGORIES) {
        if (card[category] !== null) continue;
        moves.push({
          playerId: player,
          type: "custom",
          timestamp: 0,
          data: { action: "score", category },
        });
      }
    }

    return moves;
  }

  applyMove(state: UniversalGameState, move: GameMove): UniversalGameState {
    const s = state as YahtzeeState;
    const action = String(move.data["action"] ?? "");

    if (action === "roll") {
      const next = this.clone(s);
      const cs = next.customState;
      if (cs.rollsLeft <= 0) return s;

      const keep = Array.isArray(move.data["keep"]) ? (move.data["keep"] as number[]) : [];
      const held = Array.from({ length: DICE }, (_, i) => keep.includes(i));
      cs.dice = cs.dice.map((value, i) => (held[i] ? value : rollDie(this.rng)));
      cs.held = held;
      cs.rollsLeft -= 1;
      if (cs.rollsLeft === 0) next.phase = "scoring";

      next.moveHistory = [...s.moveHistory, move];
      next.lastMove = move;
      return next;
    }

    if (action === "hold") {
      // Segurar sem rolar (a UI também oferece esse caminho).
      const next = this.clone(s);
      const index = Number(move.data["diceIndex"] ?? -1);
      if (index < 0 || index >= DICE) return s;
      next.customState.held[index] = !next.customState.held[index];
      next.moveHistory = [...s.moveHistory, move];
      next.lastMove = move;
      return next;
    }

    if (action === "score") {
      const category = move.data["category"] as YahtzeeCategory;
      if (!YAHTZEE_CATEGORIES.includes(category)) return s;

      const next = this.clone(s);
      const cs = next.customState;
      const player = next.currentPlayer;
      const card = cs.scorecards[player];
      if (!card || card[category] !== null) return s;

      card[category] = scoreCategory(cs.dice, category);
      next.scores[player] = scorecardTotal(card);

      cs.dice = Array.from({ length: DICE }, () => 0);
      cs.held = Array.from({ length: DICE }, () => false);
      cs.rollsLeft = ROLLS_PER_TURN;
      next.phase = "rolling";

      next.moveHistory = [...s.moveHistory, move];
      next.lastMove = move;
      next.round = Math.floor(next.moveHistory.length / next.players.length) + 1;

      // Fim: todos os jogadores preencheram as 13 categorias.
      const done = cs.scorecards.every((c) =>
        YAHTZEE_CATEGORIES.every((cat) => c[cat] !== null),
      );
      if (done) {
        next.gameOver = true;
        next.reason = "all_categories_scored";
        let best = Number.NEGATIVE_INFINITY;
        let winner = 0;
        cs.scorecards.forEach((c, i) => {
          const total = scorecardTotal(c);
          if (total > best) {
            best = total;
            winner = i;
          }
        });
        next.winner = winner;
      } else {
        next.currentPlayer = (player + 1) % next.players.length;
      }

      return next;
    }

    return s;
  }

  isGameOver(state: UniversalGameState): boolean {
    return state.gameOver;
  }

  getWinner(state: UniversalGameState): number | null {
    return state.winner;
  }

  /** Pontuação da cartela, com peso para o bônus superior. */
  evaluate(state: UniversalGameState, player: number): number {
    const s = state as YahtzeeState;
    if (s.gameOver) {
      if (s.winner === null) return 0;
      return s.winner === player ? 100_000 : -100_000;
    }
    const mine = scorecardTotal(s.customState.scorecards[player] ?? {});
    let foeBest = 0;
    s.customState.scorecards.forEach((card, i) => {
      if (i === player) return;
      const total = scorecardTotal(card);
      if (total > foeBest) foeBest = total;
    });
    return (mine - foeBest) * 10;
  }

  getCurrentPlayer(state: UniversalGameState): number {
    return (state as YahtzeeState).currentPlayer;
  }

  moveKey(move: GameMove): string {
    return `${String(move.data["action"] ?? move.type)}:${String(move.data["category"] ?? "")}:${JSON.stringify(move.data["keep"] ?? "")}`;
  }
}
