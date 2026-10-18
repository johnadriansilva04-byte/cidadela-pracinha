/**
 * Adaptador para Yahtzee
 * Jogo de dados com combinações.
 */
import { UniversalGameEngine, UniversalGameState, GameMove, UniversalGameUtils } from "../UniversalGameEngine";

export interface YahtzeeState extends UniversalGameState {
  customState: {
    dice: number[];
    rollsLeft: number;
    categories: Record<number, string[]>; // Categorias marcadas por jogador
  };
}

export class YahtzeeAdapter implements UniversalGameEngine {
  /**
   * Inicializa um jogo de Yahtzee.
   */
  initializeGame(category: string, playerCount: number, variant?: string): UniversalGameState {
    return {
      gameCategory: "dice_yahtzee" as any,
      gameId: `yahtzee-${Date.now()}`,
      players: Array.from({ length: playerCount }, (_, i) =>
        UniversalGameUtils.createPlayer(i, `Jogador ${i + 1}`, i > 0)
      ),
      currentPlayer: 0,
      turnOrder: Array.from({ length: playerCount }, (_, i) => i),
      board: { type: "custom", customState: {} },
      pieces: [],
      phase: "rolling",
      round: 1,
      scores: {},
      activeRules: ["standard"],
      variant: variant || "standard",
      moveHistory: [],
      lastMove: null,
      gameOver: false,
      winner: null,
      reason: null,
      customState: {
        dice: [0, 0, 0, 0, 0],
        rollsLeft: 3,
        categories: {},
      },
    };
  }

  /**
   * Rola os dados.
   */
  private rollDice(keep?: number[]): number[] {
    const dice: number[] = [];
    for (let i = 0; i < 5; i++) {
      if (keep && keep.includes(i)) {
        dice[i] = 0; // Mantém (será preenchido depois)
      } else {
        dice[i] = Math.floor(Math.random() * 6) + 1;
      }
    }
    return dice;
  }

  /**
   * Retorna jogadas legais.
   */
  getValidMoves(state: UniversalGameState): GameMove[] {
    const moves: GameMove[] = [];
    const player = state.currentPlayer;

    if (state.phase === "rolling" && state.customState.rollsLeft > 0) {
      // Pode rolar
      moves.push(UniversalGameUtils.createMove(player, "roll", { keep: [] }));

      // Pode rolar mantendo alguns dados
      for (let i = 1; i < 32; i++) {
        const keep: number[] = [];
        for (let j = 0; j < 5; j++) {
          if (i & (1 << j)) keep.push(j);
        }
        if (keep.length > 0 && keep.length < 5) {
          moves.push(UniversalGameUtils.createMove(player, "roll", { keep }));
        }
      }
    }

    if (state.phase === "scoring") {
      // Pode marcar categoria
      const availableCategories = this.getAvailableCategories(state, player);
      for (const category of availableCategories) {
        moves.push(UniversalGameUtils.createMove(player, "custom", { action: "score", category }));
      }
    }

    return moves;
  }

  /**
   * Retorna categorias disponíveis para marcar.
   */
  private getAvailableCategories(state: UniversalGameState, player: number): string[] {
    const marked = state.customState.categories[player] || [];
    const allCategories = [
      "ones", "twos", "threes", "fours", "fives", "sixes",
      "three_of_kind", "four_of_kind", "full_house", "small_straight",
      "large_straight", "yahtzee", "chance",
    ];
    return allCategories.filter((c) => !marked.includes(c));
  }

  /**
   * Calcula pontuação de uma categoria.
   */
  private calculateCategoryScore(dice: number[], category: string): number {
    const counts = this.countDice(dice);

    switch (category) {
      case "ones":
        return counts[1] * 1;
      case "twos":
        return counts[2] * 2;
      case "threes":
        return counts[3] * 3;
      case "fours":
        return counts[4] * 4;
      case "fives":
        return counts[5] * 5;
      case "sixes":
        return counts[6] * 6;
      case "three_of_kind":
        return Object.values(counts).some((c) => c >= 3) ? dice.reduce((a, b) => a + b, 0) : 0;
      case "four_of_kind":
        return Object.values(counts).some((c) => c >= 4) ? dice.reduce((a, b) => a + b, 0) : 0;
      case "full_house":
        return Object.values(counts).includes(3) && Object.values(counts).includes(2) ? 25 : 0;
      case "small_straight":
        return this.hasStraight(dice, 4) ? 30 : 0;
      case "large_straight":
        return this.hasStraight(dice, 5) ? 40 : 0;
      case "yahtzee":
        return Object.values(counts).includes(5) ? 50 : 0;
      case "chance":
        return dice.reduce((a, b) => a + b, 0);
      default:
        return 0;
    }
  }

  /**
   * Conta dados por valor.
   */
  private countDice(dice: number[]): Record<number, number> {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const d of dice) {
      counts[d]++;
    }
    return counts;
  }

  /**
   * Verifica sequência.
   */
  private hasStraight(dice: number[], length: number): boolean {
    const unique = [...new Set(dice)].sort((a, b) => a - b);
    let consecutive = 1;
    for (let i = 1; i < unique.length; i++) {
      if (unique[i] === unique[i - 1] + 1) {
        consecutive++;
      } else {
        consecutive = 1;
      }
      if (consecutive >= length) return true;
    }
    return false;
  }

  /**
   * Aplica jogada.
   */
  applyMove(state: UniversalGameState, move: GameMove): UniversalGameState {
    const newState = UniversalGameUtils.cloneState(state);
    const player = newState.currentPlayer;

    if (move.type === "roll") {
      const { keep } = move.data;
      const newDice = this.rollDice(keep);

      // Preenche dados mantidos
      if (keep) {
        for (const i of keep) {
          newDice[i] = state.customState.dice[i];
        }
      }

      newState.customState.dice = newDice;
      newState.customState.rollsLeft--;

      if (newState.customState.rollsLeft === 0) {
        newState.phase = "scoring";
      }
    } else if (move.type === "custom" && move.data.action === "score") {
      const { category } = move.data;
      const score = this.calculateCategoryScore(newState.customState.dice, category);

      if (!newState.customState.categories[player]) {
        newState.customState.categories[player] = [];
      }
      newState.customState.categories[player].push(category);
      newState.scores[player] = (newState.scores[player] || 0) + score;

      // Reseta para próximo turno
      newState.customState.dice = [0, 0, 0, 0, 0];
      newState.customState.rollsLeft = 3;
      newState.phase = "rolling";

      // Verifica fim de jogo (13 categorias)
      if (newState.customState.categories[player].length >= 13) {
        const nextPlayer = (player + 1) % newState.players.length;
        if (nextPlayer === 0) {
          newState.gameOver = true;
          newState.winner = this.calculateWinner(newState);
          newState.reason = "all_categories_scored";
        } else {
          newState.currentPlayer = nextPlayer;
        }
      } else {
        newState.currentPlayer = (player + 1) % newState.players.length;
      }
    }

    newState.moveHistory.push(move);
    newState.lastMove = move;

    return newState;
  }

  /**
   * Calcula vencedor.
   */
  private calculateWinner(state: UniversalGameState): number {
    let maxScore = -Infinity;
    let winner = 0;

    for (const player of state.players) {
      const score = state.scores[player.id] || 0;
      if (score > maxScore) {
        maxScore = score;
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
    const score = state.scores[player] || 0;
    const categoriesMarked = state.customState.categories[player]?.length || 0;
    return score + categoriesMarked * 10;
  }

  /**
   * Retorna jogador atual.
   */
  getCurrentPlayer(state: UniversalGameState): number {
    return state.currentPlayer;
  }
}
