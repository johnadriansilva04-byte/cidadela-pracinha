/**
 * MOTOR UNIVERSAL DE JOGOS CLÁSSICOS
 *
 * Contrato e tipos compartilhados por todos os jogos do catálogo (cartas,
 * tabuleiros, dados, dominó, mahjong, palavras, party, brasileiros…).
 *
 * O `UniversalGameState` é o formato único que as UIs consomem, então todo
 * adaptador precisa respeitá-lo:
 *  - `board`     → GameBoard com `cells` (a UI desenha a grade a partir dele)
 *  - `players[]` → mãos, capturas e estado por jogador
 *  - `customState` → tudo que é específico do jogo, TIPADO por adaptador
 *
 * O motor é compatível com a IA genérica (`@/lib/ai/GameEngine`): qualquer jogo
 * registrado na fábrica ganha MCTS de graça.
 */
import type { GameEngine } from "../ai/GameEngine";

/* ============================================================ CATEGORIAS == */

export type GameCategory =
  // Cartas
  | "card_poker"
  | "card_blackjack"
  | "card_baccarat"
  | "card_rummy"
  | "card_trick"
  | "card_discard"
  | "card_memory"
  | "card_solitaire"
  // Tabuleiro
  | "board_chess"
  | "board_checkers"
  | "board_go"
  | "board_reversi"
  | "board_mancala"
  | "board_backgammon"
  | "board_nine_mens_morris"
  | "board_connect_four"
  | "board_tic_tac_toe"
  | "board_chinese_checkers"
  | "board_snakes_ladders"
  | "board_ludo"
  | "board_monopoly"
  // Dados
  | "dice_yahtzee"
  | "dice_farkle"
  | "dice_crap"
  | "dice_pig"
  | "dice_ships"
  | "dice_liars_dice"
  | "dice_mia"
  | "dice_chuck_a_luck"
  // Dominó
  | "domino_block"
  | "domino_draw"
  | "domino_all_fives"
  | "domino_mexican_train"
  | "domino_matador"
  // Mahjong
  | "mahjong_riichi"
  | "mahjong_hong_kong"
  | "mahjong_chinese"
  | "mahjong_solitaire"
  // Palavras
  | "word_scrabble"
  | "word_boggle"
  | "word_crossword"
  | "word_hangman"
  // Abstratos
  | "abstract_chess_variants"
  | "abstract_hex"
  | "abstract_dots_boxes"
  | "abstract_nim"
  | "abstract_chomp"
  // Ação
  | "action_jenga"
  | "action_twister"
  // TCG
  | "tcg_magic"
  | "tcg_pokemon"
  | "tcg_yugioh"
  // Party
  | "party_codenames"
  | "party_dixit"
  | "party_telestrations"
  | "party_warewolf"
  | "party_mafia"
  // Brasileiros
  | "brasil_truco"
  | "brasil_sueca"
  | "brasil_buraco"
  | "brasil_tranca"
  | "brasil_pif_paf"
  | "brasil_hole"
  | "brasil_maluco";

/* ================================================================ PEÇAS == */

export type PieceType =
  | "card"
  | "checker"
  | "stone"
  | "die"
  | "domino"
  | "tile"
  | "letter"
  | "pawn"
  | "token"
  | "custom";

export interface GamePiece {
  id: string;
  type: PieceType;
  /** Dono da peça (null = neutra / no monte). */
  owner: number | null;
  position?: { x: number; y: number };
  /** Dados específicos do jogo, sempre indexados por string. */
  data: Record<string, unknown>;
}

/* ================================================================ ESTADO == */

export interface UniversalPlayer {
  id: number;
  name: string;
  isBot: boolean;
  /** Peças na mão (cartas, dominós…). */
  hand: GamePiece[];
  /** Peças capturadas do adversário. */
  captured: GamePiece[];
  eliminated: boolean;
  customState: Record<string, unknown>;
}

export interface BoardCell {
  id: string;
  position: { x: number; y: number };
  content: GamePiece | null;
  neighbors: string[];
  customData: Record<string, unknown>;
}

export interface BoardEdge {
  from: string;
  to: string;
  weight?: number;
  customData: Record<string, unknown>;
}

export interface GameBoard {
  type: "grid" | "hex" | "graph" | "custom";
  width?: number;
  height?: number;
  cells?: BoardCell[];
  edges?: BoardEdge[];
  customState: Record<string, unknown>;
}

/**
 * Estado universal. Cada adaptador ESTENDE este tipo tipando `customState`
 * (e pode declarar campos extras, como `board` em matriz, para jogos simples).
 */
export interface UniversalGameState {
  gameCategory: GameCategory;
  gameId: string;

  players: UniversalPlayer[];
  currentPlayer: number;
  turnOrder: number[];

