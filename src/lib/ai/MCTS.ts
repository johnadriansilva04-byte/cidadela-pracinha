/**
 * MCTS (Monte Carlo Tree Search) genérico com UCT.
 *
 * Ciclo por iteração:
 *   1. Seleção    — desce a árvore pelo maior UCB1 até um nó não totalmente expandido
 *   2. Expansão   — cria UM filho para uma jogada ainda não expandida
 *   3. Simulação  — rollout até o fim da partida
 *   4. Retroprop. — propaga o resultado pelos ancestrais
 *
 * Duas decisões de projeto que fazem este MCTS ser forte em jogos táticos
 * (Trilha, Damas, Xadrez simplificado) e não apenas "aleatório educado":
 *
 *  a) PERSPECTIVA ÚNICA — `wins` conta vitórias do jogador que estamos
 *     decidindo, constante em toda a árvore. A seleção UCB1 é sempre
 *     maximizadora, sem inversão de sinal entre níveis (o erro clássico que
 *     faz a IA jogar contra si mesma).
 *
 *  b) PRIOR HEURÍSTICO — ao criar um filho, ele nasce com "visitas virtuais"
 *     proporcionais à avaliação heurística do estado. Isso enviesa a busca
 *     para lances promissores desde a primeira iteração, sem impedir que as
 *     simulações reais corrijam o palpite. A decisão final usa APENAS
 *     simulações reais (`sims`), nunca o prior.
 *
 * O motor é agnóstico ao jogo: tudo vem do `GameEngine` recebido.
 * Determinismo: `seed` / `setRNG()` reproduzem uma busca inteira.
 */
import { chaveDaJogada, type GameEngine, type GameState, type Move } from "./GameEngine";

export interface MCTSConfig<M extends Move = Move> {
  /** Número máximo de iterações (simulações). */
  maxIterations: number;
  /** Orçamento de tempo em milissegundos (o que estourar primeiro encerra). */
  timeBudgetMs: number;
  /** Constante de exploração C do UCB1 (padrão √2 ≈ 1.4142). */
  explorationConstant: number;
  /**
   * Rollout heurístico: em vez de jogada aleatória, sorteia entre as melhores
   * segundo `evaluate`. Converge com muito menos iterações em jogos táticos,
   * ao custo de rollouts mais caros — por isso vem combinado com
   * `heuristicPlies`, que limita o trecho caro do rollout.
   */
  useHeuristicRollout: boolean;
  /**
   * Quantas jogadas INICIAIS do rollout usam o sorteio heurístico. Depois
   * disso o rollout passa a ser aleatório (barato). A abertura do rollout é
   * onde a qualidade tática importa; o final aleatório só serve para chegar
   * ao resultado. 0 = heurístico em todo o rollout.
   */
  heuristicPlies: number;
  /**
   * Profundidade máxima do rollout (em jogadas). 0 = sem limite.
   * Ao estourar, o resultado é decidido pela heurística.
   */
  maxRolloutDepth: number;
  /**
   * Avaliar a posição por heurística ao atingir `rolloutCutoffPly`, em vez de
   * jogar até o fim. É o que torna o rollout barato o bastante para caber
   * muitas simulações no orçamento: em vez de ~100 jogadas aleatórias, o
   * rollout faz `rolloutCutoffPly` jogadas e avalia.
   *
   * 0 desliga o corte (rollout completo até o fim da partida).
   */
  rolloutCutoffPly: number;
  /** Quantas jogadas do rollout heurístico entram no sorteio (padrão 3). */
  heuristicTopN: number;
  /**
   * Peso do prior heurístico em "visitas virtuais" ao criar um filho.
   * 0 desliga o prior (MCTS puro).
   */
  priorWeight: number;
  /** Escala da normalização da heurística antes do prior (padrão 300). */
  priorScale: number;
  /**
   * Profundidade de uma busca negamax rasa usada para calcular o VALOR de um
   * nó recém-criado. Com 0, o prior usa a heurística estática.
   *
   * É o que dá base tática ao MCTS: a heurística estática não enxerga uma
   * captura de dois lances à frente, então um prior estático faz a busca
   * Monte Carlo perder para um minimax raso. Com `priorSearchDepth >= 2`, o
   * valor inicial de cada filho já embute a tática e o MCTS refina a partir
   * daí.
   */
  priorSearchDepth: number;
  /**
   * Escala do sigmoide que converte a vantagem heurística do rollout cortado
   * numa recompensa em (0,1). Menor = mais sensível a vantagens pequenas.
   */
  rolloutValueScale: number;
  /**
   * Profundidade da verificação negamax feita DEPOIS da busca, sobre todas as
   * jogadas legais, na ordem em que o MCTS as priorizou. 0 desliga.
   *
   * O MCTS é robusto em posições incertas mas impreciso em táticas curtas,
   * porque decide pela média de poucas simulações por jogada. O negamax é
   * exato no horizonte que alcança. Ver `src/lib/trilha/ai.ts` — a mesma
   * combinação é o motor "General" da Trilha, medida em `testes/bench-forca.mts`.
   */
  verifyDepth: number;
  /**
   * Fração do orçamento RESERVADA para a verificação negamax (0..1).
   *
   * Sem reserva, a busca consome o relógio inteiro e `verifyDeadline` já nasce
   * vencido — a verificação então não roda NENHUMA vez. O efeito era perverso:
   * níveis com `maxIterations` alto (Difícil) saturavam o tempo e ficavam SEM
   * verificação, enquanto níveis baixos, que terminam antes do prazo, ainda
   * ganhavam a checagem tática — o Difícil jogava PIOR que o Fácil.
   */
  verifyTimeShare: number;
  /**
   * Jogada recomendada pelo próprio jogo (`suggestMove`), usada como PALPITE:
   * é tentada primeiro na verificação e recebe prior na árvore. Substituir a
   * busca por ela capava a força do nível Difícil (v. `decidirJogada`).
   */
  hintMove: M | null;
  /** Peso do prior dado ao palpite (0 = desliga). */
  hintPriorWeight: number;
  /** Semente do RNG (reprodutibilidade). */
  seed: number;
}

