/**
 * Adaptador que implementa a interface GameEngine para o jogo de Trilha.
 * Permite que a Trilha use a IA genérica (MCTS, Minimax, etc.) do sistema.
 */
import { GameEngine, GameState, Move } from "@/lib/ai/GameEngine";
import {
  GameState as TrilhaState,
  Move as TrilhaMove,
  generateMoves,
  applyMove,
  opponent,
  evaluate as trilhaEvaluate,
} from "./engine";

export class TrilhaAdapter implements GameEngine<TrilhaState, TrilhaMove> {
  /**
   * Retorna todas as jogadas legais para o estado atual.
   */
  getValidMoves(state: TrilhaState): TrilhaMove[] {
    return generateMoves(state);
  }

  /**
   * Aplica uma jogada ao estado e retorna o novo estado.
   * O engine da Trilha já implementa imutabilidade via cloneState.
   */
  applyMove(state: TrilhaState, move: TrilhaMove): TrilhaState {
    return applyMove(state, move);
  }

  /**
   * Verifica se o jogo terminou.
   */
  isGameOver(state: TrilhaState): boolean {
    return state.phase === "over";
  }

  /**
   * Retorna o vencedor do jogo (1 ou 2), null se não acabou.
   */
  getWinner(state: TrilhaState): number | null {
    return state.winner;
  }

  /**
   * Avaliação heurística do estado para um jogador específico.
   * Reutiliza a função evaluate() existente do ai.ts da Trilha.
   */
  evaluate(state: TrilhaState, player: number): number {
    return trilhaEvaluate(state, player);
  }

  /**
   * Retorna o jogador que deve jogar no estado atual.
   */
  getCurrentPlayer(state: TrilhaState): number {
    return state.turn;
  }
}
