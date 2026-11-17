/**
 * Testes do núcleo PURO do GUERRA DE BRIO.
 * Roda com: JITI_TSCONFIG_PATHS=true ./node_modules/.bin/jiti testes/brio-nucleo.test.mts
 */
import { AREAS, MODALIDADES, DIFICULDADES, totalSubcategorias, ordemDificuldade } from "../src/lib/brio/categorias";
import { ACERVO_BRIO_EQUILIBRADO as ACERVO_BRIO, GABARITO_LOCAL } from "../src/lib/brio/acervo";
import {
  apurarRodada,
  vencedorDoPlacar,
  precisaDesempate,
  avancarDesempate,
  dificuldadeDaRodada,
  perguntaValida,
  alternativasDistintas,
  chanceAcertoBot,
  letraErrada,
  aproveitamento,
} from "../src/lib/brio/duelo";
import {
  selecionarPerguntas,
  detectarDuplicatas,
  assinaturaPergunta,
  embaralhar,
  rngDe,
  fnv1a,
  mulberry32,
  similaridade,
} from "../src/lib/brio/selecao";
import {
  estimarHabilidade,
  parametrosIniciais,
  probabilidadeAcerto,
  calibrarItem,
  thetaParaIndice,
  indiceParaTheta,
  compararHabilidades,
  estimarPorArea,
  K_MINIMO,
} from "../src/lib/brio/tri";
import { LETRAS, DUELO } from "../src/lib/brio/types";

let passou = 0;
let falhou = 0;
const falhas: string[] = [];

function check(nome: string, cond: boolean) {
  if (cond) passou += 1;
  else {
    falhou += 1;
    falhas.push(nome);
  }
}

// ============ 1. CATEGORIAS ============
check("10 áreas de conhecimento", AREAS.length === 10);
check("5 modalidades de seleção", MODALIDADES.length === 5);
check("5 níveis de dificuldade", DIFICULDADES.length === 5);
check("mais de 80 subcategorias", totalSubcategorias() > 80);
check("slugs de área únicos", new Set(AREAS.map((a) => a.slug)).size === AREAS.length);
const todosSubs = AREAS.flatMap((a) => a.subcategorias.map((s) => s.slug));
check("slugs de subcategoria únicos", new Set(todosSubs).size === todosSubs.length);

// ============ 2. ACERVO ============
check("acervo com pelo menos 40 perguntas", ACERVO_BRIO.length >= 40);
check("ids do acervo únicos", new Set(ACERVO_BRIO.map((p) => p.id)).size === ACERVO_BRIO.length);
check("TODAS as perguntas têm 6 alternativas", ACERVO_BRIO.every((p) => p.alternativas.length === 6));
check(
  "TODAS as perguntas têm letras A-F na ordem",
  ACERVO_BRIO.every((p) => p.alternativas.map((a) => a.letra).join("") === LETRAS.join("")),
);
check(
  "TODAS as perguntas são válidas (perguntaValida)",
  ACERVO_BRIO.every((p) => perguntaValida({ ...p, alternativas: p.alternativas })),
);
check("TODAS as alternativas são distintas", ACERVO_BRIO.every((p) => alternativasDistintas(p)));
check(
  "gabarito é uma letra válida A-F em todas",
  ACERVO_BRIO.every((p) => LETRAS.includes(p.letraCorreta)),
);
check(
  "TODAS têm explicação não vazia",
  ACERVO_BRIO.every((p) => p.explicacao.trim().length > 20),
);
check("TODAS têm referência/fonte", ACERVO_BRIO.every((p) => (p.referencia ?? "").trim().length > 5));
check(
  "TODAS têm área e subcategoria existentes",
  ACERVO_BRIO.every((p) => AREAS.some((a) => a.slug === p.areaSlug)) &&
    ACERVO_BRIO.every((p) => todosSubs.includes(p.subcategoriaSlug)),
);
check("sem perguntas duplicadas", detectarDuplicatas(ACERVO_BRIO).length === 0);
check(
  "todas as áreas têm pelo menos 1 pergunta",
  AREAS.every((a) => ACERVO_BRIO.some((p) => p.areaSlug === a.slug)),
);
check(
  "todas as 5 dificuldades estão representadas",
  DIFICULDADES.every((d) => ACERVO_BRIO.some((p) => p.dificuldade === d.id)),
);
const distribuicaoCorreta = new Map<string, number>();
for (const p of ACERVO_BRIO) {
  distribuicaoCorreta.set(p.letraCorreta, (distribuicaoCorreta.get(p.letraCorreta) ?? 0) + 1);
}
check(
  "gabarito espalhado por mais de 4 letras (sem viés óbvio)",
  distribuicaoCorreta.size >= 5,
);
check(
  "o acervo não repete enunciado",
  new Set(ACERVO_BRIO.map((p) => p.enunciado)).size === ACERVO_BRIO.length,
);
check("GABARITO_LOCAL cobre todo o acervo", Object.keys(GABARITO_LOCAL).length === ACERVO_BRIO.length);

