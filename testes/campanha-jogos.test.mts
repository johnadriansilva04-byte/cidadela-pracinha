/**
 * Testes do motor de campanha dos jogos (jiti).
 *
 *   ./node_modules/.bin/jiti testes/campanha-jogos.test.mts
 *
 * Cobre: progressão de fase, idempotência da recompensa, campanha concluída,
 * saneamento de JSONB corrompido e monotonicidade dos contadores.
 */
import {
  CAMPANHAS,
  JOGOS_MODO_PROPRIO,
  MISSAO_DO_JOGO,
  aplicarResultado,
  campanhaDe,
  chaveRecompensa,
  faseAtual,
  normalizarProgresso,
  progressoInicial,
  resumoCampanha,
  FORCA_IA,
} from "../src/lib/universal/campanhaJogos";

let passou = 0;
let falhou = 0;

function ok(condicao: boolean, nome: string) {
  if (condicao) {
    passou++;
  } else {
    falhou++;
    console.error(`  ✗ ${nome}`);
  }
}

const JOGOS = ["xadrez", "dama", "domino", "yahtzee", "blackjack"];

console.log("=== Campanha: estrutura ===");
for (const jogo of JOGOS) {
  const c = campanhaDe(jogo);
  ok(c !== null, `${jogo}: tem campanha`);
  ok(c!.fases.length === 4, `${jogo}: 4 fases`);
  ok(c!.patrono.length > 0, `${jogo}: tem patrono`);
  ok(
    c!.fases.every((f, i) => f.numero === i + 1),
    `${jogo}: fases numeradas 1..4 em ordem`,
  );
  ok(
    c!.fases.every((f) => f.recompensa > 0),
    `${jogo}: toda fase paga recompensa`,
  );
  ok(
    c!.fases.every((f) => f.historia.length > 20 && f.desfecho.length > 10),
    `${jogo}: fase tem história e desfecho`,
  );
  // Recompensa cresce: fase mais dura paga mais.
  const r = c!.fases.map((f) => f.recompensa);
  ok(
    r.every((v, i) => i === 0 || v >= r[i - 1]!),
    `${jogo}: recompensa não decresce`,
  );
}

console.log("=== Campanha: forças da IA crescentes ===");
for (const jogo of JOGOS) {
  const forcas = campanhaDe(jogo)!.fases.map((f) => FORCA_IA[f.forca].maxIterations);
  ok(
    forcas.every((v, i) => i === 0 || v > forcas[i - 1]!),
    `${jogo}: IA fica mais forte a cada fase`,
  );
}

console.log("=== Progressão de fase ===");
{
  let p = progressoInicial("xadrez");
  ok(p.fase === 1 && !p.concluida, "começa na fase 1");

  // Derrota não avança nem paga.
  const d = aplicarResultado(p, "derrota");
  ok(d.progresso.fase === 1, "derrota mantém a fase");
  ok(d.recompensa === 0, "derrota não paga");
  ok(!d.avancou, "derrota não avança");
  ok(d.progresso.derrotas === 1, "derrota conta");

  // Empate também não.
  const e = aplicarResultado(d.progresso, "empate");
  ok(e.progresso.fase === 1, "empate mantém a fase");
  ok(e.recompensa === 0, "empate não paga");
  ok(e.progresso.empates === 1, "empate conta");

  // Vitória avança e paga a recompensa da fase vencida.
  const v1 = aplicarResultado(e.progresso, "vitoria");
  ok(v1.progresso.fase === 2, "vitória avança para a fase 2");
  ok(v1.avancou, "marca avançou");
  ok(v1.recompensa === 3, "paga a recompensa da fase 1");
  ok(v1.progresso.sovGanha === 3, "acumula SOV ganho");
  ok(v1.progresso.vitorias === 1, "vitória conta");

  // Recompensa é por fase: a fase 2 paga diferente da 1.
  const v2 = aplicarResultado(v1.progresso, "vitoria");
  ok(v2.recompensa === 5, "fase 2 paga a recompensa dela");
  ok(v2.progresso.sovGanha === 8, "SOV soma");

  // Repetir a fase (perder e ganhar de novo) não paga duas vezes a mesma.
  const volta = aplicarResultado(v2.progresso, "derrota");
  const v3 = aplicarResultado(volta.progresso, "vitoria");
  ok(v3.recompensa === 8, "fase 3 paga a dela");
  ok(
    v3.progresso.sovGanha === 16,
    "soma exata: 3 + 5 + 8 (sem repetir fase)",
  );
}

console.log("=== Conclusão da campanha ===");
{
  let p = progressoInicial("dama");
  const total = campanhaDe("dama")!.fases.length;
  let somaEsperada = 0;
  for (let i = 1; i <= total; i++) {
    const r = aplicarResultado(p, "vitoria");
    somaEsperada += campanhaDe("dama")!.fases[i - 1]!.recompensa;
    p = r.progresso;
    if (i === total) {
      ok(r.concluiu, "última vitória conclui a campanha");
      ok(r.progresso.concluida, "marca concluída");
      ok(/concluída/i.test(r.mensagem), "mensagem fala de conclusão");
    }
  }
  ok(p.sovGanha === somaEsperada, `SOV total da campanha = ${somaEsperada}`);
  ok(p.fase === total, "para na última fase");

  // Depois de concluída, vencer não paga nem muda nada.
  const depois = aplicarResultado(p, "vitoria");
  ok(depois.recompensa === 0, "campanha concluída não paga de novo");
  ok(depois.progresso.fase === total, "não passa da última fase");
  ok(depois.progresso.concluida, "segue concluída");
  ok(depois.progresso.vitorias === p.vitorias + 1, "ainda contabiliza vitória");

  // Chave idempotente é única por jogo+fase e estável.
  ok(
    chaveRecompensa("dama", 3) === chaveRecompensa("dama", 3),
    "chave idempotente é estável",
  );
  ok(
    chaveRecompensa("dama", 3) !== chaveRecompensa("dama", 4),
    "chave muda por fase",
  );
  ok(
    chaveRecompensa("dama", 3) !== chaveRecompensa("xadrez", 3),
    "chave muda por jogo",
  );
}

