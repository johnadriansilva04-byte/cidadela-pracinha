/**
 * Exemplos de uso do Sistema Universal de Jogos
 * Demonstração com MCTS para múltiplos jogos.
 */
import { UniversalGameFactory } from "./UniversalGameFactory";
import { MCTS } from "../ai/MCTS";

// ========================================
// EXEMPLO 1: Xadrez com MCTS
// ========================================

function exemploXadrezMCTS() {
  console.log("=== Exemplo: Xadrez com MCTS ===\n");

  // Cria o jogo
  const gameState = UniversalGameFactory.createGame("board_chess", 2);
  if (!gameState) {
    console.log("Erro: jogo não encontrado");
    return;
  }

  console.log("Jogo de xadrez criado:");
  console.log("- Categoria:", gameState.gameCategory);
  console.log("- Jogadores:", gameState.players.length);
  console.log("- Peças:", gameState.pieces.length);

  // Cria o motor
  const engine = UniversalGameFactory.createEngine("board_chess");
  if (!engine) {
    console.log("Erro: motor não encontrado");
    return;
  }

  // Usa MCTS
  const mcts = new MCTS(engine, {
    maxIterations: 2000,
    timeBudgetMs: 1000,
    explorationConstant: 1.41,
  });

  console.log("\nComputando jogada com MCTS...");
  const result = mcts.computeMove(gameState, 0);

  console.log("\nResultado:");
  console.log("- Jogada:", result.move);
  console.log("- Win rate:", (result.winRate * 100).toFixed(1) + "%");
  console.log("- Iterações:", result.iterations);
  console.log("- Tempo:", result.elapsedMs + "ms");
  console.log("- Nós na árvore:", result.totalNodes);
}

// ========================================
// EXEMPLO 2: Blackjack (sem MCTS, heurística simples)
// ========================================

function exemploBlackjack() {
  console.log("\n=== Exemplo: Blackjack ===\n");

  const gameState = UniversalGameFactory.createGame("card_blackjack", 4);
  if (!gameState) {
    console.log("Erro: jogo não encontrado");
    return;
  }

  console.log("Blackjack criado:");
  console.log("- Jogadores:", gameState.players.length);
  console.log("- Fase:", gameState.phase);

  const engine = UniversalGameFactory.createEngine("card_blackjack");
  if (!engine) {
    console.log("Erro: motor não encontrado");
    return;
  }

  const moves = engine.getValidMoves(gameState);
  console.log("\nJogadas disponíveis:", moves.length);

  if (moves.length > 0) {
    const move = moves[0];
    console.log("- Primeira jogada:", move);

    const newState = engine.applyMove(gameState, move);
    console.log("\nEstado após jogada:");
    console.log("- Fase:", newState.phase);
    console.log("- Turno:", newState.currentPlayer);
  }
}

// ========================================
// EXEMPLO 3: Damas com MCTS
// ========================================

function exemploDamasMCTS() {
  console.log("\n=== Exemplo: Damas com MCTS ===\n");

  const gameState = UniversalGameFactory.createGame("board_checkers", 2);
  if (!gameState) {
    console.log("Erro: jogo não encontrado");
    return;
  }

  console.log("Damas criada:");
  console.log("- Peças:", gameState.pieces.length);

  const engine = UniversalGameFactory.createEngine("board_checkers");
  if (!engine) {
    console.log("Erro: motor não encontrado");
    return;
  }

  const mcts = new MCTS(engine, {
    maxIterations: 1000,
    timeBudgetMs: 500,
  });

  const result = mcts.computeMove(gameState, 0);

  console.log("\nResultado MCTS:");
  console.log("- Jogada:", result.move);
  console.log("- Win rate:", (result.winRate * 100).toFixed(1) + "%");
}

// ========================================
// EXEMPLO 4: Dominó com MCTS
// ========================================

function exemploDominoMCTS() {
  console.log("\n=== Exemplo: Dominó com MCTS ===\n");

  const gameState = UniversalGameFactory.createGame("domino_block", 4);
  if (!gameState) {
    console.log("Erro: jogo não encontrado");
    return;
  }

  console.log("Dominó criado:");
  console.log("- Jogadores:", gameState.players.length);
  console.log("- Boneyard:", gameState.customState.boneyard.length);

  const engine = UniversalGameFactory.createEngine("domino_block");
  if (!engine) {
    console.log("Erro: motor não encontrado");
    return;
  }

  const mcts = new MCTS(engine, {
    maxIterations: 500,
    timeBudgetMs: 300,
  });

  const result = mcts.computeMove(gameState, 0);

  console.log("\nResultado MCTS:");
  console.log("- Jogada:", result.move);
  console.log("- Win rate:", (result.winRate * 100).toFixed(1) + "%");
}

