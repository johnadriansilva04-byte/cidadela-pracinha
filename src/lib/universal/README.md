# Sistema Universal de Jogos Clássicos

Sistema genérico para implementar JOGOS CLÁSSICOS de todos os tipos: cartas, tabuleiros, dados, dominó, mahjong, etc.

## 🎮 Jogos Disponíveis

### ✅ Implementados (Adaptadores Prontos)

| Categoria | Jogo | IA | MCTS |
|-----------|------|----| ----|
| Tabuleiro | Xadrez (Chess) | ✅ | ✅ |
| Tabuleiro | Damas (Checkers) | ✅ | ✅ |
| Cartas | Blackjack (21) | ✅ | ❌ |
| Dominó | Dominó (Bloco/Draw) | ✅ | ✅ |
| Dados | Yahtzee | ✅ | ❌ |

### 📋 Registrados (Prontos para Implementar)

Total de **60+ jogos** registrados no sistema, organizados por categoria:

#### 🃏 Jogos de Cartas (8)
- Poker (Texas Hold'em, Omaha, Draw, Stud)
- Blackjack
- Baccarat
- Rummy (Gin Rummy, Canasta, Buraco)
- Trick games (Bridge, Hearts, Spades, Truco, Sueca)
- Discard games (Uno, Crazy Eights, Mau Mau)
- Memory games (War, Go Fish, Old Maid)
- Solitaire (Klondike, FreeCell, Spider)

#### 🎲 Jogos de Tabuleiro (12)
- Xadrez
- Damas
- Go
- Reversi/Othello
- Mancala
- Gamão
- Trilha
- Liga 4
- Jogo da Velha
- Ludo Chinês
- Cobras e Escadas
- Ludo
- Monopoly

#### 🎲 Jogos de Dados (8)
- Yahtzee
- Farkle
- Craps
- Pig
- Batalha Naval (dados)
- Liar's Dice
- Mia
- Chuck-a-Luck

#### 🎯 Jogos de Dominó (5)
- Dominó Bloco
- Dominó Compra
- All Fives
- Trem Mexicano
- Matador

#### 🀄 Jogos de Mahjong (4)
- Riichi (japonês)
- Hong Kong
- Chinês Clássico
- Solitário

#### 📝 Jogos de Palavras (4)
- Scrabble
- Boggle
- Palavras Cruzadas
- Forca

#### 🧩 Jogos Abstract (5)
- Variantes de Xadrez
- Hex
- Pontos e Caixas
- Nim
- Chomp

#### 🏃 Jogos de Ação (2)
- Jenga
- Twister

#### 🃏 TCG (3)
- Magic: The Gathering
- Pokémon TCG
- Yu-Gi-Oh!

#### 🎉 Jogos Party (5)
- Codenames
- Dixit
- Telestrations
- Lobisomem
- Mafia

#### 🇧🇷 Jogos Brasileiros (7)
- Truco
- Sueca
- Buraco
- Tranca
- Pif Paf
- Hole
- Maluco

## 🚀 Como Usar

### Exemplo 1: Criar um Jogo de Xadrez

```typescript
import { UniversalGameFactory } from "@/lib/universal/UniversalGameFactory";
import { MCTS } from "@/lib/ai/MCTS";

// Cria o jogo
const gameState = UniversalGameFactory.createGame("board_chess", 2);
console.log("Jogo de xadrez criado:", gameState);

// Cria o motor
const engine = UniversalGameFactory.createEngine("board_chess");
if (engine) {
  // Usa MCTS para escolher jogada
  const mcts = new MCTS(engine, {
    maxIterations: 5000,
    timeBudgetMs: 2000,
  });

  const result = mcts.computeMove(gameState, 0);
  console.log("Melhor jogada:", result.move);
}
```

### Exemplo 2: Jogar Blackjack

```typescript
import { UniversalGameFactory } from "@/lib/universal/UniversalGameFactory";

// Cria blackjack com 4 jogadores
const gameState = UniversalGameFactory.createGame("card_blackjack", 4);
console.log("Blackjack criado:", gameState);

// Cria motor
const engine = UniversalGameFactory.createEngine("card_blackjack");
if (engine) {
  const moves = engine.getValidMoves(gameState);
  console.log("Jogadas disponíveis:", moves);

  // Aplica uma aposta
  const betMove = moves[0];
  const newState = engine.applyMove(gameState, betMove);
  console.log("Estado após aposta:", newState);
}
```

### Exemplo 3: Listar Jogos Disponíveis

```typescript
import { UniversalGameFactory } from "@/lib/universal/UniversalGameFactory";

// Lista todos os jogos
const allGames = UniversalGameFactory.listGames();
console.log("Todos os jogos:", allGames);

// Lista só jogos de cartas
const cardGames = UniversalGameFactory.listGamesByCategory("card_");
console.log("Jogos de cartas:", cardGames);

// Verifica se um jogo tem IA
const hasAI = UniversalGameFactory.isAICompatible("board_chess");
console.log("Xadrez tem IA?", hasAI);

// Verifica se precisa de MCTS
const needsMCTS = UniversalGameFactory.requiresMCTS("board_chess");
console.log("Xadrez precisa de MCTS?", needsMCTS);
```

## 🔧 Como Adicionar um Novo Jogo

### Passo 1: Criar o Adaptador

```typescript
// src/lib/universal/adapters/MeuJogoAdapter.ts
import { UniversalGameEngine, UniversalGameState, GameMove, UniversalGameUtils } from "../UniversalGameEngine";

export class MeuJogoAdapter implements UniversalGameEngine {
  initializeGame(category: string, playerCount: number, variant?: string): UniversalGameState {
    // Inicializa o estado do jogo
    return {
      gameCategory: category,
      gameId: `meujogo-${Date.now()}`,
      players: Array.from({ length: playerCount }, (_, i) =>
        UniversalGameUtils.createPlayer(i, `Jogador ${i + 1}`, i > 0)
      ),
      currentPlayer: 0,
      turnOrder: Array.from({ length: playerCount }, (_, i) => i),
      board: { type: "custom", customState: {} },
      pieces: [],
      phase: "playing",
      round: 1,
      scores: {},
      activeRules: ["standard"],
      variant: variant || "standard",
      moveHistory: [],
      lastMove: null,
      gameOver: false,
      winner: null,
      reason: null,
      customState: {},
    };
  }

  getValidMoves(state: UniversalGameState): GameMove[] {
    // Retorna jogadas legais
    return [];
  }

  applyMove(state: UniversalGameState, move: GameMove): UniversalGameState {
    // Aplica jogada e retorna novo estado
    return state;
  }

  isGameOver(state: UniversalGameState): boolean {
    return state.gameOver;
  }

  getWinner(state: UniversalGameState): number | null {
    return state.winner;
  }

  evaluate(state: UniversalGameState, player: number): number {
    // Avaliação heurística para IA
    return 0;
  }

  getCurrentPlayer(state: UniversalGameState): number {
    return state.currentPlayer;
  }
}
```

### Passo 2: Registrar no Factory

```typescript
// src/lib/universal/UniversalGameFactory.ts
import { MeuJogoAdapter } from "./adapters/MeuJogoAdapter";

// No método initialize():
this.adapters.set("category_meujogo", () => new MeuJogoAdapter());
```

### Passo 3: Registrar no GAMES_REGISTRY

```typescript
// src/lib/universal/UniversalGameEngine.ts
meu_jogo: {
  name: "Meu Jogo",
  category: "category_meujogo",
  minPlayers: 2,
  maxPlayers: 4,
  recommendedPlayers: 3,
  difficulty: "medium",
  avgDuration: 15,
  description: "Descrição do jogo",
  aiCompatible: true,
  requiresMCTS: true,
},
```

### Passo 4: Usar!

```typescript
const gameState = UniversalGameFactory.createGame("category_meujogo", 3);
const engine = UniversalGameFactory.createEngine("category_meujogo");
// Pronto!
```

## 🎯 Integração com MCTS

Todos os jogos que implementam `UniversalGameEngine` podem usar MCTS automaticamente:

```typescript
import { UniversalGameFactory } from "@/lib/universal/UniversalGameFactory";
import { MCTS } from "@/lib/ai/MCTS";

const engine = UniversalGameFactory.createEngine("board_chess");
if (engine) {
  const mcts = new MCTS(engine, {
    maxIterations: 10000,
    timeBudgetMs: 3000,
  });

  const result = mcts.computeMove(gameState, player);
  console.log("Jogada MCTS:", result.move);
}
```

## 📊 Estrutura de Dados

### GameState Universal

```typescript
interface UniversalGameState {
  gameCategory: GameCategory;        // Tipo do jogo
  gameId: string;                    // ID único
  players: UniversalPlayer[];       // Jogadores
  currentPlayer: number;            // Turno atual
  turnOrder: number[];              // Ordem de turno
  board: GameBoard;                 // Tabuleiro
  pieces: GamePiece[];              // Peças em jogo
  deck?: GamePiece[];               // Baralho/pool
  phase: string;                    // Fase atual
  round: number;                    // Rodada
  scores: Record<number, number>;  // Pontuação
  resources?: Record<number, Record<string, number>>; // Fichas, dinheiro
  activeRules: string[];           // Regras ativas
  variant?: string;                 // Variante
  moveHistory: GameMove[];         // Histórico
  lastMove: GameMove | null;       // Última jogada
  gameOver: boolean;                // Fim de jogo
  winner: number | null;            // Vencedor
  reason: string | null;           // Motivo do fim
  customState: Record<string, any>; // Estado customizado
}
```

### GamePiece

```typescript
interface GamePiece {
  id: string;                      // ID único
  type: PieceType;                 // Tipo (card, checker, die, etc.)
  owner: number | null;            // Dono (null = neutro)
  position?: { x: number; y: number } | number; // Posição
  data: Record<string, any>;       // Dados específicos
}
```

## 🎨 Tipos de Peças

- `card` - Carta (baralho)
- `checker` - Peça de tabuleiro (xadrez, damas)
- `stone` - Pedra (Go)
- `die` - Dado
- `domino` - Peça de dominó
- `tile` - Peça de mahjong
- `letter` - Letra (Scrabble)
- `pawn` - Peão genérico
- `token` - Ficha/marcador
- `custom` - Personalizado

## 🔮 Roadmap

### Fase 1: Completar Adaptadores Básicos
- [ ] Go
- [ ] Reversi/Othello
- [ ] Mancala
- [ ] Gamão
- [ ] Liga 4
- [ ] Jogo da Velha

### Fase 2: Jogos de Cartas Populares
- [ ] Poker (Texas Hold'em)
- [ ] Rummy (Gin Rummy)
- [ ] Uno
- [ ] Hearts
- [ ] Spades

### Fase 3: Jogos Brasileiros
- [ ] Truco
- [ ] Sueca
- [ ] Buraco
- [ ] Tranca

### Fase 4: Jogos Avançados
- [ ] Mahjong
- [ ] Scrabble
- [ ] Bridge
- [ ] Magic: The Gathering

## 📖 Referências

- [Wikipedia: List of Card Games](https://en.wikipedia.org/wiki/List_of_card_games)
- [Wikipedia: Board Games](https://en.wikipedia.org/wiki/Board_game)
- [BoardGameGeek](https://boardgamegeek.com/)
- [Pagat: Card Games](https://www.pagat.com/)

## 💡 Dicas de Implementação

1. **Comece simples**: Implemente a versão básica primeiro
2. **Use os utilitários**: `UniversalGameUtils` tem funções helper
3. **Teste unitariamente**: Cada jogo deve ter seus próprios testes
4. **Documente variantes**: Muitos jogos têm múltiplas variantes
5. **Pense na IA**: Alguns jogos precisam de heurísticas complexas

## 🤝 Contribuindo

Para adicionar um novo jogo:

1. Crie `src/lib/universal/adapters/[Jogo]Adapter.ts`
2. Implemente `UniversalGameEngine`
3. Registre no `UniversalGameFactory`
4. Adicione ao `GAMES_REGISTRY`
5. Adicione testes em `testes/[jogo].test.ts`
6. Atualize este README

## 📝 Licença

Este sistema é parte do projeto Cidadela do Pracinha.