  board: GameBoard;
  pieces: GamePiece[];
  /** Monte/baralho/saco com as peças ainda não distribuídas. */
  deck: GamePiece[];

  phase: string;
  round: number;
  subRound?: number;

  scores: Record<number, number>;
  resources?: Record<number, Record<string, number>>;

  activeRules: string[];
  variant: string;

  moveHistory: GameMove[];
  lastMove: GameMove | null;

  gameOver: boolean;
  winner: number | null;
  reason: string | null;

  /**
   * Estado específico do jogo. O tipo base é `object` (e não
   * `Record<string, unknown>`) para que cada adaptador possa ESTREITAR este
   * campo com o seu próprio tipo — interfaces não ganham índice implícito.
   */
  customState: object;
}

/* ============================================================== JOGADAS == */

export type MoveType =
  | "place"
  | "move"
  | "capture"
  | "remove"
  | "draw"
  | "discard"
  | "play"
  | "pass"
  | "bet"
  | "fold"
  | "trade"
  | "roll"
  | "bid"
  | "challenge"
  | "custom";

export interface GameMove {
  playerId: number;
  type: MoveType;
  timestamp: number;
  /** Dados da jogada, sempre indexados por string. */
  data: Record<string, unknown>;
}

/* ======================================================= MOTOR UNIVERSAL == */

export interface UniversalGameEngine extends GameEngine<UniversalGameState, GameMove> {
  /** Cria o estado inicial do jogo. */
  initializeGame(category: GameCategory, playerCount: number, variant?: string): UniversalGameState;

  getValidMoves(state: UniversalGameState): GameMove[];
  applyMove(state: UniversalGameState, move: GameMove): UniversalGameState;
  isGameOver(state: UniversalGameState): boolean;
  getWinner(state: UniversalGameState): number | null;
  evaluate(state: UniversalGameState, player: number): number;
  getCurrentPlayer(state: UniversalGameState): number;

  /** Dica do próprio motor (ex.: estratégia básica). Opcional. */
  suggestMove?(state: UniversalGameState, player: number): GameMove | null;

  /** Configura o tabuleiro inicial do jogo. Opcional. */
  setupBoard?(category: GameCategory, variant?: string): GameBoard;

  /** Pontuação derivada do estado (quando difere de `scores`). Opcional. */
  calculateScore?(state: UniversalGameState, playerId: number): number;
}

/* ========================================================== UTILITÁRIOS == */

export class UniversalGameUtils {
  static createPlayer(id: number, name: string, isBot = false): UniversalPlayer {
    return { id, name, isBot, hand: [], captured: [], eliminated: false, customState: {} };
  }

  /** Tabuleiro em grade com vizinhos ortogonais e diagonais. */
  static createGridBoard(width: number, height: number): GameBoard {
    const cells: BoardCell[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const neighbors: string[] = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) neighbors.push(`${nx}-${ny}`);
          }
        }
        cells.push({ id: `${x}-${y}`, position: { x, y }, content: null, neighbors, customData: {} });
      }
    }
    return { type: "grid", width, height, cells, customState: {} };
  }

  /** Clona profundamente (a IA exige imutabilidade). */
  static cloneState<T extends UniversalGameState>(state: T): T {
    return JSON.parse(JSON.stringify(state)) as T;
  }

  static createMove(playerId: number, type: MoveType, data: Record<string, unknown> = {}): GameMove {
    return { playerId, type, timestamp: Date.now(), data };
  }

  static findPieceById(pieces: GamePiece[], id: string): GamePiece | null {
    return pieces.find((p) => p.id === id) ?? null;
  }

  static findPiecesByOwner(pieces: GamePiece[], owner: number): GamePiece[] {
    return pieces.filter((p) => p.owner === owner);
  }

  static getPieceAtCell(board: GameBoard, x: number, y: number): GamePiece | null {
    const cell = board.cells?.find((c) => c.position.x === x && c.position.y === y);
    return cell?.content ?? null;
  }

  static setPieceAtCell(board: GameBoard, x: number, y: number, piece: GamePiece | null): void {
    const cell = board.cells?.find((c) => c.position.x === x && c.position.y === y);
    if (cell) cell.content = piece;
  }

  /** Chave estável de uma célula da grade. */
  static cellId(x: number, y: number): string {
    return `${x}-${y}`;
  }

  /** Lê `x-y` de uma chave de célula. */
  static parseCellId(id: string): { x: number; y: number } | null {
    const parts = id.split("-");
    if (parts.length !== 2) return null;
    const x = Number(parts[0] ?? "");
    const y = Number(parts[1] ?? "");
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }

  /** Embaralha uma lista (Fisher–Yates) sem mutar a original. */
  static shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const a = out[i]!;
      out[i] = out[j]!;
      out[j] = a;
    }
    return out;
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