/** Estatística de uma jogada candidata na raiz da busca. */
export interface RootMoveStat<M> {
  move: M;
  /** Visitas totais (reais + prior). */
  visits: number;
  /** Simulações reais — base da confiança. */
  sims: number;
  /** Taxa de vitória estimada do jogador de referência (0..1). */
  winRate: number;
}

export interface MCTSResult<M> {
  /** Melhor jogada encontrada (null se não havia jogada legal). */
  move: M | null;
  /** Iterações efetivamente executadas. */
  iterations: number;
  /** Tempo total em milissegundos. */
  elapsedMs: number;
  /** Total de nós criados na árvore. */
  totalNodes: number;
  /** Taxa de vitória estimada da jogada escolhida, do ponto de vista do jogador (0..1). */
  winRate: number;
  /** Simulações reais acumuladas na jogada escolhida (confiança da decisão). */
  visits: number;
  /**
   * Estatísticas de TODAS as jogadas candidatas da raiz, ordenadas por
   * simulações. É o que permite um árbitro externo (negamax) revisar as
   * candidatas que a busca Monte Carlo considerou mais promissoras.
   */
  rootMoves: RootMoveStat<M>[];
}

/* ------------------------------------------------------------------ RNG -- */

/** mulberry32 — RNG pequeno e determinístico (mesma semente ⇒ mesma sequência). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normaliza uma heurística arbitrária para (0, 1) — usada no prior. */
function sigmoid(value: number, scale: number): number {
  const x = value / Math.max(1, scale);
  if (x >= 0) return 1 / (1 + Math.exp(-x));
  const e = Math.exp(x);
  return e / (1 + e);
}

/* ------------------------------------------------------------------ Node -- */

/**
 * Nó da árvore MCTS.
 * `wins` conta vitórias do jogador de referência (`perspective`), constante em
 * toda a árvore, o que mantém a seleção UCB1 uniformemente maximizadora.
 */
class Node<S extends GameState, M extends Move> {
  readonly state: S;
  /** Jogada que levou até este nó (null na raiz). */
  readonly move: M | null;
  /** Jogador para quem a busca está sendo feita (constante na árvore). */
  readonly perspective: number;
  readonly parent: Node<S, M> | null;
  readonly children: Node<S, M>[] = [];

  /** Visitas totais (reais + prior) — é o N do UCB1. */
  visits = 0;
  /** Vitórias do jogador de referência (reais + prior). */
  wins = 0;
  /** Simulações REAIS (sem prior) — base da decisão final. */
  sims = 0;
  /** Soma das heurísticas terminais — desempata partidas empatadas. */
  score = 0;

