/**
 * Factory para criar instâncias de jogos universais.
 * Centraliza a criação de adaptadores para todos os jogos.
 */
import { UniversalGameEngine, UniversalGameState, GameCategory, GAMES_REGISTRY } from "./UniversalGameEngine";
import { ChessAdapter } from "./adapters/ChessAdapter";
import { BlackjackAdapter } from "./adapters/BlackjackAdapter";
import { CheckersAdapter } from "./adapters/CheckersAdapter";
import { DominoAdapter } from "./adapters/DominoAdapter";
import { YahtzeeAdapter } from "./adapters/YahtzeeAdapter";

export class UniversalGameFactory {
  private static adapters: Map<GameCategory, () => UniversalGameEngine> = new Map();

  /**
   * Registra adaptadores para cada jogo.
   */
  static initialize() {
    // Jogos de Tabuleiro
    this.adapters.set("board_chess", () => new ChessAdapter());
    this.adapters.set("board_checkers", () => new CheckersAdapter());

    // Jogos de Cartas
    this.adapters.set("card_blackjack", () => new BlackjackAdapter());

    // Jogos de Dominó
    this.adapters.set("domino_block", () => new DominoAdapter());
    this.adapters.set("domino_draw", () => new DominoAdapter());

    // Jogos de Dados
    this.adapters.set("dice_yahtzee", () => new YahtzeeAdapter());

    // TODO: Adicionar mais adaptadores conforme implementados
    // this.adapters.set("board_go", () => new GoAdapter());
    // this.adapters.set("board_reversi", () => new ReversiAdapter());
    // this.adapters.set("card_poker", () => new PokerAdapter());
    // this.adapters.set("mahjong_riichi", () => new MahjongAdapter());
    // etc.
  }

  /**
   * Cria uma instância do motor para um jogo específico.
   */
  static createEngine(category: GameCategory): UniversalGameEngine | null {
    this.initialize();
    const adapterFactory = this.adapters.get(category);
    return adapterFactory ? adapterFactory() : null;
  }

  /**
   * Inicializa um jogo específico.
   */
  static createGame(category: GameCategory, playerCount: number, variant?: string): UniversalGameState | null {
    const engine = this.createEngine(category);
    if (!engine) return null;

    return engine.initializeGame(category, playerCount, variant);
  }

  /**
   * Retorna informações sobre um jogo.
   */
  static getGameInfo(category: GameCategory) {
    return GAMES_REGISTRY[category];
  }

  /**
   * Lista todos os jogos disponíveis.
   */
  static listGames(): GameCategory[] {
    return Object.keys(GAMES_REGISTRY) as GameCategory[];
  }

  /**
   * Lista jogos por categoria.
   */
  static listGamesByCategory(prefix: string): GameCategory[] {
    return this.listGames().filter((cat) => cat.startsWith(prefix));
  }

  /**
   * Verifica se um jogo é compatível com IA.
   */
  static isAICompatible(category: GameCategory): boolean {
    const info = this.getGameInfo(category);
    return info?.aiCompatible || false;
  }

  /**
   * Verifica se um jogo requer MCTS.
   */
  static requiresMCTS(category: GameCategory): boolean {
    const info = this.getGameInfo(category);
    return info?.requiresMCTS || false;
  }

  /**
   * Registra um adaptador customizado.
   */
  static registerAdapter(category: GameCategory, factory: () => UniversalGameEngine): void {
    this.adapters.set(category, factory);
  }
}

// Inicializa automaticamente
UniversalGameFactory.initialize();
