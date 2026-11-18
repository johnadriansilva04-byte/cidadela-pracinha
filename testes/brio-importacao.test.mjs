/**
 * Testes da importação em lote do acervo do Guerra de Brio.
 *
 * Cobre o que o importador promete antes de tocar no banco: validação (§3.5),
 * deduplicação (§3.6) e o formato que a RPC `brio_importar_lote` exige.
 *
 * Uso: node testes/brio-importacao.test.mjs
 */
import { strict as assert } from "node:assert";
import { assinatura, validarLote, deduplicar, LETRAS } from "../scripts/brio-importar.mjs";

let ok = 0;
let falhas = 0;
function teste(nome, fn) {
  try {
    fn();
    ok += 1;
    console.log(`  ok  ${nome}`);
  } catch (e) {
    falhas += 1;
    console.log(`  ✗   ${nome}\n      ${e.message}`);
  }
}

/** Pergunta válida, com o gabarito na letra pedida. */
function pergunta(enunciado, correta = "A", extras = {}) {
  const alternativas = LETRAS.map((l, i) => ({
    letra: l,
    texto: `${enunciado.slice(0, 12)} opção ${i + 1}`,
  }));
  return {
    area_slug: "ciencias",
    subcategoria_slug: "fisica",
    dificuldade: "dificil",
    ordem: 3,
    enunciado,
    alternativas,
    letra_correta: correta,
    explicacao: "Porque sim.",
    referencia: "Fonte",
    ...extras,
  };
}

console.log("== Validação ==");

teste("aceita pergunta bem formada", () => {
  const { validas, invalidas } = validarLote([pergunta("Qual é a unidade de força no SI?")]);
  assert.equal(validas.length, 1);
  assert.equal(invalidas.length, 0);
});

teste("recusa pergunta com 5 alternativas", () => {
  const p = pergunta("Pergunta qualquer de teste");
  p.alternativas = p.alternativas.slice(0, 5);
  const { validas, invalidas } = validarLote([p]);
  assert.equal(validas.length, 0);
  assert.match(invalidas[0].motivo, /5 alternativas/);
});

teste("recusa alternativa faltando (letra F ausente)", () => {
  const p = pergunta("Outra pergunta de teste aqui");
  p.alternativas = p.alternativas.map((a, i) => (i === 5 ? { letra: "E", texto: "dup" } : a));
  const { invalidas } = validarLote([p]);
  assert.ok(invalidas.length === 1);
  assert.match(invalidas[0].motivo, /falta a alternativa F/);
});

teste("recusa alternativas repetidas", () => {
  const p = pergunta("Pergunta com repetição de texto");
  p.alternativas = p.alternativas.map(() => ({ letra: "A", texto: "mesmo texto" }));
  p.alternativas = LETRAS.map((l) => ({ letra: l, texto: "mesmo texto" }));
  const { invalidas } = validarLote([p]);
  assert.match(invalidas[0].motivo, /repetidas/);
});

teste("recusa gabarito fora de A–F", () => {
  const { invalidas } = validarLote([pergunta("Pergunta com gabarito inválido", "Z")]);
  assert.match(invalidas[0].motivo, /letra_correta/);
});

teste("recusa sem explicação (exigência editorial)", () => {
  const { invalidas } = validarLote([pergunta("Pergunta sem explicação alguma", "A", { explicacao: "" })]);
  assert.match(invalidas[0].motivo, /sem explicação/);
});

teste("recusa enunciado curto demais", () => {
  const { invalidas } = validarLote([pergunta("Oi", "A")]);
  assert.match(invalidas[0].motivo, /curto/);
});

teste("recusa sem categoria/subcategoria", () => {
  const { invalidas } = validarLote([
    pergunta("Pergunta sem categoria definida", "A", { area_slug: "", subcategoria_slug: "" }),
  ]);
  assert.match(invalidas[0].motivo, /area_slug/);
  assert.match(invalidas[0].motivo, /subcategoria_slug/);
});

teste("recusa dificuldade desconhecida", () => {
  const { invalidas } = validarLote([
    pergunta("Pergunta com dificuldade estranha", "A", { dificuldade: "impossivel" }),
  ]);
  assert.match(invalidas[0].motivo, /dificuldade/);
});

teste("separa válidas de inválidas no mesmo lote", () => {
  const { validas, invalidas } = validarLote([
    pergunta("Pergunta boa número um aqui"),
    pergunta("curta", "A"),
    pergunta("Pergunta boa número dois aqui"),
  ]);
  assert.equal(validas.length, 2);
  assert.equal(invalidas.length, 1);
  assert.equal(invalidas[0].indice, 1);
});

console.log("\n== Deduplicação ==");

teste("assinatura ignora acento, caixa e pontuação", () => {
  const a = assinatura(pergunta("Qual é a cor do céu?"));
  const b = assinatura(pergunta("qual e a cor do ceu"));
  assert.equal(a, b);
});

teste("assinatura muda quando o gabarito textual muda", () => {
  const p1 = pergunta("Pergunta qualquer sobre física");
  const p2 = pergunta("Pergunta qualquer sobre física");
  p2.alternativas = p2.alternativas.map((a, i) => ({ ...a, texto: `${a.texto} v${i}` }));
  assert.notEqual(assinatura(p1), assinatura(p2));
});

teste("remove duplicata idêntica", () => {
  const { unicas, repetidas } = deduplicar([
    pergunta("Quanto é dois mais dois?"),
    pergunta("Quanto é dois mais dois?"),
  ]);
  assert.equal(unicas.length, 1);
  assert.equal(repetidas.length, 1);
  assert.equal(repetidas[0].tipo, "identica");
});

teste("remove quase-duplicata (variação de palavras)", () => {
  const p1 = pergunta("Qual é a capital do Brasil segundo o IBGE?");
  const p2 = pergunta("Qual é a capital do Brasil segundo o IBGE atual?");
  const { unicas, repetidas } = deduplicar([p1, p2]);
  assert.ok(unicas.length <= 2);
  if (repetidas.length) assert.equal(repetidas[0].tipo, "semelhante");
});

teste("preserva perguntas realmente distintas", () => {
  const { unicas, repetidas } = deduplicar([
    pergunta("Quem escreveu Dom Casmurro?"),
    pergunta("Qual é o maior planeta do sistema solar?"),
    pergunta("Em que ano caiu o muro de Berlim?"),
  ]);
  assert.equal(unicas.length, 3);
  assert.equal(repetidas.length, 0);
});

teste("deduplicar não muta o lote original", () => {
  const lote = [pergunta("Pergunta sobre química orgânica"), pergunta("Pergunta sobre química orgânica")];
  const antes = lote.length;
  deduplicar(lote);
  assert.equal(lote.length, antes);
});

console.log("\n== Formato para a RPC ==");

teste("as chaves batem com as colunas de brio_questions", () => {
  const p = pergunta("Pergunta para conferir as chaves do insert");
  for (const chave of [
    "area_slug",
    "subcategoria_slug",
    "dificuldade",
    "ordem",
    "enunciado",
    "alternativas",
    "letra_correta",
    "explicacao",
    "referencia",
  ]) {
    assert.ok(chave in p, `faltou ${chave}`);
  }
});

teste("as 6 alternativas usam exatamente A–F", () => {
  const p = pergunta("Pergunta sobre as letras das alternativas");
  assert.deepEqual(
    p.alternativas.map((a) => a.letra),
    LETRAS,
  );
});

console.log(`\n${ok} passaram, ${falhas} falharam (total ${ok + falhas})`);
if (falhas) process.exit(1);
console.log("IMPORTAÇÃO DO ACERVO — OK");
