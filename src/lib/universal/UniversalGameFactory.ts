/**
 * Catálogo de jogos universais.
 *
 * Para adicionar um jogo:
 *  1. implemente `UniversalGameEngine` em `adapters/SeuJogoAdapter.ts`
 *  2. registre em `ADAPTERS` (abaixo) e em `GAMES_REGISTRY`
 *  3. crie a view em `src/components/universal/` e exponha no agregador
 *
 * A partir do registro, o jogo ganha IA genérica (MCTS) de graça.
 */
import {
  type GameCategory,
  type GameRegistry,
  type UniversalGameEngine,
  GAMES_REGISTRY,
} from "./UniversalGameEngine";
import { ChessAdapter } from "./adapters/ChessAdapter";
import { CheckersAdapter } from "./adapters/CheckersAdapter";
import { BlackjackAdapter } from "./adapters/BlackjackAdapter";
import { DominoAdapter } from "./adapters/DominoAdapter";
import { YahtzeeAdapter } from "./adapters/YahtzeeAdapter";
import { ConnectFourAdapter } from "./adapters/ConnectFourAdapter";
import { TicTacToeAdapter } from "./adapters/TicTacToeAdapter";
import { ReversiAdapter } from "./adapters/ReversiAdapter";
import { MancalaAdapter } from "./adapters/MancalaAdapter";

/** Jogo implementado: categoria + fábrica + metadados de UI. */
export interface PlayableGame {
  category: GameCategory;
  /** Nome curto usado na UI. */
  label: string;
  /** Descrição curta. */
  description: string;
  /** Categoria visual do agregador. */
  group: GameGroup;
  /** Rota/âncora do agregador (identificador estável na URL da Cidadela). */
  slug: string;
  minPlayers: number;
  maxPlayers: number;
  difficulty: "easy" | "medium" | "hard";
  /** Duração média em minutos. */
  avgDuration: number;
  /** Usa busca MCTS (a UI mostra o selo "IA Monte Carlo"). */
  usesMCTS: boolean;
}

export type GameGroup = "board" | "card" | "dice" | "domino";

export const GAME_GROUP_LABEL: Record<GameGroup, string> = {
  board: "Tabuleiro",
  card: "Cartas",
  dice: "Dados",
  domino: "Dominó",
};

/**
 * Registro dos adaptadores implementados.
 * A chave é a categoria do `GameCategory` usada em toda a aplicação.
 */
const ADAPTERS: Array<{ category: GameCategory; create: () => UniversalGameEngine }> = [
  { category: "board_chess", create: () => new ChessAdapter() },
  { category: "board_checkers", create: () => new CheckersAdapter() },
  { category: "card_blackjack", create: () => new BlackjackAdapter() },
  { category: "domino_block", create: () => new DominoAdapter() },
  { category: "domino_draw", create: () => new DominoAdapter() },
  { category: "dice_yahtzee", create: () => new YahtzeeAdapter() },
  { category: "board_connect_four", create: () => new ConnectFourAdapter() },
  { category: "board_tic_tac_toe", create: () => new TicTacToeAdapter() },
  { category: "board_reversi", create: () => new ReversiAdapter() },
  { category: "board_mancala", create: () => new MancalaAdapter() },
];

