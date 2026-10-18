/**
 * MOTOR UNIVERSAL DE JOGOS CLÁSSICOS
 * Base genérica para TODOS os tipos de jogos: cartas, tabuleiros, dados, dominó, mahjong, etc.
 */

// ========================================
// CATEGORIAS DE JOGOS
// ========================================

export type GameCategory =
  // Jogos de Cartas
  | "card_poker"          // Texas Hold'em, Omaha, Draw, Stud
  | "card_blackjack"      // 21
  | "card_baccarat"       // Punto Banco
  | "card_rummy"          // Gin Rummy, Canasta, Buraco
  | "card_trick"          // Bridge, Hearts, Spades, Truco, Sueca
  | "card_discard"        // Uno, Crazy Eights, Mau Mau
  | "card_memory"         // War, Go Fish, Old Maid
  | "card_solitaire"      // Klondike, FreeCell, Spider

  // Jogos de Tabuleiro
  | "board_chess"         // Xadrez
  | "board_checkers"      // Damas
  | "board_go"            // Go
  | "board_reversi"       // Othello/Reversi
  | "board_mancala"       // Mancala/Kalah
  | "board_backgammon"    // Gamão
  | "board_nine_mens_morris" // Trilha/Jogo da Velha Avançado
  | "board_connect_four"  // Liga 4
  | "board_tic_tac_toe"   // Jogo da Velha
  | "board_chinese_checkers" // Ludo chinês
  | "board_snakes_ladders" // Cobras e Escadas
  | "board_ludo"          // Ludo
  | "board_monopoly"      // Monopoly

  // Jogos de Dados
  | "dice_yahtzee"        // Yahtzee
  | "dice_farkle"         // Farkle
  | "dice_crap"           // Craps
  | "dice_pig"            // Pig
  | "dice_ships"          // Batalha Naval com dados
  | "dice_liars_dice"     // Liar's Dice
  | "dice_mia"            // Mia
  | "dice_chuck_a_luck"   // Chuck-a-Luck

  // Jogos de Dominó
  | "domino_block"        // Dominó bloco
  | "domino_draw"         // Dominó compra
  | "domino_all_fives"    // All Fives
  | "domino_mexican_train" // Trem Mexicano
  | "domino_matador"      // Matador

  // Jogos de Mahjong/Penhasco
  | "mahjong_riichi"      // Mahjong Riichi japonês
  | "mahjong_hong_kong"   // Mahjong Hong Kong
  | "mahjong_chinese"     // Mahjong chinês clássico
  | "mahjong_solitaire"   // Mahjong solitário

  // Jogos de Palavras
  | "word_scrabble"       // Scrabble
  | "word_boggle"         // Boggle
  | "word_crossword"      // Palavras cruzadas
  | "word_hangman"        // Forca

  // Jogos de Estratégia/Abstract
  | "abstract_chess_variants"  // Variantes de xadrez
  | "abstract_hex"             // Hex
  | "abstract_dots_boxes"     // Pontos e Caixas
  | "abstract_nim"             // Nim
  | "abstract_chomp"           // Chomp

  // Jogos de Ação/Reflexo (se aplicável)
  | "action_jenga"         // Jenga
  | "action_twister"       // Twister

  // Jogos de Roleplaying/Card (TCG)
  | "tcg_magic"           // Magic: The Gathering
  | "tcg_pokemon"         // Pokémon TCG
  | "tcg_yugioh"          // Yu-Gi-Oh!

  // Jogos Party/Social
  | "party_codenames"     // Codenames
  | "party_dixit"         // Dixit
  | "party_telestrations" // Telestrations
  | "party_warewolf"      // Lobisomem
  | "party_mafia"         // Mafia

  // Jogos Regionais Brasileiros
  | "brasil_truco"       // Truco
  | "brasil_sueca"        // Sueca
  | "brasil_buraco"       // Buraco
  | "brasil_tranca"       // Tranca
  | "brasil_pif_paf"      // Pif Paf
  | "brasil_hole"         // Hole
  | "brasil_maluco"       // Maluco;

// ========================================
// TIPOS BASE DE PEÇAS (Universal)
// ========================================

