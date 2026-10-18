/**
 * Motor MCTS (Monte Carlo Tree Search) genérico.
 * Implementa o algoritmo UCT (Upper Confidence Bound for Trees) com:
 * - Selection: Seleção do nó com maior valor UCB1
 * - Expansion: Expansão de nós não explorados
 * - Simulation: Rollout (simulação aleatória) até terminal
 * - Backpropagation: Atualização de estatísticas na árvore
 */
import { GameEngine, GameState, Move } from "./GameEngine";

export interface MCTSConfig {
  /** Número máximo de iterações (simulações) */
  maxIterations: number;
  /** Orçamento de tempo em milissegundos */
  timeBudgetMs: number;
  /** Constante de exploração C para UCB1 (padrão: √2 ≈ 1.41) */
  explorationConstant: number;
  /** Se true, usa heurística para rollouts (mais rápido mas menos preciso) */
  useHeuristicRollout?: boolean;
}

export interface MCTSResult<M> {
  /** Melhor jogada encontrada */
  move: M | null;
  /** Número de iterações realizadas */
  iterations: number;
  /** Tempo decorrido em milissegundos */
  elapsedMs: number;
  /** Número total de nós na árvore */
  totalNodes: number;
  /** Win rate da jogada escolhida (0..1) */
  winRate: number;
}

/**
 * Nó da árvore MCTS.
 * Cada nó representa um estado do jogo e mantém estatísticas das simulações.
 */
class Node<S extends GameState, M extends Move> {
  /** Estado do jogo neste nó */
  state: S;
  /** Jogada que levou a este nó (null para raiz) */
  move: M | null;
  /** Jogador que fez a jogada que levou a este nó */
  player: number;
  /** Nó pai */
  parent: Node<S, M> | null;
  /** Nós filhos (indexados pela jogada) */
  children: Map<string, Node<S, M>>;
  /** Número de visitas a este nó */
  visits: number;
  /** Número de vitórias para o jogador que jogou neste nó */
  wins: number;
  /** Jogadas legais que ainda não foram expandidas */
  unexpandedMoves: M[];
  /** Se este nó é terminal (jogo acabou) */
  isTerminal: boolean;

  constructor(state: S, move: M | null, player: number, parent: Node<S, M> | null = null) {
    this.state = state;
    this.move = move;
    this.player = player;
    this.parent = parent;
    this.children = new Map();
    this.visits = 0;
    this.wins = 0;
    this.isTerminal = false;
    this.unexpandedMoves = [];
  }

  /**
   * Calcula o valor UCB1 para seleção.
   * UCB1 = W/N + C * sqrt(ln(N_parent) / N)
   */
  ucb1(explorationConstant: number, parentVisits: number): number {
    if (this.visits === 0) return Infinity;
    const exploitation = this.wins / this.visits;
    const exploration = explorationConstant * Math.sqrt(Math.log(parentVisits) / this.visits);
    return exploitation + exploration;
  }

  /**
   * Seleciona o filho com maior valor UCB1.
   */
  selectChild(explorationConstant: number): Node<S, M> | null {
    if (this.children.size === 0) return null;

    let bestChild: Node<S, M> | null = null;
    let bestValue = -Infinity;

    for (const child of this.children.values()) {
      const value = child.ucb1(explorationConstant, this.visits);
      if (value > bestValue) {
        bestValue = value;
        bestChild = child;
      }
    }

    return bestChild;
  }

  /**
   * Retorna a jogada com maior win rate entre os filhos.
   */
  getBestMove(): M | null {
    if (this.children.size === 0) return null;

    let bestMove: M | null = null;
    let bestWinRate = -Infinity;

    for (const child of this.children.values()) {
      const winRate = child.visits > 0 ? child.wins / child.visits : 0;
      if (winRate > bestWinRate) {
        bestWinRate = winRate;
        bestMove = child.move;
      }
    }

    return bestMove;
  }