  /** Jogadas legais ainda não transformadas em filho. */
  private readonly unexpanded: M[];
  /** `true` quando o jogo já terminou neste nó (folha definitiva). */
  readonly isTerminal: boolean;

  constructor(
    state: S,
    move: M | null,
    perspective: number,
    parent: Node<S, M> | null,
    unexpanded: M[],
    isTerminal: boolean,
  ) {
    this.state = state;
    this.move = move;
    this.perspective = perspective;
    this.parent = parent;
    this.unexpanded = unexpanded;
    this.isTerminal = isTerminal;
  }

  /** Quantas jogadas ainda podem ser expandidas. */
  unexpandedCount(): number {
    return this.unexpanded.length;
  }

  /** Ainda há jogadas para expandir? */
  hasUnexpanded(): boolean {
    return this.unexpanded.length > 0;
  }

  /** Remove e devolve a jogada não expandida no índice dado (null se acabaram). */
  takeUnexpanded(index: number): M | null {
    if (this.unexpanded.length === 0) return null;
    const [move] = this.unexpanded.splice(index, 1);
    return move === undefined ? null : move;
  }

  /** Semeia o nó com o palpite heurístico (visitas virtuais). */
  applyPrior(weight: number, probability: number): void {
    if (weight <= 0) return;
    this.visits += weight;
    this.wins += weight * probability;
  }

  /**
   * UCB1 = exploração + bônus de exploração.
   * Filho nunca visitado tem prioridade infinita, garantindo que todo filho
   * receba ao menos uma simulação antes de a busca aprofundar.
   */
  ucb1(explorationConstant: number, parentVisits: number): number {
    if (this.visits === 0) return Number.POSITIVE_INFINITY;
    const exploitation = this.wins / this.visits;
    const exploration =
      explorationConstant * Math.sqrt(Math.log(Math.max(1, parentVisits)) / this.visits);
    return exploitation + exploration;
  }

  /** Filho mais promissor pelo UCB1. */
  bestChildByUcb(explorationConstant: number): Node<S, M> | null {
    let best: Node<S, M> | null = null;
    let bestValue = Number.NEGATIVE_INFINITY;
    for (const child of this.children) {
      const value = child.ucb1(explorationConstant, this.visits);
      if (value > bestValue) {
        bestValue = value;
        best = child;
      }
    }
    return best;
  }

  /**
   * Decisão final: MAIOR número de simulações REAIS (critério robusto do MCTS,
   * imune ao prior). Empate é resolvido por taxa de vitória e, por fim, pela
   * heurística acumulada — nunca pela ordem de inserção.
   */
  bestChild(): Node<S, M> | null {
    let best: Node<S, M> | null = null;
    for (const child of this.children) {
      if (best === null) {
        best = child;
        continue;
      }
      if (child.sims !== best.sims) {
        if (child.sims > best.sims) best = child;
        continue;
      }
      const childRate = child.sims > 0 ? child.wins / child.sims : 0;
      const bestRate = best.sims > 0 ? best.wins / best.sims : 0;
      if (childRate !== bestRate) {
        if (childRate > bestRate) best = child;
        continue;
      }
      if (child.score > best.score) best = child;
    }
    return best;
  }

  /**
   * Retropropagação: sobe até a raiz somando visitas e creditando a
   * recompensa (0..1) ao jogador de referência da busca.
   *
   * A recompensa é CONTÍNUA de propósito. Antes era booleana ("venci ou não")
   * e o rollout, quando cortava por profundidade, convertia a heurística em
   * booleano com `value > 0` — uma vantagem de 0,02 contava como vitória cheia
   * e a busca perdia o sinal de grandeza. Com a média de recompensas, o UCB1
   * distingue "vantagem pequena" de "vantagem grande".
   */
  backpropagate(reward: number, heuristic: number): void {
    let node: Node<S, M> | null = this;
    while (node !== null) {
      node.visits++;
      node.sims++;
      node.wins += reward;
      node.score += heuristic;
      node = node.parent;
    }
  }
}

/* ------------------------------------------------------------------ MCTS -- */

