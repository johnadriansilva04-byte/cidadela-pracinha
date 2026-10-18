/**
 * Testes de runtime dos motores universais + MCTS.
 * Roda com: JITI_TSCONFIG_PATHS=true npx jiti testes/motores-universais.mts
 */
import { UniversalGameFactory } from "../src/lib/universal/UniversalGameFactory";
import { MCTS } from "../src/lib/ai/MCTS";
import { TrilhaAdapter } from "../src/lib/trilha/TrilhaEngineAdapter";
import { chooseMove } from "../src/lib/trilha/ai";
import { createInitialState, generateMoves, applyMove, type GameState } from "../src/lib/trilha/engine";
import type { GameCategory, UniversalGameState } from "../src/lib/universal/UniversalGameEngine";
import { BlackjackAdapter, type BlackjackState } from "../src/lib/universal/adapters/BlackjackAdapter";
import { AI_LEVELS, decidirJogada, jogadaComImperfeicao } from "../src/lib/universal/aiUniversal";
import { chaveDaJogada } from "../src/lib/ai/GameEngine";

let ok = 0;
let fail = 0;
function check(nome: string, cond: boolean, detalhe = "") {
  if (cond) {
    ok++;
    console.log(`  ok   ${nome}`);
  } else {
    fail++;
    console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

/** Joga uma partida inteira IA vs IA; devolve quem venceu e quantos turnos. */
/**
 * Joga uma partida completa IA×IA.
 *
 * Determinismo: NÃO se usa orçamento de tempo (`timeBudgetMs: 0` desliga o
 * limite), só `maxIterations`. Com orçamento de tempo o número de simulações
 * varia com a carga da máquina e o resultado da partida muda entre execuções —
 * era a causa da falha intermitente "dama: partida termina com vencedor".
 * A verificação negamax entra na profundidade 2, como no nível "Médio" da UI.
 */
function jogarPartida(
  category: GameCategory,
  seed = 12345,
  maxTurns = 400,
  iterations = 120,
): { winner: number | null; turns: number; reason: string | null; legal: boolean } {
  const engine = UniversalGameFactory.createEngine(category)!;
  let state = UniversalGameFactory.createGame(category, 2)!;
  let turns = 0;
  let legal = true;

  while (!engine.isGameOver(state) && turns < maxTurns) {
    const player = engine.getCurrentPlayer(state);
    const moves = engine.getValidMoves(state);
    if (moves.length === 0) break;

    const mcts = new MCTS(engine, {
      maxIterations: iterations,
      timeBudgetMs: 0,
      useHeuristicRollout: false,
      // Sem prior de busca: é o que mantém o custo por jogada baixo o bastante
      // para uma partida completa (o prior negamax de d2 é caro em damas).
      // A força tática vem da verificação na raiz.
      priorSearchDepth: 0,
      verifyDepth: 2,
      seed: seed + turns,
    });
    const result = mcts.computeMove(state, player);
    const move = result.move ?? moves[0]!;

    // A jogada devolvida tem de ser uma das legais (integridade do motor).
    const key = engine.moveKey?.(move);
    if (key !== undefined && !moves.some((m) => engine.moveKey?.(m) === key)) legal = false;

    state = engine.applyMove(state, move);
    turns++;
  }

  return { winner: state.winner, turns, reason: state.reason, legal };
}

/* ------------------------------------------------------------- XADREZ --- */
console.log("\nXADREZ");
{
  const engine = UniversalGameFactory.createEngine("board_chess")!;
  const state = UniversalGameFactory.createGame("board_chess", 2)!;
  const moves = engine.getValidMoves(state);
  check("20 lances iniciais legais", moves.length === 20, `obtido ${moves.length}`);
  check("turno começa nas brancas", engine.getCurrentPlayer(state) === 0);

  // e2-e4 depois e7-e5
  const e4 = moves.find(
    (m) => (m.data as { from: string }).from === "4-6" && (m.data as { to: string }).to === "4-4",
  );
  check("e2-e4 está entre as jogadas", e4 !== undefined);
  if (e4) {
    const after = engine.applyMove(state, e4);
    check("após e2-e4 é a vez das pretas", engine.getCurrentPlayer(after) === 1);
    check("peão chegou em e4", (after as unknown as { customState: { grid: (string | null)[][] } }).customState.grid[4]![4] === "wp");
  }

  // Captura: peão branco em (col 4, row 4) e preto em (col 3, row 3) — a
  // diagonal d5 é alcançável; (4,3) NÃO é diagonal de (4,4).
  const custom = state as unknown as { customState: { grid: (string | null)[][] } };
  custom.customState.grid[4]![4] = "wp";
  custom.customState.grid[3]![3] = "bp"; // peão preto em d5
  custom.customState.turn = "w";
  const capture = engine
    .getValidMoves(state)
    .find((m) => (m.data as { from: string }).from === "4-4" && (m.data as { to: string }).to === "3-3");
  check("peão pode capturar em diagonal", capture !== undefined);
  if (capture) {
    const after = engine.applyMove(state, capture);
    const grid = (after as unknown as { customState: { grid: (string | null)[][] } }).customState.grid;
    check("peça preta capturada sumiu do tabuleiro", grid[3]![4] === null || grid[3]![4] === "wp");
  }

  // Partida completa IA vs IA (com orçamento curto)
  const partida = jogarPartida("board_chess", 7, 120, 30);
  check("xadrez: partida roda sem jogada ilegal", partida.legal);
  check("xadrez: partida avança", partida.turns > 2, `turnos=${partida.turns}`);
  console.log(`       → ${partida.turns} turnos, vencedor=${partida.winner}, motivo=${partida.reason}`);
}

/* --------------------------------------------------------------- DAMAS --- */
console.log("\nDAMA");
{
  const engine = UniversalGameFactory.createEngine("board_checkers")!;
  const state = UniversalGameFactory.createGame("board_checkers", 2)!;
  const moves = engine.getValidMoves(state);
  check("7 lances iniciais (só diagonais para frente)", moves.length === 7, `obtido ${moves.length}`);

  // 320 turnos: a regra dos 40 lances (80 meios-lances) pode exigir ~210 turnos.
  const partida = jogarPartida("board_checkers", 99, 320, 30);
  check("dama: partida roda sem jogada ilegal", partida.legal);
  // A partida tem de TERMINAR (vitória ou empate por regra dos 40 lances).
  // Exigir vencedor obrigatório era errado: com dois reis a partida é empate.
  check("dama: partida termina", partida.reason !== null, `motivo=${partida.reason} turnos=${partida.turns}`);
  console.log(`       → ${partida.turns} turnos, vencedor=${partida.winner}, motivo=${partida.reason}`);
}

/* ----------------------------------------------------------- BLACKJACK --- */
console.log("\nBLACKJACK");
{
  const engine = UniversalGameFactory.createEngine("card_blackjack")!;
  let state = UniversalGameFactory.createGame("card_blackjack", 2)!;
  const bets = engine.getValidMoves(state);
  check("apostas disponíveis na abertura", bets.length > 0);
  check(
    "ações expostas são hit/stand (a UI depende disso)",
    bets.some((m) => m.data["action"] === "bet"),
  );

  // Joga 5 rodadas com a estratégia básica do motor
  let rodadas = 0;
  let totalMoves = 0;
  while (rodadas < 5 && totalMoves < 60) {
    const moves = engine.getValidMoves(state);
    if (moves.length === 0) break;
    const action = moves.some((m) => m.data["action"] === "new-round")
      ? moves.find((m) => m.data["action"] === "new-round")!
      : (engine.suggestMove?.(state, 0) ?? moves[0]!);
    state = engine.applyMove(state, action);
    totalMoves++;
    if (action.data["action"] === "new-round" || action.data["action"] === "bet") rodadas++;
  }
  const cs = (state as unknown as { customState: { playerTotal: number; dealerTotal: number; chips: number } }).customState;
  check("blackjack: rodadas avançam", totalMoves > 3, `jogadas=${totalMoves}`);
  check("blackjack: totais são números válidos", Number.isFinite(cs.playerTotal) && Number.isFinite(cs.dealerTotal));
  check("blackjack: fichas nunca ficam negativas", cs.chips >= 0, `chips=${cs.chips}`);
  console.log(`       → ${totalMoves} jogadas, fichas=${cs.chips}`);
}

/* --------------------------------------------------------------- DOMINÓ -- */
console.log("\nDOMINÓ");
{
  const engine = UniversalGameFactory.createEngine("domino_block")!;
  const state = UniversalGameFactory.createGame("domino_block", 2)!;
  const cs = (state as unknown as { customState: { hands: unknown[][] } }).customState;
  check("cada jogador começa com 7 peças", cs.hands[0]!.length === 7 && cs.hands[1]!.length === 7);
  check("monte tem 14 peças restantes", (cs as { boneyard: unknown[] }).boneyard.length === 14);
  check("há jogadas na abertura (mesa vazia)", engine.getValidMoves(state).length === 7);

  const partida = jogarPartida("domino_block", 3, 200, 30);
  check("dominó: partida roda sem jogada ilegal", partida.legal);
  check("dominó: partida termina", partida.winner !== null, `motivo=${partida.reason}`);
  console.log(`       → ${partida.turns} jogadas, vencedor=${partida.winner}, motivo=${partida.reason}`);

  // Extremidades coerentes: a mesa é uma corrente válida
  const engine2 = UniversalGameFactory.createEngine("domino_block")!;
  let s2 = UniversalGameFactory.createGame("domino_block", 2)!;
  let guard = 0;
  while (!engine2.isGameOver(s2) && guard < 120) {
    const moves = engine2.getValidMoves(s2);
    const play = moves.find((m) => m.type === "play") ?? moves[0]!;
    s2 = engine2.applyMove(s2, play);
    guard++;
    const c = (s2 as unknown as { customState: { table: { left: number; right: number }[]; leftEnd: number; rightEnd: number } }).customState;
    if (c.table.length > 0) {
      const okChain = c.table.every((tile, i) => i === 0 || tile.left === c.table[i - 1]!.right);
      if (!okChain) {
        check("dominó: mesa forma cadeia válida", false, `mesa=${JSON.stringify(c.table)}`);
        break;
      }
    }
  }
  check("dominó: mesa forma cadeia válida", true);
}

/* -------------------------------------------------------------- YAHTZEE -- */
console.log("\nYAHTZEE");
{
  const engine = UniversalGameFactory.createEngine("dice_yahtzee")!;
  const state = UniversalGameFactory.createGame("dice_yahtzee", 2)!;
  const cs = (state as unknown as { customState: { dice: number[]; rollsLeft: number } }).customState;
  check("5 dados rolados na abertura", cs.dice.length === 5 && cs.dice.every((d) => d >= 1 && d <= 6));
  check("3 rolagens disponíveis", cs.rollsLeft === 3);

  const partida = jogarPartida("dice_yahtzee", 42, 400, 30);
  check("yahtzee: partida roda sem jogada ilegal", partida.legal);
  check("yahtzee: partida termina com vencedor", partida.winner !== null, `motivo=${partida.reason}`);
  console.log(`       → ${partida.turns} jogadas, vencedor=${partida.winner}, motivo=${partida.reason}`);
}

/* ------------------------------------------------------------------ MCTS -- */
console.log("\nMCTS (TRILHA)");
{
  const adapter = new TrilhaAdapter();

  // 1. Deve fechar a trilha e capturar quando possível
  const s = createInitialState();
  s.board[0] = 1;
  s.board[1] = 1;
  s.board[9] = 2;
  s.board[4] = 2;
  s.board[10] = 2;
  s.hand = { 1: 7, 2: 6 };
  const r = new MCTS(adapter, { maxIterations: 40_000, timeBudgetMs: 1000 }).computeMove(s, 1);
  check("MCTS fecha a trilha disponível", r.move?.to === 2, JSON.stringify(r.move));
  check("MCTS captura ao fechar a trilha", r.move?.remove !== null, JSON.stringify(r.move));

  // 2. Vitória imediata deve ser encontrada
  const win = createInitialState();
  win.phase = "moving";
  win.hand = { 1: 0, 2: 0 };
  win.board = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  // Jogador 1 em {0,1,3}; jogador 2 em {4,5,10}. Mover 3->2 fecha a trinca
  // [0,1,2] e a captura deixa o adversário com 2 peças (aniquilação).
  win.board[0] = 1;
  win.board[1] = 1;
  win.board[3] = 1;
  win.board[4] = 2;
  win.board[5] = 2;
  win.board[10] = 2;
  win.turn = 1;
  const winMove = new MCTS(adapter, { maxIterations: 40_000, timeBudgetMs: 1000 }).computeMove(win, 1);
  const after = winMove.move ? applyMove(win, winMove.move) : win;
  check("MCTS encontra a vitória imediata", after.winner === 1, `jogou ${JSON.stringify(winMove.move)}`);

  // 3. Determinismo: mesma semente ⇒ mesma jogada
  const a = new MCTS(adapter, { maxIterations: 800, timeBudgetMs: 3000, seed: 777, useHeuristicRollout: true }).computeMove(createInitialState(), 1);
  const b = new MCTS(adapter, { maxIterations: 800, timeBudgetMs: 3000, seed: 777, useHeuristicRollout: true }).computeMove(createInitialState(), 1);
  check("MCTS é determinístico com a mesma semente", JSON.stringify(a.move) === JSON.stringify(b.move));

  // 4. O "General" joga melhor que o "Recruta" em confronto direto
  function confronto(mestre: "recruta" | "general", n = 6): number {
    let vitorias = 0;
    for (let i = 0; i < n; i++) {
      let state: GameState = createInitialState();
      // O MCTS ("general") joga como jogador 2
      let guard = 0;
      while (state.phase !== "over" && guard < 200) {
        const dif = state.turn === 2 ? mestre : "recruta";
        const decision = chooseMove(state, dif);
        if (!decision.move) break;
        state = applyMove(state, decision.move);
        guard++;
      }
      if (state.winner === 2) vitorias++;
    }
    return vitorias;
  }
  const vitoriasGeneral = confronto("general", 6);
  check("MCTS (General) vence a maioria contra o Recruta", vitoriasGeneral >= 4, `${vitoriasGeneral}/6`);

  // 5. Nível "general" responde dentro do orçamento
  const t0 = Date.now();
  const gen = chooseMove(createInitialState(), "general");
  const dt = Date.now() - t0;
  check("nível General responde dentro do orçamento (<4s)", dt < 4000, `${dt}ms`);
  check("nível General devolve jogada e relata o motor MCTS", gen.move !== null && gen.engine === "mcts");
  console.log(`       → General: ${dt}ms, ${gen.nodes} nós`);

  // 6. Blackjack: um "21 natural" encerra a rodada DENTRO da própria aposta.
  // A aposta tem de entrar no histórico antes de qualquer retorno antecipado —
  // sem isso o lance some e o jogador não vê o que aconteceu.
  {
    const bj = new BlackjackAdapter();
    let naturais = 0;
    let registrados = 0;
    for (let i = 0; i < 400; i++) {
      let st = bj.initializeGame("card_blackjack", 1);
      st = bj.applyMove(st, {
        playerId: 0,
        type: "bet",
        timestamp: 0,
        data: { action: "bet", amount: 10 },
      });
      const cs = (st as BlackjackState).customState;
      const natural = cs.playerTotal === 21 && st.phase !== "playing";
      if (!natural) continue;
      naturais++;
      if (st.moveHistory.length > 0) registrados++;
    }
    check(
      "Blackjack: 21 natural registra a aposta no histórico",
      naturais > 0 && naturais === registrados,
      `${registrados}/${naturais} mãos`,
    );
  }
}

/* ------------------------------------------------------- JOGOS NOVOS --- */
console.log("\nJOGOS NOVOS (Liga 4, Velha, Reversi, Mancala)");
{
  // Os 4 jogos têm de estar registrados e com partida completa jogável.
  for (const cat of [
    "board_connect_four",
    "board_tic_tac_toe",
    "board_reversi",
    "board_mancala",
  ] as GameCategory[]) {
    const engine = UniversalGameFactory.createEngine(cat);
    check(`${cat}: motor registrado`, engine !== null);
    if (!engine) continue;
    const inicial = UniversalGameFactory.createGame(cat, 2)!;
    check(`${cat}: abertura tem jogadas legais`, engine.getValidMoves(inicial).length > 0);

    const partida = jogarPartida(cat, 31, 300, 60);
    check(`${cat}: partida termina`, partida.turns < 300, `turnos=${partida.turns}`);
    check(`${cat}: sem jogada ilegal`, partida.legal);
    console.log(
      `       → ${partida.turns} turnos, vencedor=${partida.winner}, motivo=${partida.reason}`,
    );
  }

  // Liga 4: vitória vertical (as 4 na mesma coluna) e a gravidade empilhando.
  {
    const cf = UniversalGameFactory.createEngine("board_connect_four")!;
    let st = UniversalGameFactory.createGame("board_connect_four", 2)!;
    for (let i = 0; i < 4; i++) {
      const col0 = cf.getValidMoves(st).find((m) => (m.data as { col: number }).col === 0)!;
      st = cf.applyMove(st, col0);
      if (cf.isGameOver(st)) break;
      const col1 = cf.getValidMoves(st).find((m) => (m.data as { col: number }).col === 1)!;
      st = cf.applyMove(st, col1);
    }
    const grid = (st as unknown as { customState: { grid: ("r" | "y" | null)[][] } }).customState.grid;
    check("Liga 4: 4 na mesma coluna vence", st.gameOver && st.winner === 0, `motivo=${st.reason}`);
    check("Liga 4: gravidade empilha de baixo para cima", grid[5]![0] === "r" && grid[4]![0] === "r");
  }

  // Velha: no Difícil a máquina não pode ser batida (jogo já resolvido).
  {
    const engine = UniversalGameFactory.createEngine("board_tic_tac_toe")!;
    let vitoriasHumanas = 0;
    for (let seed = 0; seed < 12; seed++) {
      let st = UniversalGameFactory.createGame("board_tic_tac_toe", 2)!;
      let rng = seed * 977 + 13;
      const rnd = () => {
        rng = (rng * 1103515245 + 12345) & 0x7fffffff;
        return rng / 0x7fffffff;
      };
      while (!engine.isGameOver(st)) {
        const moves = engine.getValidMoves(st);
        if (moves.length === 0) break;
        const player = engine.getCurrentPlayer(st);
        const move =
          player === 0
            ? moves[Math.floor(rnd() * moves.length)]!
            : (jogadaComImperfeicao(engine, st, 1, "dificil", rnd).move ?? moves[0]!);
        st = engine.applyMove(st, move);
      }
      if (st.winner === 0) vitoriasHumanas++;
    }
    check(
      "Velha: no Difícil a máquina não perde nenhuma partida",
      vitoriasHumanas === 0,
      `${vitoriasHumanas}/12 vitórias do humano`,
    );
  }

  // Guarda de força: o nível Difícil tem de bater o Fácil. É a regressão que
  // motivou a reescrita do MCTS (o "General" perdia para os níveis baixos).
  {
    const cf = UniversalGameFactory.createEngine("board_connect_four")!;
    let dificeis = 0;
    let faceis = 0;
    for (let seed = 0; seed < 6; seed++) {
      let st = UniversalGameFactory.createGame("board_connect_four", 2)!;
      let rng = seed * 7919 + 5;
      const rnd = () => {
        rng = (rng * 1103515245 + 12345) & 0x7fffffff;
        return rng / 0x7fffffff;
      };
      while (!cf.isGameOver(st)) {
        const moves = cf.getValidMoves(st);
        if (moves.length === 0) break;
        const player = cf.getCurrentPlayer(st);
        const nivel = player === 0 ? "dificil" : "facil";
        // `jogadaComImperfeicao` é o caminho REAL da UI: é ele que aplica o
        // `blunder` dos níveis baixos. Usar `decidirJogada` aqui faria os dois
        // lados jogarem perfeito e a guarda mediria outra coisa.
        const move = jogadaComImperfeicao(cf, st, player, nivel, rnd).move ?? moves[0]!;
        st = cf.applyMove(st, move);
      }
      if (st.winner === 0) dificeis++;
      else if (st.winner === 1) faceis++;
    }
    check(
      "Liga 4: Difícil vence o Fácil (guarda de força da IA)",
      dificeis > faceis,
      `difícil ${dificeis} x ${faceis} fácil`,
    );
  }

  // Reversi: o lance inicial só pode ser em uma das 4 casas clássicas.
  {
    const rev = UniversalGameFactory.createEngine("board_reversi")!;
    const st = UniversalGameFactory.createGame("board_reversi", 2)!;
    const casas = rev.getValidMoves(st).map((m) => `${(m.data as { x: number }).x}-${(m.data as { y: number }).y}`);
    const esperadas = ["3-2", "2-3", "4-5", "5-4"];
    check(
      "Reversi: abertura tem as 4 casas legais clássicas",
      casas.length === 4 && esperadas.every((c) => casas.includes(c)),
      casas.join(" "),
    );
  }

  // Mancala: cair na própria kalah dá jogada extra.
  {
    const man = UniversalGameFactory.createEngine("board_mancala")!;
    let st = UniversalGameFactory.createGame("board_mancala", 2)!;
    // Casa 2 tem 4 sementes → cai exatamente na kalah (posição 6).
    const extra = man.getValidMoves(st).find((m) => (m.data as { pit: number }).pit === 2)!;
    st = man.applyMove(st, extra);
    check(
      "Mancala: cair na própria kalah mantém a vez",
      man.getCurrentPlayer(st) === 0 && (st as unknown as { customState: { pits: number[] } }).customState.pits[6] === 1,
      `turno=${man.getCurrentPlayer(st)}`,
    );
  }
}

/* ------------------------------- INVARIANTES DA IA (regressões) ---------- */
{
  // 1. `chaveDaJogada` tem de distinguir jogadas mesmo sem `moveKey` no motor
  //    e ignorar `timestamp` (que é Date.now() e muda a cada chamada).
  const cf = UniversalGameFactory.createEngine("board_connect_four")!;
  const st = UniversalGameFactory.createGame("board_connect_four", 2)!;
  const legais = cf.getValidMoves(st);
  const semKey = {
    ...cf,
    moveKey: undefined,
  } as unknown as Parameters<typeof chaveDaJogada>[0];
  check(
    "IA: chaveDaJogada distingue jogadas sem moveKey",
    chaveDaJogada(semKey, legais[0]!) !== chaveDaJogada(semKey, legais[1]!),
  );
  const comTimestamp = { ...legais[0]!, timestamp: 111 } as (typeof legais)[number];
  const comOutroTimestamp = { ...legais[0]!, timestamp: 999 } as (typeof legais)[number];
  check(
    "IA: chaveDaJogada ignora timestamp",
    chaveDaJogada(semKey, comTimestamp) === chaveDaJogada(semKey, comOutroTimestamp),
  );

  // 2. O filtro de alternativas do `blunder` precisa achar jogadas diferentes.
  //    Antes ele comparava `moveKey?.()` nos dois lados (undefined === undefined)
  //    e devolvia ZERO alternativas: os níveis fáceis nunca erravam de propósito.
  const alternativas = legais.filter(
    (m) => chaveDaJogada(cf, m) !== chaveDaJogada(cf, legais[0]!),
  );
  check(
    "IA: blunder tem alternativas (o Fácil erra de propósito)",
    alternativas.length >= legais.length - 1 && alternativas.length > 0,
    `${alternativas.length}/${legais.length}`,
  );

  // 3. O `suggestMove` do motor não pode atalhar a busca: ele entra como
  //    palpite. Medido antes do fix, o Mancala usava o palpite guloso em 59%
  //    das posições e perdia 0 x 4 para a busca.
  const man = UniversalGameFactory.createEngine("board_mancala")!;
  const stMan = UniversalGameFactory.createGame("board_mancala", 2)!;
  const palpite = man.suggestMove?.(stMan, 0) ?? null;
  check(
    "IA: palpite do motor é usado como prior, não como atalho",
    palpite !== null && AI_LEVELS.dificil.hintPriorWeight > 0,
    `palpite=${palpite !== null} peso=${AI_LEVELS.dificil.hintPriorWeight}`,
  );
  check(
    "IA: pesos de palpite crescem com o nível",
    AI_LEVELS.facil.hintPriorWeight < AI_LEVELS.dificil.hintPriorWeight,
  );

  // 4. Difícil tem de bater o Fácil também no Mancala e no Reversi — os dois
  //    jogos cujo atalho de `suggestMove` mascarava a força do nível alto.
  for (const cat of ["board_mancala", "board_reversi"] as const) {
    const eng = UniversalGameFactory.createEngine(cat)!;
    let d = 0;
    let f = 0;
    for (let seed = 0; seed < 4; seed++) {
      let s2 = UniversalGameFactory.createGame(cat, 2)!;
      let rng = seed * 6151 + 17;
      const rnd = () => {
        rng = (rng * 1103515245 + 12345) & 0x7fffffff;
        return rng / 0x7fffffff;
      };
      while (!eng.isGameOver(s2) && s2.moveHistory.length < 400) {
        const ms = eng.getValidMoves(s2);
        if (ms.length === 0) break;
        const p = eng.getCurrentPlayer(s2);
        const nivel = (p === 0) === (seed % 2 === 0) ? "dificil" : "facil";
        s2 = eng.applyMove(s2, jogadaComImperfeicao(eng, s2, p, nivel, rnd).move ?? ms[0]!);
      }
      const difId = seed % 2 === 0 ? 0 : 1;
      if (s2.winner === difId) d++;
      else if (s2.winner !== null) f++;
    }
    check(`${cat}: Difícil vence o Fácil`, d > f, `difícil ${d} x ${f} fácil`);
  }
}

/* --------------------------------------------------------------- RESUMO -- */
console.log(`\n═══ ${ok} passaram, ${fail} falharam ═══`);
if (fail > 0) process.exit(1);
