/**
 * Adaptador de MANCALA / KALAH.
 *
 * Regras implementadas (variante Kalah 6+1):
 *  - 6 casas + 1 kalah (depósito) por lado; 4 sementes por casa no início
 *  - distribui as sementes no sentido anti-horário, uma por casa
 *  - o kalah do ADVERSÁRIO é pulado na distribuição
 *  - terminou na própria kalah: joga de novo
 *  - terminou numa casa PRÓPRIA que estava vazia: captura a casa oposta
 *  - fim: quando um lado zera as casas, o outro recolhe o restante
 *
 * O tabuleiro é um vetor único de 14 posições (0..5 = jogador 0, 6 = kalah do
 * jogador 0, 7..12 = jogador 1, 13 = kalah do jogador 1). O estado guarda esse
 * vetor em `customState.pits`, e a jogada é o ÍNDICE DA CASA (`data.pit`).
 */
import {
  UniversalGameUtils,
  type GameBoard,
  type GameCategory,
  type GameMove,
  type GamePiece,
  type UniversalGameEngine,
  type UniversalGameState,
} from "../UniversalGameEngine";

/** Casas por lado. */
export const MANCALA_PITS = 6;
/** Total de posições: 6 + kalah + 6 + kalah. */
const TOTAL = MANCALA_PITS * 2 + 2;
/** Sementes iniciais por casa. */
const SEEDS = 4;

export interface MancalaCustomState {
  /** 14 posições. 0..5 = jogador 0; 6 = kalah 0; 7..12 = jogador 1; 13 = kalah 1. */
  pits: number[];
}

export interface MancalaState extends UniversalGameState {
  customState: MancalaCustomState;
}

export interface MancalaMove extends GameMove {
  data: { pit: number };
}

/** Kalah (depósito) do jogador. */
function kalahOf(player: number): number {
  return player === 0 ? 6 : 13;
}

/** Faixa de casas do jogador: [inicio, fim] inclusive. */
function rangeOf(player: number): [number, number] {
  return player === 0 ? [0, 5] : [7, 12];
}

export class MancalaAdapter implements UniversalGameEngine {
  initializeGame(category: GameCategory, playerCount: number, variant?: string): MancalaState {
    const pits = Array.from({ length: TOTAL }, (_, i) =>
      i === 6 || i === 13 ? 0 : SEEDS,
    );

    const state: MancalaState = {
      gameCategory: "board_mancala",
      gameId: `mancala-${Date.now()}`,
      players: [
        UniversalGameUtils.createPlayer(0, "Você", false),
        UniversalGameUtils.createPlayer(1, "IA", true),
      ],
      currentPlayer: 0,
      turnOrder: [0, 1],
      board: this.buildBoard(),
      pieces: [],
      deck: [],
      phase: "playing",
      round: 1,
      scores: { 0: 0, 1: 0 },
      activeRules: ["standard", "capture", "extra-turn"],
      variant: variant ?? "standard",
      moveHistory: [],
      lastMove: null,
      gameOver: false,
      winner: null,
      reason: null,
      customState: { pits },
    };
    state.pieces = this.syncPieces(state);
    state.scores = { 0: pits[6]!, 1: pits[13]! };
    return state;
  }

  private buildBoard(): GameBoard {
    const board = UniversalGameUtils.createGridBoard(TOTAL, 1);
    board.customState = { pits: TOTAL };
    return board;
  }

  private syncPieces(state: MancalaState): GamePiece[] {
    const pieces: GamePiece[] = [];
    const pits = state.customState.pits;
    for (let i = 0; i < TOTAL; i++) {
      const qtd = pits[i]!;
      const dono = i === 13 ? 1 : i === 6 ? 0 : i < 6 ? 0 : 1;
      for (let s = 0; s < qtd; s++) {
        pieces.push({
          id: `seed-${i}-${s}`,
          type: "stone",
          owner: dono,
          position: { x: i, y: 0 },
          data: { pit: i },
        });
      }
    }
    return pieces;
  }

  getValidMoves(state: MancalaState): MancalaMove[] {
    if (state.gameOver) return [];
    const [inicio, fim] = rangeOf(state.currentPlayer);
    const moves: MancalaMove[] = [];
    for (let pit = inicio; pit <= fim; pit++) {
      if (state.customState.pits[pit]! > 0) {
        moves.push({
          ...UniversalGameUtils.createMove(state.currentPlayer, "play", { pit }),
          data: { pit },
        });
      }
    }
    return moves;
  }