  /**
   * Atualiza estatísticas com o resultado de uma simulação.
   * @param winner Vencedor da simulação (1 ou 2), ou null para empate
   */
  backpropagate(winner: number | null): void {
    let node: Node<S, M> | null = this;
    while (node !== null) {
      node.visits++;
      // Se o vencedor é o jogador que jogou neste nó, conta como vitória
      if (winner !== null && winner === node.player) {
        node.wins++;
      }
      node = node.parent;
    }
  }
}

/**
 * Motor MCTS genérico.
 */
export class MCTS<S extends GameState, M extends Move> {
  private engine: GameEngine<S, M>;
  private config: MCTSConfig;
  private rng: () => number;

  constructor(engine: GameEngine<S, M>, config: Partial<MCTSConfig> = {}) {
    this.engine = engine;
    this.config = {
      maxIterations: config.maxIterations ?? 10000,
      timeBudgetMs: config.timeBudgetMs ?? 3000,
      explorationConstant: config.explorationConstant ?? Math.SQRT2,
      useHeuristicRollout: config.useHeuristicRollout ?? false,
    };
    // Gerador de números aleatórios simples (pode ser substituído por seed)
    this.rng = Math.random;
  }

  /**
   * Define uma função geradora de números aleatórios (para reproducibilidade).
   */
  setRNG(rng: () => number): void {
    this.rng = rng;
  }

  /**
   * Computa a melhor jogada para o estado atual usando MCTS.
   */
  computeMove(state: S, player: number): MCTSResult<M> {
    const startTime = Date.now();
    const root = new Node(state, null, player, null);

    // Pré-expande a raiz com as jogadas legais
    const validMoves = this.engine.getValidMoves(state);
    if (validMoves.length === 0) {
      return {
        move: null,
        iterations: 0,
        elapsedMs: 0,
        totalNodes: 1,
        winRate: 0,
      };
    }

    root.unexpandedMoves = [...validMoves];
    root.isTerminal = this.engine.isGameOver(state);

    let iterations = 0;
    let totalNodes = 1;

    while (
      iterations < this.config.maxIterations &&
      Date.now() - startTime < this.config.timeBudgetMs
    ) {
      this.runIteration(root);
      iterations++;
      totalNodes = this.countNodes(root);
    }

    const bestMove = root.getBestMove();
    const bestChild = bestMove ? root.children.get(this.moveToString(bestMove)) : null;
    const winRate = bestChild && bestChild.visits > 0 ? bestChild.wins / bestChild.visits : 0;

    return {
      move: bestMove,
      iterations,
      elapsedMs: Date.now() - startTime,
      totalNodes,
      winRate,
    };
  }

  /**
   * Executa uma iteração MCTS completa: Selection → Expansion → Simulation → Backpropagation.
   */
  private runIteration(root: Node<S, M>): void {
    // 1. Selection: caminha pela árvore até encontrar nó não totalmente expandido ou terminal
    const selectedNode = this.select(root);

    // 2. Expansion: expande o nó selecionado se possível
    const expandedNode = this.expand(selectedNode);

    // 3. Simulation: simula a partir do nó expandido até terminal
    const winner = this.simulate(expandedNode);

    // 4. Backpropagation: propaga o resultado pela árvore
    expandedNode.backpropagate(winner);
  }

  /**
   * Seleção: escolhe o nó com maior UCB1 até encontrar nó não totalmente expandido ou terminal.
   */
  private select(node: Node<S, M>): Node<S, M> {
    let current = node;

    while (!current.isTerminal && current.unexpandedMoves.length === 0 && current.children.size > 0) {
      const child = current.selectChild(this.config.explorationConstant);
      if (!child) break;
      current = child;
    }

    return current;
  }