console.log("=== Saneamento de JSONB torto ===");
{
  const ruim = normalizarProgresso("xadrez", {
    fase: 999,
    vitorias: -5,
    derrotas: "muito",
    empates: Number.NaN,
    concluida: "sim",
    sovGanha: Infinity,
  });
  const total = campanhaDe("xadrez")!.fases.length;
  ok(ruim.fase === total, "fase absurda é limitada ao total");
  ok(ruim.vitorias === 0, "vitória negativa vira 0");
  ok(ruim.derrotas === 0, "texto vira 0");
  ok(ruim.empates === 0, "NaN vira 0");
  ok(ruim.concluida === false, "concluida não-booleano vira false");
  ok(ruim.sovGanha === 0, "Infinity vira 0");

  ok(normalizarProgresso("xadrez", null).fase === 1, "null vira progresso inicial");
  ok(normalizarProgresso("xadrez", undefined).fase === 1, "undefined idem");
  ok(normalizarProgresso("xadrez", "lixo").fase === 1, "string vira inicial");
  ok(normalizarProgresso("xadrez", []).fase === 1, "array vira inicial");
  ok(
    normalizarProgresso("xadrez", { fase: 0 }).fase === 1,
    "fase 0 é elevada para 1",
  );
  ok(
    normalizarProgresso("xadrez", { fase: 2.7 }).fase === 2,
    "fase fracionária é truncada",
  );
  ok(
    normalizarProgresso("jogo-inexistente", {}).fase === 1,
    "jogo sem campanha não quebra",
  );
}

console.log("=== Modo próprio (não duplica campanha) ===");
for (const jogo of Object.keys(JOGOS_MODO_PROPRIO)) {
  ok(campanhaDe(jogo) === null, `${jogo}: não recebe fases (tem modo próprio)`);
  ok(
    JOGOS_MODO_PROPRIO[jogo]!.length > 30,
    `${jogo}: explica o modo próprio`,
  );
}
ok(campanhaDe("xadrez") !== null, "jogo sem modo próprio tem campanha");

console.log("=== Resumo para a UI ===");
{
  const r = resumoCampanha(progressoInicial("yahtzee"));
  ok(r !== null, "resumo existe");
  ok(r!.fase === 1 && r!.totalFases === 4, "resumo traz fase e total");
  ok(r!.tituloFase.length > 0, "resumo traz título da fase");
  ok(r!.objetivo.length > 0, "resumo traz objetivo");
  ok(r!.historia.length > 20, "resumo traz história");
  ok(r!.forcaLabel.length > 0, "resumo traz rótulo de força");
  ok(r!.sovGanha === 0, "resumo traz SOV ganho");
  ok(resumoCampanha(progressoInicial("botao")) === null, "modo próprio não tem resumo");

  // O resumo acompanha o progresso.
  const p = aplicarResultado(progressoInicial("yahtzee"), "vitoria").progresso;
  ok(resumoCampanha(p)!.fase === 2, "resumo acompanha a fase nova");
  ok(resumoCampanha(p)!.sovGanha === 3, "resumo acompanha o SOV");
}

console.log("=== faseAtual ===");
{
  ok(faseAtual(progressoInicial("blackjack"))!.numero === 1, "fase atual inicial");
  const p = aplicarResultado(progressoInicial("blackjack"), "vitoria").progresso;
  ok(faseAtual(p)!.numero === 2, "fase atual avança");
  ok(faseAtual(progressoInicial("botao")) === null, "sem campanha não tem fase");
}

console.log("=== Missão por jogo ===");
for (const jogo of ["botao", "trilha", "brio", ...JOGOS, "carbrawl"]) {
  ok(
    typeof MISSAO_DO_JOGO[jogo] === "string" && MISSAO_DO_JOGO[jogo]!.length > 0,
    `${jogo}: tem missão mapeada`,
  );
}

console.log("=== Determinismo ===");
{
  // Mesmo estado + mesmo resultado = mesmo output (sem Math.random).
  const a = aplicarResultado(progressoInicial("domino"), "vitoria");
  const b = aplicarResultado(progressoInicial("domino"), "vitoria");
  ok(JSON.stringify(a) === JSON.stringify(b), "mesmo input, mesmo output");

  // Não muta o progresso recebido.
  const original = progressoInicial("domino");
  const copia = JSON.stringify(original);
  aplicarResultado(original, "vitoria");
  ok(JSON.stringify(original) === copia, "não muta o progresso de entrada");
}

console.log(`\n${passou} passaram, ${falhou} falharam (total ${passou + falhou})`);
if (falhou > 0) process.exit(1);
console.log("CAMPANHA DOS JOGOS — OK");