// ============ 3. DETERMINISMO ============
check("fnv1a é determinístico", fnv1a("brio") === fnv1a("brio"));
check("fnv1a distingue textos", fnv1a("brio") !== fnv1a("brioz"));
const r1 = mulberry32(42);
const r2 = mulberry32(42);
check("mulberry32 é reprodutível", r1() === r2() && r1() === r2());
const rngA = rngDe("partida-x");
const rngB = rngDe("partida-x");
check("rngDe é reprodutível pela chave", rngA() === rngB());
check("rngDe varia com a chave", rngDe("partida-a")() !== rngDe("partida-b")());
const base = [1, 2, 3, 4, 5, 6, 7, 8];
check("embaralhar não muta a entrada", embaralhar(base, rngDe("e")) !== base && base[0] === 1);
check("embaralhar preserva os elementos", embaralhar(base, rngDe("e")).sort((a, b) => a - b).join() === base.join());
check(
  "embaralhar é reprodutível pela mesma semente",
  embaralhar(base, rngDe("s")).join() === embaralhar(base, rngDe("s")).join(),
);

// ============ 4. SELEÇÃO / ANTIRREPETIÇÃO ============
const sel1 = selecionarPerguntas(
  ACERVO_BRIO,
  { modalidade: "multidisciplinar", areaSlug: null, subcategoriaSlug: null },
  { total: 10, historico: [], semente: "p1" },
);
check("seleciona o total pedido quando o acervo permite", sel1.perguntas.length === 10);
check("não repete pergunta na mesma partida", new Set(sel1.perguntas.map((p) => p.id)).size === 10);
check("acervo suficiente sinalizado corretamente", sel1.acervoInsuficiente === false);
const sel2 = selecionarPerguntas(
  ACERVO_BRIO,
  { modalidade: "multidisciplinar", areaSlug: null, subcategoriaSlug: null },
  { total: 10, historico: [], semente: "p1" },
);
check(
  "mesma semente ⇒ MESMA seleção (F5 estável)",
  sel1.perguntas.map((p) => p.id).join() === sel2.perguntas.map((p) => p.id).join(),
);
const sel3 = selecionarPerguntas(
  ACERVO_BRIO,
  { modalidade: "multidisciplinar", areaSlug: null, subcategoriaSlug: null },
  { total: 10, historico: [], semente: "p2" },
);
check(
  "sementes diferentes ⇒ seleções diferentes",
  sel1.perguntas.map((p) => p.id).join() !== sel3.perguntas.map((p) => p.id).join(),
);
check(
  "dificuldade é progressiva (primeira ≤ última)",
  ordemDificuldade(sel1.perguntas[0]!.dificuldade) <=
    ordemDificuldade(sel1.perguntas[sel1.perguntas.length - 1]!.dificuldade),
);
const selArea = selecionarPerguntas(
  ACERVO_BRIO,
  { modalidade: "categoria", areaSlug: "tecnologia", subcategoriaSlug: null },
  { total: 5, historico: [], semente: "p3" },
);
check(
  "modalidade categoria filtra SÓ a área escolhida",
  selArea.perguntas.every((p) => p.areaSlug === "tecnologia"),
);
const selSub = selecionarPerguntas(
  ACERVO_BRIO,
  { modalidade: "subcategoria", areaSlug: null, subcategoriaSlug: "astronomia" },
  { total: 3, historico: [], semente: "p4" },
);
check(
  "modalidade subcategoria filtra SÓ a subcategoria",
  selSub.perguntas.length > 0 && selSub.perguntas.every((p) => p.subcategoriaSlug === "astronomia"),
);
const historico = ACERVO_BRIO.slice(0, 30).map((p) => p.id);
const selHist = selecionarPerguntas(
  ACERVO_BRIO,
  { modalidade: "multidisciplinar", areaSlug: null, subcategoriaSlug: null },
  { total: 6, historico, semente: "p5" },
);
check(
  "antirrepetição evita o histórico recente quando há alternativa",
  selHist.perguntas.filter((p) => historico.includes(p.id)).length === 0,
);
const acervoMinusculo = ACERVO_BRIO.slice(0, 3);
const selPequeno = selecionarPerguntas(
  acervoMinusculo,
  { modalidade: "multidisciplinar", areaSlug: null, subcategoriaSlug: null },
  { total: 10, historico: [], semente: "p6" },
);
check("acervo pequeno devolve o que existe e sinaliza insuficiência", selPequeno.perguntas.length === 3 && selPequeno.acervoInsuficiente === true);