  /**
   * Expansão: expande o nó selecionado se ainda tiver jogadas não expandidas.
   */
  private expand(node: Node<S, M>): Node<S, M> {
    // Se o nó é terminal ou não tem jogadas para expandir, retorna ele mesmo
    if (node.isTerminal || node.unexpandedMoves.length === 0) {
      return node;
    }

    // Escolhe uma jogada aleatória para expandir
    const moveIndex = Math.floor(this.rng() * node.unexpandedMoves.length);
    const move = node.unexpandedMoves.splice(moveIndex, 1)[0]!;

    // Aplica a jogada para criar o novo estado
    const newState = this.engine.applyMove(node.state, move);

    // Determina o próximo jogador
    const nextPlayer = this.engine.getCurrentPlayer
      ? this.engine.getCurrentPlayer(newState)
      : this.inferPlayer(newState);

    // Cria o nó filho
    const child = new Node(newState, move, nextPlayer, node);
    child.isTerminal = this.engine.isGameOver(newState);

    // Pré-expande o filho com suas jogadas legais
    if (!child.isTerminal) {
      child.unexpandedMoves = this.engine.getValidMoves(newState);
    }

    // Adiciona ao mapa de filhos (usando string como chave para evitar problemas de referência)
    node.children.set(this.moveToString(move), child);

    return child;
  }

  /**
   * Simulação: rollout aleatório até terminal.
   */
  private simulate(node: Node<S, M>): number | null {
    let currentState = node.state;
    let currentPlayer = node.player;

    // Se já está terminal, retorna o vencedor
    if (node.isTerminal) {
      return this.engine.getWinner(currentState);
    }

    // Rollout até terminal
    let depth = 0;
    const maxDepth = 1000; // Previne loops infinitos

    while (!this.engine.isGameOver(currentState) && depth < maxDepth) {
      const validMoves = this.engine.getValidMoves(currentState);
      if (validMoves.length === 0) {
        // Se não tem jogadas legais mas não é terminal, alguém perdeu por bloqueio
        // Assumimos que o jogador atual perdeu
        return currentPlayer === 1 ? 2 : 1;
      }

      // Escolhe jogada aleatória (ou usa heurística se configurado)
      let chosenMove: M;
      if (this.config.useHeuristicRollout && this.engine.evaluate) {
        // Escolhe jogada com melhor heurística (com algum ruído para diversidade)
        const movesWithScore = validMoves.map((move) => {
          const nextState = this.engine.applyMove(currentState, move);
          const score = this.engine.evaluate(nextState, currentPlayer);
          return { move, score };
        });
        // Ordena por score e escolhe entre os top 3 com probabilidade
        movesWithScore.sort((a, b) => b.score - a.score);
        const topN = Math.min(3, movesWithScore.length);
        const pickIndex = Math.floor(this.rng() * topN);
        chosenMove = movesWithScore[pickIndex]!.move;
      } else {
        // Aleatório puro
        const moveIndex = Math.floor(this.rng() * validMoves.length);
        chosenMove = validMoves[moveIndex]!;
      }

      currentState = this.engine.applyMove(currentState, chosenMove);
      currentPlayer = this.engine.getCurrentPlayer
        ? this.engine.getCurrentPlayer(currentState)
        : this.inferPlayer(currentState);

      depth++;
    }

    return this.engine.getWinner(currentState);
  }

  /**
   * Infere o jogador atual do estado (fallback se getCurrentPlayer não está implementado).
   * Esta é uma implementação genérica que pode não funcionar para todos os jogos.
   */
  private inferPlayer(state: S): number {
    // Tenta acessar propriedade comum 'turn'
    if ("turn" in state && typeof state.turn === "number") {
      return state.turn as number;
    }
    // Fallback: assume jogador 1
    return 1;
  }

  /**
   * Converte uma jogada para string para usar como chave no mapa.
   */
  private moveToString(move: M): string {
    if (typeof move === "string") return move;
    if (typeof move === "number") return move.toString();
    return JSON.stringify(move);
  }

  /**
   * Conta o número total de nós na árvore (para estatísticas).
   */
  private countNodes(node: Node<S, M>): number {
    let count = 1;
    for (const child of node.children.values()) {
      count += this.countNodes(child);
    }
    return count;
  }
}