export class MCTS<S extends GameState, M extends Move> {
  private readonly engine: GameEngine<S, M>;
  private readonly config: MCTSConfig<M>;
  private rng: () => number;
  /**
   * Chave do palpite (`hintMove`) no estado atual, ou null. Recriada a cada
   * `computeMove` porque depende do estado, não da config.
   */
  private hintKey: string | null = null;
  /**
   * Instante-limite da busca em curso (0 = sem limite). O rollout consulta
   * este valor: uma única simulação pode custar centenas de ms (xadrez), e
   * sem a checagem interna o orçamento era estourado por uma iteração inteira
   * — na prática o "Fácil" (250ms) travava a UI por 4s.
   */
  private deadline = 0;
  /**
   * Prazo da fase de VERIFICAÇÃO (0 = sem limite). O orçamento do MCTS não
   * cobre o negamax da raiz, que é sem limite por natureza: sem este teto o
   * nível Difícil estourava o orçamento (medido: 2937ms para um orçamento de
   * 1800ms no xadrez) e travava a UI. Quando estoura, a verificação para e
   * mantém o melhor lance já confirmado.
   */
  private verifyDeadline = 0;

  constructor(engine: GameEngine<S, M>, config: Partial<MCTSConfig<M>> = {}) {
    this.engine = engine;
    this.config = {
      maxIterations: config.maxIterations ?? 10_000,
      timeBudgetMs: config.timeBudgetMs ?? 3_000,
      explorationConstant: config.explorationConstant ?? Math.SQRT2,
      useHeuristicRollout: config.useHeuristicRollout ?? false,
      heuristicPlies: config.heuristicPlies ?? 0,
      maxRolloutDepth: config.maxRolloutDepth ?? 400,
      // Padrão 30: o rollout avalia em vez de jogar até o fim, o que triplica
      // as simulações no mesmo orçamento. Medido em `testes/bench-forca.mts`.
      rolloutCutoffPly: config.rolloutCutoffPly ?? 30,
      heuristicTopN: config.heuristicTopN ?? 3,
      priorWeight: config.priorWeight ?? 2,
      priorScale: config.priorScale ?? 300,
      priorSearchDepth: config.priorSearchDepth ?? 0,
      rolloutValueScale: config.rolloutValueScale ?? 400,
      verifyDepth: config.verifyDepth ?? 0,
      verifyTimeShare: config.verifyTimeShare ?? 0.25,
      hintMove: config.hintMove ?? null,
      hintPriorWeight: config.hintPriorWeight ?? 0,
      seed: config.seed ?? 0x9e3779b9,
    };
    this.rng = mulberry32(this.config.seed);
  }

  /** Troca o gerador de aleatórios (reprodutibilidade). */
  setRNG(rng: () => number): void {
    this.rng = rng;
  }