/** Metadados de UI dos jogos JOGÁVEIS (os demais só existem no registro). */
const PLAYABLE: PlayableGame[] = [
  {
    category: "board_chess",
    label: "Xadrez",
    description: "Tática clássica contra a IA",
    group: "board",
    slug: "xadrez",
    minPlayers: 2,
    maxPlayers: 2,
    difficulty: "hard",
    avgDuration: 30,
    usesMCTS: true,
  },
  {
    category: "board_checkers",
    label: "Dama",
    description: "Capturas em cadeia",
    group: "board",
    slug: "dama",
    minPlayers: 2,
    maxPlayers: 2,
    difficulty: "medium",
    avgDuration: 15,
    usesMCTS: true,
  },
  {
    category: "card_blackjack",
    label: "Blackjack",
    description: "21 pontos contra o dealer",
    group: "card",
    slug: "blackjack",
    minPlayers: 1,
    maxPlayers: 1,
    difficulty: "easy",
    avgDuration: 5,
    usesMCTS: false,
  },
  {
    category: "domino_block",
    label: "Dominó",
    description: "Encaixe peças nas pontas",
    group: "domino",
    slug: "domino",
    minPlayers: 2,
    maxPlayers: 4,
    difficulty: "medium",
    avgDuration: 15,
    usesMCTS: true,
  },
  {
    category: "board_connect_four",
    label: "Liga 4",
    description: "Alinhe quatro peças",
    group: "board",
    slug: "liga-4",
    minPlayers: 2,
    maxPlayers: 2,
    difficulty: "easy",
    avgDuration: 5,
    usesMCTS: true,
  },
  {
    category: "board_tic_tac_toe",
    label: "Jogo da Velha",
    description: "Três em linha",
    group: "board",
    slug: "jogo-da-velha",
    minPlayers: 2,
    maxPlayers: 2,
    difficulty: "easy",
    avgDuration: 2,
    usesMCTS: true,
  },
  {
    category: "board_reversi",
    label: "Reversi",
    description: "Vire peças do rival",
    group: "board",
    slug: "reversi",
    minPlayers: 2,
    maxPlayers: 2,
    difficulty: "medium",
    avgDuration: 15,
    usesMCTS: true,
  },
  {
    category: "board_mancala",
    label: "Mancala",
    description: "Semeie e capture",
    group: "board",
    slug: "mancala",
    minPlayers: 2,
    maxPlayers: 2,
    difficulty: "medium",
    avgDuration: 10,
    usesMCTS: true,
  },
  {
    category: "dice_yahtzee",
    label: "Yahtzee",
    description: "Combinações de dados",
    group: "dice",
    slug: "yahtzee",
    minPlayers: 1,
    maxPlayers: 4,
    difficulty: "easy",
    avgDuration: 10,
    usesMCTS: false,
  },
];

export class UniversalGameFactory {
  private static readonly adapters = new Map<GameCategory, () => UniversalGameEngine>();

  private static ensureInitialized(): void {
    if (this.adapters.size > 0) return;
    for (const entry of ADAPTERS) this.adapters.set(entry.category, entry.create);
  }

  /** Motor do jogo, ou null se o jogo não está implementado. */
  static createEngine(category: GameCategory): UniversalGameEngine | null {
    this.ensureInitialized();
    const factory = this.adapters.get(category);
    return factory ? factory() : null;
  }

  /** Estado inicial do jogo, ou null se não está implementado. */
  static createGame(
    category: GameCategory,
    playerCount: number,
    variant?: string,
  ): ReturnType<UniversalGameEngine["initializeGame"]> | null {
    const engine = this.createEngine(category);
    if (!engine) return null;
    return engine.initializeGame(category, playerCount, variant);
  }

  /** Jogos JOGÁVEIS (com adaptador e view). */
  static playableGames(): PlayableGame[] {
    return PLAYABLE;
  }

  /** Jogo jogável por slug do agregador. */
  static playableBySlug(slug: string): PlayableGame | null {
    return PLAYABLE.find((game) => game.slug === slug) ?? null;
  }

  /** Jogos jogáveis de um grupo. */
  static playableByGroup(group: GameGroup): PlayableGame[] {
    return PLAYABLE.filter((game) => game.group === group);
  }

  /** Jogos jogáveis que usam MCTS. */
  static mctsGames(): PlayableGame[] {
    return PLAYABLE.filter((game) => game.usesMCTS);
  }

  /** Metadados completos do registro (inclui jogos ainda não implementados). */
  static getGameInfo(category: GameCategory): GameRegistry | undefined {
    return GAMES_REGISTRY[category];
  }

  /** Todas as categorias registradas (60+). */
  static listGames(): GameCategory[] {
    return Object.keys(GAMES_REGISTRY) as GameCategory[];
  }

  /** Categorias registradas por prefixo (ex.: "board_"). */
  static listGamesByCategory(prefix: string): GameCategory[] {
    return this.listGames().filter((category) => category.startsWith(prefix));
  }

  /** O jogo tem adaptador implementado? */
  static isImplemented(category: GameCategory): boolean {
    this.ensureInitialized();
    return this.adapters.has(category);
  }

  /** O jogo é compatível com IA? */
  static isAICompatible(category: GameCategory): boolean {
    return GAMES_REGISTRY[category]?.aiCompatible ?? false;
  }

  /** O jogo se beneficia de MCTS? */
  static requiresMCTS(category: GameCategory): boolean {
    return GAMES_REGISTRY[category]?.requiresMCTS ?? false;
  }

  /** Registra um adaptador customizado em runtime (usado em testes). */
  static registerAdapter(category: GameCategory, factory: () => UniversalGameEngine): void {
    this.ensureInitialized();
    this.adapters.set(category, factory);
  }
}