  applyMove(state: MancalaState, move: GameMove): MancalaState {
    const next = UniversalGameUtils.cloneState(state) as MancalaState;
    const pits = next.customState.pits;
    const pit = Number((move.data as { pit?: unknown }).pit);

    const [inicio, fim] = rangeOf(next.currentPlayer);
    if (pit < inicio || pit > fim || pits[pit]! === 0) return next; // ilegal

    let sementes = pits[pit]!;
    pits[pit] = 0;
    let pos = pit;
    const meuKalah = kalahOf(next.currentPlayer);
    const kalahDele = kalahOf(next.currentPlayer === 0 ? 1 : 0);

    while (sementes > 0) {
      pos = (pos + 1) % TOTAL;
      if (pos === kalahDele) continue; // pula o depósito do adversário
      pits[pos] = pits[pos]! + 1;
      sementes--;
    }

    next.lastMove = { ...move, playerId: next.currentPlayer, data: { pit } };
    next.moveHistory = [...next.moveHistory, next.lastMove];

    let jogaDeNovo = false;
    if (pos === meuKalah) {
      // Caiu na própria kalah: joga novamente.
      jogaDeNovo = true;
    } else {
      const [i2, f2] = rangeOf(next.currentPlayer);
      if (pos >= i2 && pos <= f2 && pits[pos] === 1) {
        // Caiu em casa própria que estava VAZIA: captura a oposta.
        const oposta = TOTAL - 2 - pos;
        const capturadas = pits[oposta]!;
        if (capturadas > 0) {
          pits[meuKalah] = pits[meuKalah]! + capturadas + 1;
          pits[pos] = 0;
          pits[oposta] = 0;
        }
      }
    }

    // Fim de jogo: um lado sem sementes nas casas → o outro recolhe o resto.
    const lado0Vazio = pits.slice(0, MANCALA_PITS).every((s) => s === 0);
    const lado1Vazio = pits.slice(7, 13).every((s) => s === 0);
    if (lado0Vazio || lado1Vazio) {
      const sobra0 = pits.slice(0, MANCALA_PITS).reduce((a, b) => a + b, 0);
      const sobra1 = pits.slice(7, 13).reduce((a, b) => a + b, 0);
      pits[6] = pits[6]! + sobra0;
      pits[13] = pits[13]! + sobra1;
      for (let i = 0; i < MANCALA_PITS; i++) pits[i] = 0;
      for (let i = 7; i <= 12; i++) pits[i] = 0;

      next.gameOver = true;
      next.phase = "finished";
      const a = pits[6]!;
      const b = pits[13]!;
      next.winner = a === b ? null : a > b ? 0 : 1;
      next.reason = "um lado ficou sem sementes";
    } else if (!jogaDeNovo) {
      next.currentPlayer = next.currentPlayer === 0 ? 1 : 0;
    }

    next.pieces = this.syncPieces(next);
    next.scores = { 0: pits[6]!, 1: pits[13]! };
    next.round = next.moveHistory.length + 1;
    return next;
  }

  isGameOver(state: MancalaState): boolean {
    return state.gameOver;
  }

  getWinner(state: MancalaState): number | null {
    return state.winner;
  }

  getCurrentPlayer(state: MancalaState): number {
    return state.currentPlayer;
  }

  /**
   * Avaliação: diferença das kalahs (o que realmente conta) somada a um bônus
   * pela sementes em casas que estão a um passo da própria kalah — de lá o
   * jogador garante o depósito e, com ele, jogar de novo.
   */
  evaluate(state: MancalaState, player: number): number {
    const pits = state.customState.pits;
    const meuKalah = kalahOf(player);
    const deleKalah = kalahOf(player === 0 ? 1 : 0);
    let score = (pits[meuKalah]! - pits[deleKalah]!) * 10;

    const [inicio, fim] = rangeOf(player);
    for (let pit = inicio; pit <= fim; pit++) {
      const sementes = pits[pit]!;
      if (sementes === 0) continue;
      // Distância até a própria kalah (considerando o pulo da kalah alheia).
      const distancia = pit < meuKalah ? meuKalah - pit : TOTAL - pit + meuKalah;
      if (distancia === sementes) score += 6; // cai exato na kalah → joga de novo
      if (sementes === 1) score -= 3; // casa vulnerável a captura
    }

    if (state.gameOver && state.winner !== null) {
      score += state.winner === player ? 100_000 : -100_000;
    }
    return score;
  }

  /** Prefere jogar de novo; senão o lance que mais captura. */
  suggestMove(state: MancalaState, player: number): GameMove | null {
    if (state.gameOver) return null;
    const moves = this.getValidMoves(state);
    if (moves.length === 0) return null;

    const meuKalah = kalahOf(player);
    for (const move of moves) {
      const pit = (move.data as { pit: number }).pit;
      const sementes = state.customState.pits[pit]!;
      if ((pit + sementes) % TOTAL === meuKalah) return move;
    }
    return null;
  }
}