  /**
   * Executa a busca e devolve a jogada mais simulada da raiz.
   * @param state estado atual (não é mutado)
   * @param player jogador para quem estamos decidindo
   */
  computeMove(state: S, player: number): MCTSResult<M> {
    const startedAt = Date.now();
    const rootMoves = this.engine.getValidMoves(state);

    if (rootMoves.length === 0) {
      return {
        move: null,
        iterations: 0,
        elapsedMs: 0,
        totalNodes: 1,
        winRate: 0,
        visits: 0,
        rootMoves: [],
      };
    }

    // Atalho tático: vitória imediata não precisa de busca.
    const instantWin = this.findInstantWin(state, player, rootMoves);
    if (instantWin !== null) {
      return {
        move: instantWin,
        iterations: 0,
        elapsedMs: Date.now() - startedAt,
        totalNodes: 1,
        winRate: 1,
        visits: 0,
        rootMoves: [{ move: instantWin, visits: 1, sims: 1, winRate: 1 }],
      };
    }

    // O palpite do motor vai para a FRENTE da lista: a verificação negamax
    // percorre nessa ordem, então o lance recomendado é avaliado primeiro e
    // as podas alfa-beta ficam mais eficazes.
    this.hintKey = this.config.hintMove ? chaveDaJogada(this.engine, this.config.hintMove) : null;
    if (this.hintKey !== null) {
      const idx = rootMoves.findIndex((m) => chaveDaJogada(this.engine, m) === this.hintKey);
      if (idx > 0) {
        const [palpite] = rootMoves.splice(idx, 1);
        if (palpite !== undefined) rootMoves.unshift(palpite);
      }
    }

    const root = new Node<S, M>(
      state,
      null,
      player,
      null,
      [...rootMoves],
      this.engine.isGameOver(state),
    );

    let iterations = 0;
    let totalNodes = 1;

    const temPrazo = this.config.timeBudgetMs > 0;
    const fimDoOrcamento = startedAt + this.config.timeBudgetMs;
    // A busca para cedo para deixar `verifyTimeShare` do orçamento à
    // verificação. Sem essa reserva o relógio acabava antes dela começar e o
    // Difícil ficava sem checagem tática (v. `verifyTimeShare`).
    const reserva = this.config.verifyDepth > 0 ? this.config.verifyTimeShare : 0;
    this.deadline = temPrazo
      ? startedAt + this.config.timeBudgetMs * (1 - reserva)
      : 0;
    try {
      while (
        iterations < this.config.maxIterations &&
        (this.deadline === 0 || Date.now() < this.deadline)
      ) {
        totalNodes += this.iterate(root);
        iterations++;
      }
    } finally {
      this.deadline = 0;
    }

    // A verificação usa o restante do orçamento (a fatia reservada acima).
    this.verifyDeadline = temPrazo ? fimDoOrcamento : 0;

    const best = root.bestChild();

    const rootStats: RootMoveStat<M>[] = root.children
      .filter((child): child is Node<S, M> & { move: M } => child.move !== null)
      .map((child) => ({
        move: child.move,
        visits: child.visits,
        sims: child.sims,
        winRate: child.sims > 0 ? child.wins / child.sims : 0,
      }))
      .sort((a, b) => b.sims - a.sims || b.visits - a.visits);

    // Verificação tática: o MCTS define a ORDEM (candidatas mais simuladas
    // primeiro, o que maximiza os cortes alfa-beta); o negamax decide.
    let chosen = best?.move ?? null;
    try {
      if (this.config.verifyDepth > 0) {
        // `rootMoves` é a lista COMPLETA de lances legais: a verificação nunca
        // deixa um lance sem avaliação por não ter sido simulado.
        const ordered = rootStats.map((entry) => entry.move);
        const vistas = new Set(ordered.map((m) => chaveDaJogada(this.engine, m)));
        for (const move of rootMoves) {
          const chave = chaveDaJogada(this.engine, move);
          if (vistas.has(chave)) continue;
          vistas.add(chave);
          ordered.push(move);
        }
        chosen = this.verifyRoot(state, player, ordered) ?? chosen;
      }
    } finally {
      // Mesmo se a verificação lançar, o prazo não pode vazar para a próxima
      // jogada (travaria a busca seguinte com um prazo já vencido).
      this.verifyDeadline = 0;
    }

    const winRate = best && best.sims > 0 ? best.wins / best.sims : 0;

    return {
      move: chosen,
      iterations,
      elapsedMs: Date.now() - startedAt,
      totalNodes,
      winRate,
      visits: best?.sims ?? 0,
      rootMoves: rootStats,
    };
  }

  /** Existe jogada que vence a partida imediatamente? */
  private findInstantWin(state: S, player: number, moves: M[]): M | null {
    for (const move of moves) {
      let next: S;
      try {
        next = this.engine.applyMove(state, move);
      } catch {
        continue;
      }
      if (this.engine.isGameOver(next) && this.engine.getWinner(next) === player) return move;
    }
    return null;
  }

  /** Uma iteração completa. Devolve quantos nós foram criados (0 ou 1). */
  private iterate(root: Node<S, M>): number {
    // 1. SELEÇÃO — desce enquanto o nó tem filhos e nada a expandir
    let node = root;
    while (!node.isTerminal && !node.hasUnexpanded() && node.children.length > 0) {
      const next = node.bestChildByUcb(this.config.explorationConstant);
      if (next === null) break;
      node = next;
    }

    // 2. EXPANSÃO — uma jogada nova por iteração
    let created = 0;
    if (!node.isTerminal && node.hasUnexpanded()) {
      const child = this.expand(node);
      if (child !== null) {
        node = child;
        created = 1;
      }
    }

    // 3. SIMULAÇÃO
    const { reward, heuristic } = this.simulate(node);

    // 4. RETROPROPAGAÇÃO
    node.backpropagate(reward, heuristic);

    return created;
  }

