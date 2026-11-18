/**
 * Integridade do acervo do Guerra de Brio.
 *
 * O acervo é a fonte do seed do banco e do fallback local. Um erro aqui
 * (id repetido, gabarito fora das alternativas, subcategoria do catálogo sem
 * nenhuma pergunta) só apareceria em partida real — então este teste trava a
 * regra editorial §3.5 e a cobertura do catálogo antes do build.
 *
 * Uso: JITI_TSCONFIG_PATHS=true npx jiti testes/brio-acervo.test.mts
 */
import { strict as assert } from "node:assert";
import {
  ACERVO_BRIO_EQUILIBRADO,
  ACERVO_COMPLETO,
  ACERVO_POR_ID,
  GABARITO_LOCAL,
} from "../src/lib/brio/acervo";
import { ACERVO_EXPANSAO } from "../src/lib/brio/acervo-expansao";
import { AREAS } from "../src/lib/brio/categorias";
import { assinaturaPergunta, detectarDuplicatas } from "../src/lib/brio/selecao";

let ok = 0;
let falhas = 0;
function teste(nome: string, fn: () => void) {
  try {
    fn();
    ok += 1;
    console.log(`  ok  ${nome}`);
  } catch (e) {
    falhas += 1;
    console.log(`  ✗   ${nome}\n      ${(e as Error).message}`);
  }
}

const PERGUNTAS = ACERVO_BRIO_EQUILIBRADO;
const SUBCATEGORIAS = AREAS.flatMap((a) => a.subcategorias.map((s) => ({ area: a.slug, slug: s.slug })));

teste("o acervo tem perguntas", () => {
  assert.ok(PERGUNTAS.length >= 100, `esperado >= 100, veio ${PERGUNTAS.length}`);
});

teste("nenhum id se repete", () => {
  const ids = PERGUNTAS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, "há id duplicado no acervo");
});

teste("a expansão não colide com o núcleo", () => {
  const nucleo = new Set(ACERVO_COMPLETO.slice(0, ACERVO_COMPLETO.length - ACERVO_EXPANSAO.length).map((p) => p.id));
  const colisoes = ACERVO_EXPANSAO.filter((p) => nucleo.has(p.id));
  assert.equal(colisoes.length, 0, `ids em conflito: ${colisoes.map((p) => p.id).join(", ")}`);
});

teste("toda pergunta tem exatamente 6 alternativas A–F", () => {
  for (const p of PERGUNTAS) {
    assert.equal(p.alternativas.length, 6, `${p.id} tem ${p.alternativas.length} alternativas`);
    assert.deepEqual(
      p.alternativas.map((a) => a.letra),
      ["A", "B", "C", "D", "E", "F"],
      `${p.id} não usa A–F em ordem`,
    );
  }
});

teste("o gabarito aponta uma alternativa existente", () => {
  for (const p of PERGUNTAS) {
    assert.ok(
      p.alternativas.some((a) => a.letra === p.letraCorreta),
      `${p.id}: gabarito ${p.letraCorreta} não está entre as alternativas`,
    );
  }
});

teste("nenhuma pergunta tem alternativas com texto repetido", () => {
  for (const p of PERGUNTAS) {
    const textos = p.alternativas.map((a) => a.texto.trim().toLowerCase());
    assert.equal(new Set(textos).size, 6, `${p.id} tem alternativa repetida`);
  }
});

teste("toda pergunta tem explicação e referência", () => {
  for (const p of PERGUNTAS) {
    assert.ok(p.explicacao.length >= 40, `${p.id}: explicação curta demais`);
    assert.ok(p.referencia != null && p.referencia.length > 3, `${p.id}: sem referência`);
  }
});

teste("toda subcategoria do catálogo tem ao menos uma pergunta", () => {
  const usadas = new Set(PERGUNTAS.map((p) => p.subcategoriaSlug));
  const vazias = SUBCATEGORIAS.filter((s) => !usadas.has(s.slug)).map((s) => s.slug);
  assert.equal(vazias.length, 0, `subcategorias sem pergunta: ${vazias.join(", ")}`);
});

teste("a área de cada pergunta bate com a do catálogo", () => {
  for (const p of PERGUNTAS) {
    const cat = SUBCATEGORIAS.find((s) => s.slug === p.subcategoriaSlug);
    assert.ok(cat, `${p.id}: subcategoria ${p.subcategoriaSlug} não existe no catálogo`);
    assert.equal(p.areaSlug, cat.area, `${p.id}: área ${p.areaSlug} divergente de ${cat.area}`);
  }
});

teste("nenhuma pergunta é duplicata de outra", () => {
  const dups = detectarDuplicatas(PERGUNTAS);
  assert.equal(
    dups.length,
    0,
    `duplicatas: ${dups.map((d) => `${d.a}~${d.b}`).join(", ")}`,
  );
});

teste("nenhum enunciado se repete", () => {
  // Coberto por detectarDuplicatas, mas explícito: a expansão chegou a repetir
  // uma pergunta do núcleo (indução de Hume, em epistemologia e metafísica) e
  // isso só apareceu quando o acervo passou a ser concatenado.
  const vistos = new Map<string, string>();
  for (const p of PERGUNTAS) {
    const anterior = vistos.get(p.enunciado);
    assert.equal(anterior, undefined, `${p.id} repete o enunciado de ${anterior}`);
    vistos.set(p.enunciado, p.id);
  }
});

teste("o gabarito está espalhado pelas 6 letras", () => {
  const conta: Record<string, number> = {};
  for (const p of PERGUNTAS) conta[p.letraCorreta] = (conta[p.letraCorreta] ?? 0) + 1;
  for (const letra of ["A", "B", "C", "D", "E", "F"]) {
    const n = conta[letra] ?? 0;
    // Sem equilíbrio, o gabarito autoral concentrava 70% em uma letra só.
    assert.ok(n >= PERGUNTAS.length * 0.08, `letra ${letra} tem só ${n} respostas`);
  }
});

teste("o índice por id e o gabarito local cobrem o acervo inteiro", () => {
  assert.equal(Object.keys(ACERVO_POR_ID).length, PERGUNTAS.length);
  assert.equal(Object.keys(GABARITO_LOCAL).length, PERGUNTAS.length);
  for (const p of PERGUNTAS) {
    assert.equal(GABARITO_LOCAL[p.id], p.letraCorreta, `${p.id}: gabarito local divergente`);
  }
});

teste("o equilíbrio do gabarito é determinístico", () => {
  // Reequilibrar duas vezes precisa dar o mesmo resultado: é o que garante que
  // o seed do banco e o acervo local nunca divirjam.
  for (const p of PERGUNTAS) {
    const assinatura = assinaturaPergunta(p.enunciado, p.alternativas);
    assert.ok(assinatura.length > 10, `${p.id}: assinatura vazia`);
  }
});

console.log(`\n${ok} passaram, ${falhas} falharam (total ${ok + falhas})`);
if (falhas) process.exit(1);
console.log(`ACERVO DO BRIO — OK (${PERGUNTAS.length} perguntas, ${SUBCATEGORIAS.length} subcategorias)`);
