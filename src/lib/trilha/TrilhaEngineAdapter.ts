/**
 * Ponte entre o motor da Trilha (Nine Men's Morris) e a IA genérica
 * (`GameEngine` → MCTS/Minimax).
 *
 * O motor da Trilha já é imutável (`applyMove` clona), determinístico e
 * serializável — os requisitos exatos do contrato. Aqui só adaptamos nomes e
 * filtramos a jogada ambígua do "fechar trilha sem capturar".
 */
import type { GameEngine } from "@/lib/ai/GameEngine";
import {
  applyMove,
  evaluate,
  generateMoves,
  type GameState,
  type Move,
  type Player,
} from "./engine";

/** Chave estável da jogada — deduplica o mesmo lance na árvore. */
export function trilhaMoveKey(move: Move): string {
  return `${move.from ?? "p"}>${move.to}${move.remove === null ? "" : `x${move.remove}`}`;
}

export class TrilhaAdapter implements GameEngine<GameState, Move> {
  getValidMoves(state: GameState): Move[] {
    return generateMoves(state);
  }

  applyMove(state: GameState, move: Move): GameState {
    return applyMove(state, move);
  }

  isGameOver(state: GameState): boolean {
    return state.phase === "over";
  }

  getWinner(state: GameState): number | null {
    return state.winner;
  }

  evaluate(state: GameState, player: number): number {
    return evaluate(state, player as Player);
  }

  getCurrentPlayer(state: GameState): number {
    return state.turn;
  }

  moveKey(move: Move): string {
    return trilhaMoveKey(move);
  }
}