  /** Cria um filho para uma jogada ainda não expandida (índice sorteado ⇒ sem viés de ordem). */
  private expand(parent: Node<S, M>): Node<S, M> | null {
    const count = parent.unexpandedCount();
    if (count === 0) return null;

    const index = Math.min(count - 1, Math.floor(this.rng() * count));
    const move = parent.takeUnexpanded(index);
    if (move === null) return null;

    let next: S;
    try {
      next = this.engine.applyMove(parent.state, move);
    } catch {
      return null;
    }

    const terminal = this.engine.isGameOver(next);
    const moves = terminal ? [] : this.engine.getValidMoves(next);
    const child = new Node<S, M>(next, move, parent.perspective, parent, moves, terminal);

    if (this.config.priorWeight > 0) {
      const raw =
        this.config.priorSearchDepth > 0
          ? this.searchValue(next, parent.perspective, this.config.priorSearchDepth)
          : this.engine.evaluate(next, parent.perspective);
      if (Number.isFinite(raw)) {
        child.applyPrior(this.config.priorWeight, sigmoid(raw, this.config.priorScale));
      }
    }

    // O palpite do motor ganha prior extra: a busca ainda pode descartá-lo,
    // mas precisa gastar simulações para provar que ele é ruim.
    if (
      this.config.hintPriorWeight > 0 &&
      this.hintKey !== null &&
      chaveDaJogada(this.engine, move) === this.hintKey
    ) {
      child.applyPrior(this.config.hintPriorWeight, 0.75);
    }

    parent.children.push(child);
    return child;
  }

  /**
   * Revisa TODAS as jogadas legais com negamax e devolve a melhor.
   *
   * O MCTS sozinho decide pela média de simulações, o que é impreciso quando o
   * orçamento dá poucas simulações por jogada (jogos com muitos lances legais,
   * como damas e xadrez). O negamax é exato no horizonte que alcança; usar a
   * ordem do MCTS como ordenação de lances maximiza os cortes alfa-beta e,
   * portanto, a profundidade efetiva. Empate de valor fica com o lance que o
   * MCTS mais simulou (já em primeiro na ordem), preservando a exploração.
   */
  private verifyRoot(state: S, player: number, ordered: M[]): M | null {
    let best: M | null = null;
    let bestValue = Number.NEGATIVE_INFINITY;
    let alpha = Number.NEGATIVE_INFINITY;

    for (const move of ordered) {
      // Prazo estourado: para e mantém o melhor lance JÁ confirmado. Continuar
      // travaria a UI; parar cedo devolve um lance verificado, nunca um palpite.
      if (this.verifyDeadline !== 0 && Date.now() >= this.verifyDeadline) break;

      let child: S;
      try {
        child = this.engine.applyMove(state, move);
      } catch {
        continue;
      }
      // `negamax` aqui já devolve o valor sob a ótica de `player` (usa min/max
      // conforme quem joga), então NÃO se nega o resultado. A raiz é
      // maximizadora: mantém-se alfa e a janela vai até +infinito.
      const value = this.negamax(
        child,
        player,
        this.config.verifyDepth - 1,
        alpha,
        Number.POSITIVE_INFINITY,
      );
      if (value > bestValue) {
        bestValue = value;
        best = move;
      }
      if (value > alpha) alpha = value;
    }
    return best;
  }