export type PieceType =
  | "card"           // Carta
  | "checker"        // Peça de dama/xadrez
  | "stone"          // Pedra de Go
  | "die"            // Dado
  | "domino"         // Peça de dominó
  | "tile"           // Peça de mahjong
  | "letter"         // Letra (Scrabble)
  | "pawn"           // Peão genérico
  | "token"          // Ficha/marcador
  | "custom";        // Personalizado

export interface GamePiece {
  id: string;
  type: PieceType;
  owner: number | null; // null = neutro/pool
  position?: { x: number; y: number } | number; // Posição no tabuleiro
  data: Record<string, any>; // Dados específicos da peça
}

// ========================================
// ESTADO UNIVERSAL DE JOGO
// ========================================

export interface UniversalGameState {
  // Identificação
  gameCategory: GameCategory;
  gameId: string;

  // Jogadores
  players: UniversalPlayer[];
  currentPlayer: number;
  turnOrder: number[];

  // Tabuleiro/Campo de Jogo
  board: GameBoard;
  pieces: GamePiece[];
  deck?: GamePiece[]; // Pool de peças (baralho, saco de dominó, etc.)

  // Estado do jogo
  phase: string;
  round: number;
  subRound?: number;

  // Pontuação/Recursos
  scores: Record<number, number>;
  resources?: Record<number, Record<string, number>>; // Fichas, dinheiro, etc.

  // Regras ativas
  activeRules: string[];
  variant?: string; // Variante específica do jogo

  // Histórico
  moveHistory: GameMove[];
  lastMove: GameMove | null;

  // Estado de fim
  gameOver: boolean;
  winner: number | null;
  reason: string | null;

  // Estado customizável (para jogos específicos)
  customState: Record<string, any>;
}

export interface UniversalPlayer {
  id: number;
  name: string;
  isBot: boolean;
  hand: GamePiece[]; // Peças na mão do jogador
  captured: GamePiece[]; // Peças capturadas
  eliminated: boolean;
  // Estado customizável
  customState: Record<string, any>;
}

export interface GameBoard {
  type: "grid" | "hex" | "graph" | "custom";
  width?: number;
  height?: number;
  cells?: BoardCell[];
  edges?: BoardEdge[];
  // Estado customizável do tabuleiro
  customState: Record<string, any>;
}

export interface BoardCell {
  id: string;
  position: { x: number; y: number };
  content: GamePiece | null;
  neighbors: string[];
  customData: Record<string, any>;
}

export interface BoardEdge {
  from: string;
  to: string;
  weight?: number;
  customData: Record<string, any>;
}

// ========================================
// MOVIMENTOS UNIVERSAIS
// ========================================

export interface GameMove {
  playerId: number;
  type: MoveType;
  timestamp: number;
  data: Record<string, any>;
}

export type MoveType =
  | "place"          // Colocar peça
  | "move"           // Mover peça
  | "capture"        // Capturar peça
  | "remove"         // Remover peça
  | "draw"           // Puxar peça do deck
  | "discard"        // Descartar peça
  | "play"           // Jogar peça
  | "pass"           // Passar turno
  | "bet"            // Apostar
  | "fold"           // Desistir
  | "trade"          // Trocar peças
  | "roll"           // Rolar dados
  | "bid"            // Dar lance
  | "challenge"      // Desafiar
  | "custom";        // Ação customizada

// ========================================
// INTERFACE UNIVERSAL (extends GameEngine)
// ========================================

import { GameEngine, GameState, Move } from "../ai/GameEngine";

export interface UniversalGameEngine extends GameEngine<UniversalGameState, GameMove> {
  /**
   * Inicializa um jogo específico com configuração.
   */
  initializeGame(category: GameCategory, playerCount: number, variant?: string): UniversalGameState;

  /**
   * Retorna todas as jogadas legais para o estado atual.
   */
  getValidMoves(state: UniversalGameState): GameMove[];

  /**
   * Aplica uma jogada ao estado.
   */
  applyMove(state: UniversalGameState, move: GameMove): UniversalGameState;

  /**
   * Verifica se o jogo acabou.
   */
  isGameOver(state: UniversalGameState): boolean;

  /**
   * Retorna o vencedor.
   */
  getWinner(state: UniversalGameState): number | null;

  /**
   * Avaliação heurística para IA.
   */
  evaluate(state: UniversalGameState, player: number): number;

  /**
   * Retorna o jogador atual.
   */
  getCurrentPlayer(state: UniversalGameState): number;

  // --- Métodos específicos por categoria ---

