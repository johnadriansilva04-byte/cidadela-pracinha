/**
 * Interface genérica para motores de jogos que integram com IA (MCTS, Minimax, etc.).
 * Qualquer jogo de tabuleiro/estratégia pode implementar esta interface para usar
 * a IA genérica do sistema.
 */
export interface GameState {
  /** Estado serializável do jogo (deve ser imutável após aplicação de jogadas) */
  readonly [key: string]: any;
}

export interface Move {
  /** Representação de uma jogada (tipo depende do jogo) */
  readonly [key: string]: any;
}

export interface GameEngine<S extends GameState, M extends Move> {
  /**
   * Retorna todas as jogadas legais para o estado atual.
   * Deve ser determinístico e completo.
   */
  getValidMoves(state: S): M[];

  /**
   * Aplica uma jogada ao estado e retorna o novo estado.
   * Não deve modificar o estado original (imutabilidade).
   */
  applyMove(state: S, move: M): S;

  /**
   * Verifica se o jogo terminou.
   */
  isGameOver(state: S): boolean;

  /**
   * Retorna o vencedor do jogo (null se não acabou, empate, ou jogo em andamento).
   * Identificador do jogador: deve ser consistente com a implementação do jogo.
   */
  getWinner(state: S): number | null;

  /**
   * Avaliação heurística do estado para um jogador específico.
   * Valores positivos = vantagem para o jogador, negativos = desvantagem.
   * Opcional para MCTS puro, mas útil para MCTS com UCB1 tuneado.
   */
  evaluate(state: S, player: number): number;

  /**
   * Retorna o jogador que deve jogar no estado atual.
   * Opcional se o estado já tiver essa informação.
   */
  getCurrentPlayer?(state: S): number;
}