// ============ 5. DUPLICATAS ============
const a1 = ACERVO_BRIO[0]!;
check(
  "assinatura idêntica detecta pergunta igual",
  assinaturaPergunta(a1.enunciado, a1.alternativas) === assinaturaPergunta(a1.enunciado, a1.alternativas),
);
const dup = detectarDuplicatas([...ACERVO_BRIO, { ...a1, id: "br-copia" }]);
check("duplicata exata é detectada", dup.some((d) => d.id === "br-copia" && d.tipo === "identica"));
check("similaridade de texto igual é 1", similaridade("a b c", "a b c") === 1);
check("similaridade de textos distintos é baixa", similaridade("a b c", "x y z") === 0);

// ============ 6. REGRAS DO DUELO ============
check("ambos acertam ⇒ ambos pontuam", (() => {
  const r = apurarRodada(["j1", "j2"], { j1: "A", j2: "A" }, { j1: 1, j2: 2 }, "A");
  return r.pontos["j1"]! >= DUELO.PONTOS_ACERTO && r.pontos["j2"]! >= DUELO.PONTOS_ACERTO;
})());
check("ambos erram ⇒ ninguém pontua", (() => {
  const r = apurarRodada(["j1", "j2"], { j1: "B", j2: "C" }, { j1: 1, j2: 2 }, "A");
  return r.pontos["j1"] === 0 && r.pontos["j2"] === 0;
})());
check("só um acerta ⇒ só ele pontua", (() => {
  const r = apurarRodada(["j1", "j2"], { j1: "A", j2: "C" }, { j1: 1, j2: 2 }, "A");
  return r.pontos["j1"]! > 0 && r.pontos["j2"] === 0;
})());
check("quem responde primeiro leva o bônus de rapidez", (() => {
  const rapido = apurarRodada(["j1", "j2"], { j1: "A", j2: "A" }, { j1: 500, j2: 3000 }, "A");
  const lento = apurarRodada(["j1", "j2"], { j1: "A", j2: "A" }, { j1: 3000, j2: 500 }, "A");
  return rapido.pontos["j1"]! > lento.pontos["j1"]!;
})());
check("quem não respondeu não pontua", (() => {
  const r = apurarRodada(["j1", "j2"], { j1: "A", j2: null }, { j1: 1, j2: null }, "A");
  return r.pontos["j2"] === 0;
})());
check("vencedor do placar correto", (() => {
  const v = vencedorDoPlacar(["j1", "j2"], { j1: 30, j2: 10 });
  return v.vencedorId === "j1" && v.empate === false;
})());
check("empate no placar é detectado", vencedorDoPlacar(["j1", "j2"], { j1: 20, j2: 20 }).empate === true);
check("precisaDesempate só com placar igual", precisaDesempate({ j1: 20, j2: 20 }) === true && precisaDesempate({ j1: 20, j2: 10 }) === false);
check("morte súbita decide quando um só acerta", (() => {
  const d = avancarDesempate(["j1", "j2"], { j1: true, j2: false }, 1);
  return d.resolvido && d.vencedorId === "j1";
})());
check("morte súbita continua quando ambos acertam", (() => {
  const d = avancarDesempate(["j1", "j2"], { j1: true, j2: true }, 1);
  return !d.resolvido && d.rodada === 2;
})());
check("morte súbita respeita o limite de rodadas", (() => {
  const d = avancarDesempate(["j1", "j2"], { j1: true, j2: true }, DUELO.MAX_DESEMPATE);
  return d.resolvido;
})());
check("dificuldade cresce ao longo da partida", (() => {
  const t = DUELO.PERGUNTAS_POR_PARTIDA;
  return dificuldadeDaRodada(1, t) <= dificuldadeDaRodada(t, t) && dificuldadeDaRodada(t, t) === 5;
})());
check("aproveitamento percentual correto", aproveitamento(5, 10) === 50 && aproveitamento(0, 0) === 0);
check("bot nível 4 acerta mais que nível 1", (() => {
  let n1 = 0;
  let n4 = 0;
  for (let i = 0; i < 400; i += 1) {
    const x = i / 400;
    if (chanceAcertoBot(1, "dificil", x)) n1 += 1;
    if (chanceAcertoBot(4, "dificil", x)) n4 += 1;
  }
  return n4 > n1;
})());
check("letra do bot nunca é a correta", (() => {
  for (let i = 0; i < 50; i += 1) {
    if (letraErrada("C", i / 50) === "C") return false;
  }
  return true;
})());