  /**
   * Para jogos de cartas: criar baralho.
   */
  createCardDeck?(variant?: string): GamePiece[];

  /**
   * Para jogos de tabuleiro: configurar tabuleiro.
   */
  setupBoard?(category: GameCategory, variant?: string): GameBoard;

  /**
   * Para jogos de dados: rolar dados.
   */
  rollDice?(count: number, sides: number): number[];

  /**
   * Para jogos de pontuação: calcular pontuação.
   */
  calculateScore?(state: UniversalGameState, playerId: number): number;

  /**
   * Validação específica do jogo.
   */
  validateGameSpecificMove?(state: UniversalGameState, move: GameMove): boolean;
}

// ========================================
// UTILITÁRIOS UNIVERSAIS
// ========================================

export class UniversalGameUtils {
  static createPlayer(id: number, name: string, isBot = false): UniversalPlayer {
    return {
      id,
      name,
      isBot,
      hand: [],
      captured: [],
      eliminated: false,
      customState: {},
    };
  }

  static createGridBoard(width: number, height: number): GameBoard {
    const cells: BoardCell[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const id = `${x}-${y}`;
        const neighbors: string[] = [];
        // Vizinhos ortogonais
        if (x > 0) neighbors.push(`${x-1}-${y}`);
        if (x < width - 1) neighbors.push(`${x+1}-${y}`);
        if (y > 0) neighbors.push(`${x}-${y-1}`);
        if (y < height - 1) neighbors.push(`${x}-${y+1}`);
        // Vizinhos diagonais (opcional)
        if (x > 0 && y > 0) neighbors.push(`${x-1}-${y-1}`);
        if (x < width - 1 && y > 0) neighbors.push(`${x+1}-${y-1}`);
        if (x > 0 && y < height - 1) neighbors.push(`${x-1}-${y+1}`);
        if (x < width - 1 && y < height - 1) neighbors.push(`${x+1}-${y+1}`);

        cells.push({
          id,
          position: { x, y },
          content: null,
          neighbors,
          customData: {},
        });
      }
    }

    return {
      type: "grid",
      width,
      height,
      cells,
      customState: {},
    };
  }

  static findPieceById(pieces: GamePiece[], id: string): GamePiece | null {
    return pieces.find((p) => p.id === id) || null;
  }

  static findPiecesByOwner(pieces: GamePiece[], owner: number): GamePiece[] {
    return pieces.filter((p) => p.owner === owner);
  }

  static createMove(playerId: number, type: MoveType, data: Record<string, any> = {}): GameMove {
    return {
      playerId,
      type,
      timestamp: Date.now(),
      data,
    };
  }

  static cloneState(state: UniversalGameState): UniversalGameState {
    return JSON.parse(JSON.stringify(state));
  }

  static getPieceAtCell(board: GameBoard, x: number, y: number): GamePiece | null {
    if (!board.cells) return null;
    const cell = board.cells.find((c) => c.position.x === x && c.position.y === y);
    return cell?.content || null;
  }

  static setPieceAtCell(board: GameBoard, x: number, y: number, piece: GamePiece | null): void {
    if (!board.cells) return;
    const cell = board.cells.find((c) => c.position.x === x && c.position.y === y);
    if (cell) cell.content = piece;
  }
}

// ========================================
// REGISTRO DE JOGOS
// ========================================

export interface GameRegistry {
  name: string;
  category: GameCategory;
  minPlayers: number;
  maxPlayers: number;
  recommendedPlayers: number;
  difficulty: "easy" | "medium" | "hard";
  avgDuration: number; // em minutos
  description: string;
  aiCompatible: boolean;
  requiresMCTS: boolean;
  customRules?: string[];
}

