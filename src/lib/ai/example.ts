/**
 * Exemplo de uso do sistema de IA genérica com MCTS.
 * Este arquivo demonstra como integrar a IA em um novo jogo.
 */

import { MCTS } from "./MCTS";
import { GameEngine } from "./GameEngine";
import { TrilhaAdapter } from "../trilha/TrilhaEngineAdapter";
import { createInitialState } from "../trilha/engine";

// ========================================
// EXEMPLO 1: Usando MCTS com a Trilha
// ========================================

function exemploTrilhaMCTS() {
  console.log("=== Exemplo: MCTS na Trilha ===\n");

  // Cria o adaptador que implementa GameEngine
  const adapter = new TrilhaAdapter();

  // Cria o motor MCTS com configuração
  const mcts = new MCTS(adapter, {
    maxIterations: 5000,      // 5000 simulações
    timeBudgetMs: 1000,       // 1 segundo máximo
    explorationConstant: 1.41, // √2
    useHeuristicRollout: false, // Rollout aleatório puro
  });

  // Estado inicial da Trilha
  const initialState = createInitialState();
  console.log("Estado inicial:", initialState);

  // Computa a melhor jogada para o jogador 1
  const result = mcts.computeMove(initialState, 1);

  console.log("\nResultado MCTS:");
  console.log("- Melhor jogada:", result.move);
  console.log("- Win rate:", (result.winRate * 100).toFixed(1) + "%");
  console.log("- Iterações:", result.iterations);
  console.log("- Tempo:", result.elapsedMs + "ms");
  console.log("- Nós na árvore:", result.totalNodes);
}

// ========================================
// EXEMPLO 2: Implementando um jogo fictício
// ========================================

// Tipos para um jogo fictício (ex: simplificado de Xadrez)
interface MeuJogoState {
  board: number[]; // 64 casas: 0=vazio, 1=branco, 2=preto
  turn: 1 | 2;
  gameOver: boolean;
  winner: 1 | 2 | null;
}

interface MeuJogoMove {
  from: number;
  to: number;
}

// Adaptador para o jogo fictício
class MeuJogoAdapter implements GameEngine<MeuJogoState, MeuJogoMove> {
  getValidMoves(state: MeuJogoState): MeuJogoMove[] {
    // Implementação simplificada: qualquer peça pode mover para qualquer casa vazia
    const moves: MeuJogoMove[] = [];
    const player = state.turn;

    for (let from = 0; from < state.board.length; from++) {
      if (state.board[from] === player) {
        for (let to = 0; to < state.board.length; to++) {
          if (state.board[to] === 0) {
            moves.push({ from, to });
          }
        }
      }
    }

    return moves;
  }

  applyMove(state: MeuJogoState, move: MeuJogoMove): MeuJogoState {
    // Aplica jogada (imutável)
    const newBoard = [...state.board];
    newBoard[move.from] = 0;
    newBoard[move.to] = state.turn;

    return {
      board: newBoard,
      turn: state.turn === 1 ? 2 : 1,
      gameOver: false, // Simplificado
      winner: null,
    };
  }

  isGameOver(state: MeuJogoState): boolean {
    return state.gameOver;
  }

  getWinner(state: MeuJogoState): number | null {
    return state.winner;
  }

  evaluate(state: MeuJogoState, player: number): number {
    // Heurística simples: conta peças
    const myPieces = state.board.filter((c) => c === player).length;
    const foePieces = state.board.filter((c) => c === (player === 1 ? 2 : 1)).length;
    return myPieces - foePieces;
  }

  getCurrentPlayer(state: MeuJogoState): number {
    return state.turn;
  }
}

function exemploNovoJogo() {
  console.log("\n=== Exemplo: MCTS em jogo fictício ===\n");

  const adapter = new MeuJogoAdapter();
  const mcts = new MCTS(adapter, {
    maxIterations: 1000,
    timeBudgetMs: 500,
  });

  // Estado inicial (simplificado)
  const initialState: MeuJogoState = {
    board: Array(64).fill(0),
    turn: 1,
    gameOver: false,
    winner: null,
  };

  // Coloca algumas peças iniciais
  initialState.board[0] = 1; // Branco
  initialState.board[63] = 2; // Preto

  const result = mcts.computeMove(initialState, 1);

  console.log("Resultado:", result);
}

// ========================================
// EXEMPLO 3: Comparando MCTS vs Minimax
// ========================================

function exemploComparacao() {
  console.log("\n=== Exemplo: Comparação MCTS vs Minimax ===\n");

  const adapter = new TrilhaAdapter();

  // MCTS
  const mcts = new MCTS(adapter, {
    maxIterations: 3000,
    timeBudgetMs: 2000,
  });

  const state = createInitialState();

  const mctsResult = mcts.computeMove(state, 1);
  console.log("MCTS:");
  console.log("- Tempo:", mctsResult.elapsedMs + "ms");
  console.log("- Iterações:", mctsResult.iterations);
  console.log("- Win rate:", (mctsResult.winRate * 100).toFixed(1) + "%");

  // Nota: Minimax da Trilha está em ai.ts e pode ser chamado com chooseMove()
  // Para comparar, você chamaria chooseMove(state, "general") e mediria o tempo
}

// ========================================
// EXECUÇÃO (comentar/descomentar para testar)
// ========================================

// exemploTrilhaMCTS();
// exemploNovoJogo();
// exemploComparacao();

export { exemploTrilhaMCTS, exemploNovoJogo, exemploComparacao };