// ============ 7. TRI ============
const itemFacil = parametrosIniciais("facil");
const itemDificil = parametrosIniciais("especialista");
check("b do fácil é menor que o do especialista", itemFacil.b < itemDificil.b);
check("c inicial é 1/6 (seis alternativas)", Math.abs(itemFacil.c - 1 / 6) < 1e-9);
check("parâmetros começam provisórios (não calibrados)", itemFacil.provisorio === true);
check(
  "probabilidade no ponto b vale (c+1)/2",
  Math.abs(probabilidadeAcerto(itemFacil.b, itemFacil) - (itemFacil.c + 1) / 2) < 1e-6,
);
check("probabilidade é monotônica crescente em θ", probabilidadeAcerto(2, itemFacil) > probabilidadeAcerto(-2, itemFacil));
check("probabilidade nunca fica abaixo do chute", probabilidadeAcerto(-8, itemFacil) >= itemFacil.c - 1e-9);
check("probabilidade nunca passa de 1", probabilidadeAcerto(8, itemFacil) <= 1 + 1e-9);
const semResposta = estimarHabilidade([]);
check("sem respostas ⇒ índice neutro 50", semResposta.indice === 50 && semResposta.n === 0);
check("sem respostas ⇒ confiabilidade 0", semResposta.confiabilidade === 0);