// ========================================
// EXEMPLO 5: Yahtzee (sem MCTS)
// ========================================

function exemploYahtzee() {
  console.log("\n=== Exemplo: Yahtzee ===\n");

  const gameState = UniversalGameFactory.createGame("dice_yahtzee", 4);
  if (!gameState) {
    console.log("Erro: jogo não encontrado");
    return;
  }

  console.log("Yahtzee criado:");
  console.log("- Jogadores:", gameState.players.length);
  console.log("- Dados:", gameState.customState.dice);
  console.log("- Rolagens restantes:", gameState.customState.rollsLeft);

  const engine = UniversalGameFactory.createEngine("dice_yahtzee");
  if (!engine) {
    console.log("Erro: motor não encontrado");
    return;
  }

  const moves = engine.getValidMoves(gameState);
  console.log("\nJogadas disponíveis:", moves.length);

  if (moves.length > 0) {
    const move = moves[0];
    console.log("- Primeira jogada:", move);

    const newState = engine.applyMove(gameState, move);
    console.log("\nEstado após jogada:");
    console.log("- Dados:", newState.customState.dice);
    console.log("- Rolagens restantes:", newState.customState.rollsLeft);
  }
}

// ========================================
// EXEMPLO 6: Listar Jogos Disponíveis
// ========================================

function exemploListarJogos() {
  console.log("\n=== Jogos Disponíveis ===\n");

  const allGames = UniversalGameFactory.listGames();
  console.log(`Total de jogos registrados: ${allGames.length}\n`);

  // Por categoria
  const categories = [
    "board_",   // Tabuleiros
    "card_",    // Cartas
    "dice_",    // Dados
    "domino_",  // Dominó
    "mahjong_", // Mahjong
    "word_",    // Palavras
    "brasil_",  // Brasileiros
  ];

  for (const prefix of categories) {
    const games = UniversalGameFactory.listGamesByCategory(prefix);
    if (games.length > 0) {
      console.log(`${prefix.replace("_", "").toUpperCase()} (${games.length}):`);
      for (const game of games) {
        const info = UniversalGameFactory.getGameInfo(game);
        const hasAI = UniversalGameFactory.isAICompatible(game);
        const needsMCTS = UniversalGameFactory.requiresMCTS(game);
        console.log(`  - ${info?.name} [IA: ${hasAI ? "✅" : "❌"}] [MCTS: ${needsMCTS ? "✅" : "❌"}]`);
      }
      console.log();
    }
  }
}

// ========================================
// EXEMPLO 7: Benchmark de MCTS
// ========================================

function exemploBenchmarkMCTS() {
  console.log("\n=== Benchmark MCTS: Xadrez vs Damas ===\n");

  const games = [
    { category: "board_chess", name: "Xadrez" },
    { category: "board_checkers", name: "Damas" },
  ];

  for (const { category, name } of games) {
    const gameState = UniversalGameFactory.createGame(category, 2);
    if (!gameState) continue;

    const engine = UniversalGameFactory.createEngine(category);
    if (!engine) continue;

    const mcts = new MCTS(engine, {
      maxIterations: 1000,
      timeBudgetMs: 500,
    });

    const start = Date.now();
    const result = mcts.computeMove(gameState, 0);
    const elapsed = Date.now() - start;

    console.log(`${name}:`);
    console.log(`  - Iterações: ${result.iterations}`);
    console.log(`  - Tempo: ${elapsed}ms`);
    console.log(`  - Nós: ${result.totalNodes}`);
    console.log(`  - Win rate: ${(result.winRate * 100).toFixed(1)}%`);
    console.log();
  }
}

// ========================================
// EXECUÇÃO (comentar/descomentar para testar)
// ========================================

// exemploXadrezMCTS();
// exemploBlackjack();
// exemploDamasMCTS();
// exemploDominoMCTS();
// exemploYahtzee();
// exemploListarJogos();
// exemploBenchmarkMCTS();

export {
  exemploXadrezMCTS,
  exemploBlackjack,
  exemploDamasMCTS,
  exemploDominoMCTS,
  exemploYahtzee,
  exemploListarJogos,
  exemploBenchmarkMCTS,
};
