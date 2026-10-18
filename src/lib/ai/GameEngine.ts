/**
 * Contrato genérico de motor de jogo para a IA (MCTS, Minimax, heurística).
 *
 * Qualquer jogo de tabuleiro/estratégia implementa esta interface e passa a
 * funcionar com a IA genérica do sistema — sem acoplar a IA às regras do jogo.
 */

/**
 * Estado de jogo. Deve ser tratado como IMUTÁVEL: `applyMove` devolve uma nova
 * instância e nunca altera a recebida (a árvore do MCTS depende disso).
 */
export type GameState = object;

/** Jogada genérica: a forma concreta é definida por cada jogo. */
export type Move = object;

export interface GameEngine<S extends GameState, M extends Move> {
  /** Todas as jogadas legais de quem deve jogar no estado atual (completo e determinístico). */
  getValidMoves(state: S): M[];

  /** Aplica a jogada e devolve um NOVO estado, sem mutar o recebido. */
  applyMove(state: S, move: M): S;

  /** O jogo terminou? */
  isGameOver(state: S): boolean;

  /** Vencedor da partida (null = em andamento ou empate). */
  getWinner(state: S): number | null;

  /**
   * Avaliação heurística do estado do ponto de vista de `player`.
   * Positivo = vantagem para `player`. Usada no corte de rollout.
   */
  evaluate(state: S, player: number): number;

  /** Jogador que deve jogar neste estado (número, consistente com getWinner). */
  getCurrentPlayer(state: S): number;

  /**
   * Chave estável da jogada — usada para deduplicar filhos na árvore.
   * Padrão: `JSON.stringify(move)`.
   */
  moveKey?(move: M): string;

  /**
   * Jogada sugerida pelo próprio jogo (ex.: estratégia básica do Blackjack).
   * Quando existe, a IA pode usá-la em vez da busca genérica.
   */
  suggestMove?(state: S, player: number): M | null;
}

/**
 * Chave estável de uma jogada, com rede de segurança para adaptadores que não
 * implementam `moveKey`.
 *
 * Sem isto, comparar `engine.moveKey?.(a) === engine.moveKey?.(b)` devolve
 * `undefined === undefined` → `true` para QUAISQUER duas jogadas. Duas
 * consequências reais: a verificação negamax nunca anexava os lances que não
 * foram simulados (o `!ordered.some(...)` dava sempre falso) e o filtro de
 * alternativas do `blunder` descartava todas as jogadas, de modo que os níveis
 * fáceis nunca erravam de propósito.
 *
 * O fallback ignora `timestamp` — ele é `Date.now()` em
 * `UniversalGameUtils.createMove` e faria duas jogadas idênticas parecerem
 * diferentes a cada chamada.
 */
export function chaveDaJogada<S extends GameState, M extends Move>(
  engine: GameEngine<S, M>,
  move: M,
): string {
  if (engine.moveKey) return engine.moveKey(move);
  return JSON.stringify(move, (campo, valor) => (campo === "timestamp" ? undefined : valor));
}