function simular(todosAcertos: boolean, n: number) {
  return Array.from({ length: n }, () => ({ item: itemFacil, acertou: todosAcertos }));
}
const acertaTudo = estimarHabilidade(simular(true, 10));
const erraTudo = estimarHabilidade(simular(false, 10));
check("acertar tudo eleva o índice acima de 50", acertaTudo.indice > 50);
check("errar tudo derruba o índice abaixo de 50", erraTudo.indice < 50);
check("acerta tudo tem θ maior que erra tudo", acertaTudo.theta > erraTudo.theta);

// Exemplo 2 do documento: erra fáceis mas acerta uma muito difícil.
const misto = estimarHabilidade([
  ...Array.from({ length: 5 }, () => ({ item: itemFacil, acertou: false })),
  { item: itemDificil, acertou: true },
]);
const consistente = estimarHabilidade([
  ...Array.from({ length: 4 }, () => ({ item: itemFacil, acertou: true })),
  { item: itemDificil, acertou: true },
]);
check(
  "acerto isolado numa difícil NÃO supera consistência em vários níveis",
  misto.theta < consistente.theta,
);
check("confiabilidade cresce com o número de respostas", acertaTudo.confiabilidade > estimarHabilidade(simular(true, 2)).confiabilidade);
check("conversão θ→índice→θ é estável", Math.abs(indiceParaTheta(thetaParaIndice(0.7)) - 0.7) < 0.04);
check("índice respeita os limites 0 e 100", thetaParaIndice(50) === 100 && thetaParaIndice(-50) === 0);

const porArea = estimarPorArea([
  { item: itemFacil, acertou: true, areaSlug: "exatas" },
  { item: itemFacil, acertou: true, areaSlug: "exatas" },
  { item: itemFacil, acertou: false, areaSlug: "historia" },
  { item: itemFacil, acertou: false, areaSlug: "historia" },
]);
check("habilidade é estimada por disciplina", Object.keys(porArea).length === 2);
check("disciplina com acertos fica acima da sem acertos", porArea["exatas"]!.indice > porArea["historia"]!.indice);

const cmp = compararHabilidades(acertaTudo, erraTudo);
check("comparação aponta o mais hábil", cmp.favoravel === "a");
check("comparação devolve confiança normalizada", cmp.confianca >= 0 && cmp.confianca <= 1);

// Calibração
const poucas = calibrarItem(
  Array.from({ length: 5 }, (_, i) => ({ theta: i * 0.1, acertou: i % 2 === 0 })),
  itemFacil,
);
check("item com amostra pequena continua PROVISÓRIO", poucas.item.provisorio === true);
check("amostra mínima respeitada (K_MINIMO = 30)", K_MINIMO === 30);
const respostasBoa = Array.from({ length: 60 }, (_, i) => ({
  theta: -2 + (i % 20) * 0.2,
  acertou: i % 20 >= 10,
}));
const calibrado = calibrarItem(respostasBoa, itemFacil);
check("amostra suficiente deixa de ser provisório", calibrado.item.provisorio === false);
check("calibração devolve proporção observada", calibrado.proporcao > 0 && calibrado.proporcao < 1);
check("discriminação positiva quando melhores acertam mais", calibrado.discriminacao > 0);
check("parâmetros calibrados ficam em faixa sã", calibrado.item.a >= 0.3 && calibrado.item.a <= 2.5 && Math.abs(calibrado.item.b) <= 4);
const itemQuebrado = calibrarItem(
  Array.from({ length: 40 }, (_, i) => ({ theta: i * 0.05, acertou: false })),
  itemFacil,
);
check("item com acerto abaixo do chute é marcado como suspeito", itemQuebrado.suspeito === true && itemQuebrado.motivoSuspeita != null);

// ============ RESULTADO ============
console.log(`\n${passou} passaram, ${falhou} falharam (total ${passou + falhou})`);
if (falhas.length > 0) {
  console.log("\nFALHAS:");
  for (const f of falhas) console.log(` - ${f}`);
  process.exit(1);
}
console.log("GUERRA DE BRIO — núcleo OK");