export const GAMES_REGISTRY: Record<GameCategory, GameRegistry> = {
  // Cartas - Poker
  card_poker: {
    name: "Poker (Texas Hold'em)",
    category: "card_poker",
    minPlayers: 2,
    maxPlayers: 10,
    recommendedPlayers: 6,
    difficulty: "hard",
    avgDuration: 30,
    description: "Jogo de apostas com cartas combinatórias",
    aiCompatible: true,
    requiresMCTS: true,
  },
  card_blackjack: {
    name: "Blackjack (21)",
    category: "card_blackjack",
    minPlayers: 1,
    maxPlayers: 7,
    recommendedPlayers: 3,
    difficulty: "easy",
    avgDuration: 5,
    description: "Chegue o mais próximo de 21 sem estourar",
    aiCompatible: true,
    requiresMCTS: false,
  },
  card_baccarat: {
    name: "Baccarat",
    category: "card_baccarat",
    minPlayers: 1,
    maxPlayers: 14,
    recommendedPlayers: 6,
    difficulty: "easy",
    avgDuration: 5,
    description: "Aposte em Player, Banker ou Tie",
    aiCompatible: true,
    requiresMCTS: false,
  },
  card_rummy: {
    name: "Gin Rummy",
    category: "card_rummy",
    minPlayers: 2,
    maxPlayers: 4,
    recommendedPlayers: 2,
    difficulty: "medium",
    avgDuration: 15,
    description: "Forme grupos e sequências",
    aiCompatible: true,
    requiresMCTS: true,
  },
  card_trick: {
    name: "Bridge/Hearts/Spades",
    category: "card_trick",
    minPlayers: 2,
    maxPlayers: 4,
    recommendedPlayers: 4,
    difficulty: "hard",
    avgDuration: 20,
    description: "Jogos de truco/parceria",
    aiCompatible: true,
    requiresMCTS: true,
  },
  card_discard: {
    name: "Uno/Crazy Eights",
    category: "card_discard",
    minPlayers: 2,
    maxPlayers: 10,
    recommendedPlayers: 4,
    difficulty: "easy",
    avgDuration: 15,
    description: "Descarte cartas combinando cor/número",
    aiCompatible: true,
    requiresMCTS: false,
  },
  card_memory: {
    name: "War/Go Fish",
    category: "card_memory",
    minPlayers: 2,
    maxPlayers: 6,
    recommendedPlayers: 2,
    difficulty: "easy",
    avgDuration: 10,
    description: "Jogos de memória e empate",
    aiCompatible: true,
    requiresMCTS: false,
  },
  card_solitaire: {
    name: "Solitário Klondike",
    category: "card_solitaire",
    minPlayers: 1,
    maxPlayers: 1,
    recommendedPlayers: 1,
    difficulty: "medium",
    avgDuration: 10,
    description: "Jogo solitário de cartas",
    aiCompatible: false,
    requiresMCTS: false,
  },

  // Tabuleiros
  board_chess: {
    name: "Xadrez",
    category: "board_chess",
    minPlayers: 2,
    maxPlayers: 2,
    recommendedPlayers: 2,
    difficulty: "hard",
    avgDuration: 30,
    description: "Jogo de estratégia clássico",
    aiCompatible: true,
    requiresMCTS: true,
  },
  board_checkers: {
    name: "Damas",
    category: "board_checkers",
    minPlayers: 2,
    maxPlayers: 2,
    recommendedPlayers: 2,
    difficulty: "medium",
    avgDuration: 20,
    description: "Capture todas as peças do oponente",
    aiCompatible: true,
    requiresMCTS: true,
  },
  board_go: {
    name: "Go",
    category: "board_go",
    minPlayers: 2,
    maxPlayers: 2,
    recommendedPlayers: 2,
    difficulty: "hard",
    avgDuration: 45,
    description: "Jogo de estratégia oriental",
    aiCompatible: true,
    requiresMCTS: true,
  },
  board_reversi: {
    name: "Othello/Reversi",
    category: "board_reversi",
    minPlayers: 2,
    maxPlayers: 2,
    recommendedPlayers: 2,
    difficulty: "medium",
    avgDuration: 15,
    description: "Capture território com peças",
    aiCompatible: true,
    requiresMCTS: true,
  },
  board_mancala: {
    name: "Mancala/Kalah",
    category: "board_mancala",
    minPlayers: 2,
    maxPlayers: 2,
    recommendedPlayers: 2,
    difficulty: "medium",
    avgDuration: 10,
    description: "Jogo de sementes africanas",
    aiCompatible: true,
    requiresMCTS: true,
  },
  board_backgammon: {
    name: "Gamão",
    category: "board_backgammon",
    minPlayers: 2,
    maxPlayers: 2,
    recommendedPlayers: 2,
    difficulty: "medium",
    avgDuration: 20,
    description: "Remova suas peças primeiro",
    aiCompatible: true,
    requiresMCTS: true,
  },
  board_nine_mens_morris: {
    name: "Trilha",
    category: "board_nine_mens_morris",
    minPlayers: 2,
    maxPlayers: 2,
    recommendedPlayers: 2,
    difficulty: "medium",
    avgDuration: 15,
    description: "Forme trilhas e capture peças",
    aiCompatible: true,
    requiresMCTS: true,
  },
  board_connect_four: {
    name: "Liga 4",
    category: "board_connect_four",
    minPlayers: 2,
    maxPlayers: 2,
    recommendedPlayers: 2,
    difficulty: "easy",
    avgDuration: 5,
    description: "Conecte 4 peças em linha",
    aiCompatible: true,
    requiresMCTS: true,
  },
  board_tic_tac_toe: {
    name: "Jogo da Velha",
    category: "board_tic_tac_toe",
    minPlayers: 2,
    maxPlayers: 2,
    recommendedPlayers: 2,
    difficulty: "easy",
    avgDuration: 2,
    description: "Linha de 3 para vencer",
    aiCompatible: true,
    requiresMCTS: false,
  },
  board_chinese_checkers: {
    name: "Ludo Chinês",
    category: "board_chinese_checkers",
    minPlayers: 2,
    maxPlayers: 6,
    recommendedPlayers: 4,
    difficulty: "medium",
    avgDuration: 20,
    description: "Mova peças para o lado oposto",
    aiCompatible: true,
    requiresMCTS: true,
  },
  board_snakes_ladders: {
    name: "Cobras e Escadas",
    category: "board_snakes_ladders",
    minPlayers: 2,
    maxPlayers: 6,
    recommendedPlayers: 4,
    difficulty: "easy",
    avgDuration: 15,
    description: "Sorte com dados",
    aiCompatible: true,
    requiresMCTS: false,
  },
  board_ludo: {
    name: "Ludo",
    category: "board_ludo",
    minPlayers: 2,
    maxPlayers: 4,
    recommendedPlayers: 4,
    difficulty: "easy",
    avgDuration: 20,
    description: "Leve peças ao centro",
    aiCompatible: true,
    requiresMCTS: false,
  },
  board_monopoly: {
    name: "Monopoly",
    category: "board_monopoly",
    minPlayers: 2,
    maxPlayers: 8,
    recommendedPlayers: 4,
    difficulty: "medium",
    avgDuration: 60,
    description: "Compre propriedades e domine",
    aiCompatible: true,
    requiresMCTS: false,
  },

  // Dados
  dice_yahtzee: {
    name: "Yahtzee",
    category: "dice_yahtzee",
    minPlayers: 1,
    maxPlayers: 10,
    recommendedPlayers: 4,
    difficulty: "medium",
    avgDuration: 15,
    description: "Forme combinações com 5 dados",
    aiCompatible: true,
    requiresMCTS: false,
  },
  dice_farkle: {
    name: "Farkle",
    category: "dice_farkle",
    minPlayers: 2,
    maxPlayers: 8,
    recommendedPlayers: 4,
    difficulty: "medium",
    avgDuration: 15,
    description: "Acumule pontos com dados",
    aiCompatible: true,
    requiresMCTS: false,
  },
  dice_crap: {
    name: "Craps",
    category: "dice_crap",
    minPlayers: 1,
    maxPlayers: 20,
    recommendedPlayers: 10,
    difficulty: "medium",
    avgDuration: 5,
    description: "Aposte no resultado dos dados",
    aiCompatible: true,
    requiresMCTS: false,
  },
  dice_pig: {
    name: "Pig",
    category: "dice_pig",
    minPlayers: 2,
    maxPlayers: 10,
    recommendedPlayers: 4,
    difficulty: "easy",
    avgDuration: 10,
    description: "Acumule ou pare antes de estourar",
    aiCompatible: true,
    requiresMCTS: false,
  },
  dice_ships: {
    name: "Batalha Naval (dados)",
    category: "dice_ships",
    minPlayers: 2,
    maxPlayers: 2,
    recommendedPlayers: 2,
    difficulty: "medium",
    avgDuration: 15,
    description: "Afunde navios com dados",
    aiCompatible: true,
    requiresMCTS: false,
  },
  dice_liars_dice: {
    name: "Liar's Dice",
    category: "dice_liars_dice",
    minPlayers: 2,
    maxPlayers: 10,
    recommendedPlayers: 4,
    difficulty: "medium",
    avgDuration: 15,
    description: "Bluff sobre os dados",
    aiCompatible: true,
    requiresMCTS: true,
  },
  dice_mia: {
    name: "Mia",
    category: "dice_mia",
    minPlayers: 2,
    maxPlayers: 10,
    recommendedPlayers: 4,
    difficulty: "medium",
    avgDuration: 10,
    description: "Adivinhe a combinação",
    aiCompatible: true,
    requiresMCTS: false,
  },
  dice_chuck_a_luck: {
    name: "Chuck-a-Luck",
    category: "dice_chuck_a_luck",
    minPlayers: 1,
    maxPlayers: 20,
    recommendedPlayers: 10,
    difficulty: "easy",
    avgDuration: 2,
    description: "Aposte nos dados",
    aiCompatible: true,
    requiresMCTS: false,
  },

  // Dominó
  domino_block: {
    name: "Dominó (Bloco)",
    category: "domino_block",
    minPlayers: 2,
    maxPlayers: 4,
    recommendedPlayers: 4,
    difficulty: "medium",
    avgDuration: 15,
    description: "Encaixe peças de dominó",
    aiCompatible: true,
    requiresMCTS: true,
  },
  domino_draw: {
    name: "Dominó (Compra)",
    category: "domino_draw",
    minPlayers: 2,
    maxPlayers: 4,
    recommendedPlayers: 4,
    difficulty: "medium",
    avgDuration: 20,
    description: "Compre se não puder jogar",
    aiCompatible: true,
    requiresMCTS: true,
  },
  domino_all_fives: {
    name: "All Fives",
    category: "domino_all_fives",
    minPlayers: 2,
    maxPlayers: 4,
    recommendedPlayers: 4,
    difficulty: "hard",
    avgDuration: 20,
    description: "Pontue múltiplos de 5",
    aiCompatible: true,
    requiresMCTS: true,
  },
  domino_mexican_train: {
    name: "Trem Mexicano",
    category: "domino_mexican_train",
    minPlayers: 2,
    maxPlayers: 8,
    recommendedPlayers: 4,
    difficulty: "medium",
    avgDuration: 30,
    description: "Construa seus próprios trens",
    aiCompatible: true,
    requiresMCTS: true,
  },
  domino_matador: {
    name: "Matador",
    category: "domino_matador",
    minPlayers: 2,
    maxPlayers: 4,
    recommendedPlayers: 4,
    difficulty: "hard",
    avgDuration: 20,
    description: "Variante de dominó",
    aiCompatible: true,
    requiresMCTS: true,
  },

  // Mahjong
  mahjong_riichi: {
    name: "Mahjong Riichi",
    category: "mahjong_riichi",
    minPlayers: 4,
    maxPlayers: 4,
    recommendedPlayers: 4,
    difficulty: "hard",
    avgDuration: 45,
    description: "Mahjong japonês competitivo",
    aiCompatible: true,
    requiresMCTS: true,
  },
  mahjong_hong_kong: {
    name: "Mahjong Hong Kong",
    category: "mahjong_hong_kong",
    minPlayers: 4,
    maxPlayers: 4,
    recommendedPlayers: 4,
    difficulty: "hard",
    avgDuration: 30,
    description: "Mahjong de Hong Kong",
    aiCompatible: true,
    requiresMCTS: true,
  },
  mahjong_chinese: {
    name: "Mahjong Chinês",
    category: "mahjong_chinese",
    minPlayers: 4,
    maxPlayers: 4,
    recommendedPlayers: 4,
    difficulty: "hard",
    avgDuration: 40,
    description: "Mahjong chinês clássico",
    aiCompatible: true,
    requiresMCTS: true,
  },
  mahjong_solitaire: {
    name: "Mahjong Solitário",
    category: "mahjong_solitaire",
    minPlayers: 1,
    maxPlayers: 1,
    recommendedPlayers: 1,
    difficulty: "medium",
    avgDuration: 15,
    description: "Mahjong solitário",
    aiCompatible: false,
    requiresMCTS: false,
  },

  // Palavras
  word_scrabble: {
    name: "Scrabble",
    category: "word_scrabble",
    minPlayers: 2,
    maxPlayers: 4,
    recommendedPlayers: 2,
    difficulty: "hard",
    avgDuration: 30,
    description: "Forme palavras no tabuleiro",
    aiCompatible: true,
    requiresMCTS: true,
  },
  word_boggle: {
    name: "Boggle",
    category: "word_boggle",
    minPlayers: 1,
    maxPlayers: 8,
    recommendedPlayers: 4,
    difficulty: "medium",
    avgDuration: 3,
    description: "Encontre palavras na grade",
    aiCompatible: true,
    requiresMCTS: false,
  },
  word_crossword: {
    name: "Palavras Cruzadas",
    category: "word_crossword",
    minPlayers: 1,
    maxPlayers: 4,
    recommendedPlayers: 1,
    difficulty: "medium",
    avgDuration: 20,
    description: "Complete a cruzada",
    aiCompatible: false,
    requiresMCTS: false,
  },
  word_hangman: {
    name: "Forca",
    category: "word_hangman",
    minPlayers: 2,
    maxPlayers: 10,
    recommendedPlayers: 4,
    difficulty: "easy",
    avgDuration: 5,
    description: "Adivinhe a palavra",
    aiCompatible: true,
    requiresMCTS: false,
  },

  // Abstract
  abstract_chess_variants: {
    name: "Variantes de Xadrez",
    category: "abstract_chess_variants",
    minPlayers: 2,
    maxPlayers: 2,
    recommendedPlayers: 2,
    difficulty: "hard",
    avgDuration: 30,
    description: "Xadrez 960, Crazyhouse, etc.",
    aiCompatible: true,
    requiresMCTS: true,
  },
  abstract_hex: {
    name: "Hex",
    category: "abstract_hex",
    minPlayers: 2,
    maxPlayers: 2,
    recommendedPlayers: 2,
    difficulty: "medium",
    avgDuration: 15,
    description: "Conecte lados do tabuleiro",
    aiCompatible: true,
    requiresMCTS: true,
  },
  abstract_dots_boxes: {
    name: "Pontos e Caixas",
    category: "abstract_dots_boxes",
    minPlayers: 2,
    maxPlayers: 4,
    recommendedPlayers: 2,
    difficulty: "easy",
    avgDuration: 10,
    description: "Complete caixas",
    aiCompatible: true,
    requiresMCTS: true,
  },
  abstract_nim: {
    name: "Nim",
    category: "abstract_nim",
    minPlayers: 2,
    maxPlayers: 2,
    recommendedPlayers: 2,
    difficulty: "medium",
    avgDuration: 5,
    description: "Remova objetos das pilhas",
    aiCompatible: true,
    requiresMCTS: false,
  },
  abstract_chomp: {
    name: "Chomp",
    category: "abstract_chomp",
    minPlayers: 2,
    maxPlayers: 2,
    recommendedPlayers: 2,
    difficulty: "medium",
    avgDuration: 5,
    description: "Coma do chocolate",
    aiCompatible: true,
    requiresMCTS: false,
  },

  // Action
  action_jenga: {
    name: "Jenga",
    category: "action_jenga",
    minPlayers: 2,
    maxPlayers: 8,
    recommendedPlayers: 4,
    difficulty: "medium",
    avgDuration: 15,
    description: "Remova blocos sem derrubar",
    aiCompatible: false,
    requiresMCTS: false,
  },
  action_twister: {
    name: "Twister",
    category: "action_twister",
    minPlayers: 2,
    maxPlayers: 4,
    recommendedPlayers: 4,
    difficulty: "easy",
    avgDuration: 10,
    description: "Equilíbrio físico",
    aiCompatible: false,
    requiresMCTS: false,
  },

  // TCG
  tcg_magic: {
    name: "Magic: The Gathering",
    category: "tcg_magic",
    minPlayers: 2,
    maxPlayers: 8,
    recommendedPlayers: 2,
    difficulty: "hard",
    avgDuration: 30,
    description: "TCG clássico",
    aiCompatible: true,
    requiresMCTS: true,
  },
  tcg_pokemon: {
    name: "Pokémon TCG",
    category: "tcg_pokemon",
    minPlayers: 2,
    maxPlayers: 4,
    recommendedPlayers: 2,
    difficulty: "medium",
    avgDuration: 20,
    description: "TCG Pokémon",
    aiCompatible: true,
    requiresMCTS: true,
  },
  tcg_yugioh: {
    name: "Yu-Gi-Oh!",
    category: "tcg_yugioh",
    minPlayers: 2,
    maxPlayers: 2,
    recommendedPlayers: 2,
    difficulty: "hard",
    avgDuration: 15,
    description: "TCG Yu-Gi-Oh!",
    aiCompatible: true,
    requiresMCTS: true,
  },

  // Party
  party_codenames: {
    name: "Codenames",
    category: "party_codenames",
    minPlayers: 4,
    maxPlayers: 8,
    recommendedPlayers: 6,
    difficulty: "medium",
    avgDuration: 15,
    description: "Adivinhe palavras por dicas",
    aiCompatible: true,
    requiresMCTS: false,
  },
  party_dixit: {
    name: "Dixit",
    category: "party_dixit",
    minPlayers: 3,
    maxPlayers: 8,
    recommendedPlayers: 4,
    difficulty: "medium",
    avgDuration: 20,
    description: "Associação de imagens",
    aiCompatible: false,
    requiresMCTS: false,
  },
  party_telestrations: {
    name: "Telestrations",
    category: "party_telestrations",
    minPlayers: 4,
    maxPlayers: 8,
    recommendedPlayers: 6,
    difficulty: "easy",
    avgDuration: 20,
    description: "Telefone sem fio desenhado",
    aiCompatible: false,
    requiresMCTS: false,
  },
  party_warewolf: {
    name: "Lobisomem",
    category: "party_warewolf",
    minPlayers: 5,
    maxPlayers: 20,
    recommendedPlayers: 8,
    difficulty: "medium",
    avgDuration: 15,
    description: "Jogo de dedução social",
    aiCompatible: true,
    requiresMCTS: false,
  },
  party_mafia: {
    name: "Mafia",
    category: "party_mafia",
    minPlayers: 5,
    maxPlayers: 20,
    recommendedPlayers: 8,
    difficulty: "medium",
    avgDuration: 15,
    description: "Jogo de dedução social",
    aiCompatible: true,
    requiresMCTS: false,
  },

  // Brasil
  brasil_truco: {
    name: "Truco",
    category: "brasil_truco",
    minPlayers: 2,
    maxPlayers: 6,
    recommendedPlayers: 4,
    difficulty: "hard",
    avgDuration: 15,
    description: "Truco brasileiro",
    aiCompatible: true,
    requiresMCTS: true,
  },
  brasil_sueca: {
    name: "Sueca",
    category: "brasil_sueca",
    minPlayers: 4,
    maxPlayers: 4,
    recommendedPlayers: 4,
    difficulty: "medium",
    avgDuration: 20,
    description: "Sueca portuguesa",
    aiCompatible: true,
    requiresMCTS: true,
  },
  brasil_buraco: {
    name: "Buraco",
    category: "brasil_buraco",
    minPlayers: 2,
    maxPlayers: 4,
    recommendedPlayers: 4,
    difficulty: "medium",
    avgDuration: 30,
    description: "Buraco brasileiro",
    aiCompatible: true,
    requiresMCTS: true,
  },
  brasil_tranca: {
    name: "Tranca",
    category: "brasil_tranca",
    minPlayers: 2,
    maxPlayers: 4,
    recommendedPlayers: 4,
    difficulty: "medium",
    avgDuration: 25,
    description: "Tranca brasileira",
    aiCompatible: true,
    requiresMCTS: true,
  },
  brasil_pif_paf: {
    name: "Pif Paf",
    category: "brasil_pif_paf",
    minPlayers: 2,
    maxPlayers: 8,
    recommendedPlayers: 4,
    difficulty: "easy",
    avgDuration: 10,
    description: "Pif Paf brasileiro",
    aiCompatible: true,
    requiresMCTS: false,
  },
  brasil_hole: {
    name: "Hole",
    category: "brasil_hole",
    minPlayers: 2,
    maxPlayers: 6,
    recommendedPlayers: 4,
    difficulty: "medium",
    avgDuration: 15,
    description: "Hole brasileiro",
    aiCompatible: true,
    requiresMCTS: true,
  },
  brasil_maluco: {
    name: "Maluco",
    category: "brasil_maluco",
    minPlayers: 2,
    maxPlayers: 6,
    recommendedPlayers: 4,
    difficulty: "medium",
    avgDuration: 15,
    description: "Maluco brasileiro",
    aiCompatible: true,
    requiresMCTS: true,
  },
};