  /**
   * Negamax raso com poda alfa-beta — usado como prior de expansão.
   * Devolve o valor da posição para `player` na escala da heurística do jogo.
   */
  private searchValue(state: S, player: number, depth: number): number {
    return this.negamax(state, player, depth, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
  }

  private negamax(state: S, player: number, depth: number, alpha: number, beta: number): number {
    // Corte por prazo: devolve a avaliação estática, como faria um corte por
    // profundidade. Mantém os valores na mesma escala e impede que uma linha
    // longa estoure o orçamento. Vale para os DOIS prazos: o da busca (o prior
    // de expansão também usa negamax e sem teto estourava o "Fácil") e o da
    // verificação.
    const prazo = this.verifyDeadline !== 0 ? this.verifyDeadline : this.deadline;
    if (prazo !== 0 && Date.now() >= prazo) {
      return this.engine.evaluate(state, player);
    }
    if (this.engine.isGameOver(state)) {
      const winner = this.engine.getWinner(state);
      if (winner === null) return 0;
      return winner === player ? 100_000 : -100_000;
    }
    if (depth <= 0) return this.engine.evaluate(state, player);

    const moves = this.engine.getValidMoves(state);
    if (moves.length === 0) return -100_000;

    const actor = this.engine.getCurrentPlayer(state);
    const maximizing = actor === player;
    let best = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;

    for (const move of moves) {
      let child: S;
      try {
        child = this.engine.applyMove(state, move);
      } catch {
        continue;
      }
      const value = this.negamax(child, player, depth - 1, alpha, beta);
      if (maximizing) {
        if (value > best) best = value;
        if (best > alpha) alpha = best;
      } else {
        if (value < best) best = value;
        if (best < beta) beta = best;
      }
      if (alpha >= beta) break;
    }
    return best;
  }

  /**
   * Rollout até o fim da partida.
   * Devolve se o jogador de referência venceu e a heurística terminal
   * (normalizada) para desempatar partidas empatadas.
   */
  private simulate(node: Node<S, M>): { reward: number; heuristic: number } {
    const perspective = node.perspective;

    if (node.isTerminal) {
      return {
        reward: this.rewardOf(node.state, perspective),
        heuristic: this.heuristic(node.state, perspective),
      };
    }

    let state = node.state;
    let depth = 0;
    const maxDepth = this.config.maxRolloutDepth;

    while (!this.engine.isGameOver(state)) {
      // Corte antecipado: avalia em vez de jogar até o fim. Barateia muito o
      // rollout e mantém a decisão ancorada na heurística.
      const cutoff = this.config.rolloutCutoffPly;
      // O estouro do orçamento também encerra o rollout: em jogos caros uma
      // única simulação não pode consumir todo o tempo da jogada.
      const estourou = this.deadline !== 0 && Date.now() >= this.deadline;
      if (estourou || (cutoff > 0 && depth >= cutoff) || (maxDepth > 0 && depth >= maxDepth)) {
        // A vantagem heurística vira uma recompensa em (0,1) — preserva a
        // grandeza. `value > 0` tratava toda posição favorável como vitória.
        const value = this.engine.evaluate(state, perspective);
        return {
          reward: Number.isFinite(value) ? sigmoid(value, this.config.rolloutValueScale) : 0.5,
          heuristic: this.heuristic(state, perspective),
        };
      }

      const moves = this.engine.getValidMoves(state);
      if (moves.length === 0) {
        // Sem jogadas e o motor não declarou fim: quem devia jogar está bloqueado.
        const stuck = this.engine.getCurrentPlayer(state);
        return {
          reward: stuck === perspective ? 0 : 1,
          heuristic: this.heuristic(state, perspective),
        };
      }

      const move = this.pickRolloutMove(state, moves, depth);
      if (move === null) break;
      state = this.engine.applyMove(state, move);
      depth++;
    }

    return {
      reward: this.rewardOf(state, perspective),
      heuristic: this.heuristic(state, perspective),
    };
  }

  /** Recompensa 0..1 da posição terminal para `perspective` (empate = 0,5). */
  private rewardOf(state: S, perspective: number): number {
    const winner = this.engine.getWinner(state);
    if (winner === null) return 0.5;
    return winner === perspective ? 1 : 0;
  }

  /**
   * Escolhe a jogada do rollout.
   * `ply` é a profundidade já percorrida: dentro de `heuristicPlies` o rollout
   * sorteia entre as melhores jogadas (caro, mas tático); depois disso passa a
   * aleatório, que é ~20× mais barato e suficiente para chegar ao resultado.
   */
  private pickRolloutMove(state: S, moves: M[], ply: number): M | null {
    if (moves.length === 1) return moves[0] ?? null;

    const withinHeuristic =
      this.config.useHeuristicRollout &&
      (this.config.heuristicPlies <= 0 || ply < this.config.heuristicPlies);

    if (!withinHeuristic) {
      return moves[Math.floor(this.rng() * moves.length)] ?? null;
    }

    const actor = this.engine.getCurrentPlayer(state);
    const scored: Array<{ move: M; score: number }> = [];
    for (const move of moves) {
      let score = Number.NEGATIVE_INFINITY;
      try {
        score = this.engine.evaluate(this.engine.applyMove(state, move), actor);
      } catch {
        score = Number.NEGATIVE_INFINITY;
      }
      scored.push({ move, score });
    }
    scored.sort((a, b) => b.score - a.score);

    const topN = Math.min(Math.max(1, this.config.heuristicTopN), scored.length);
    return scored[Math.floor(this.rng() * topN)]?.move ?? null;
  }

  /** Heurística terminal normalizada em [-1, 1] — não domina a taxa de vitória. */
  private heuristic(state: S, perspective: number): number {
    const raw = this.engine.evaluate(state, perspective);
    if (!Number.isFinite(raw)) return 0;
    return Math.max(-1, Math.min(1, raw / 1000));
  }
}
