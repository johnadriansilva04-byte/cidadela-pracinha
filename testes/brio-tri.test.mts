/**
 * Testes da TRI do Guerra de Brio — o que estava DESCONECTADO.
 *
 * Dois bugs reais motivaram esta suíte:
 *
 *  1. `tri_b` era 0.0 para TODAS as perguntas no banco. O seed e o
 *     `brio_importar_lote` usavam o DEFAULT do schema e ignoravam a
 *     dificuldade declarada, então fácil e especialista eram tratadas como
 *     idênticas pela TRI. Os testes abaixo travam o mapa por dificuldade em
 *     `tri.ts`, no seed e no importador.
 *
 *  2. A tabela `brio_calibracao` existia e NINGUÉM escrevia nela; os
 *     parâmetros nunca saíam de provisório. O teste verifica que a RPC de
 *     calibração existe, alimenta a tabela e marca suspeitos.
 *
 * Uso: node testes/brio-tri.test.mjs
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  B_INICIAL,
  ACERTO_CASUAL,
  parametrosIniciais,
  parametrosDoBanco,
  probabilidadeAcerto,
  calibrarItem,
  estimarHabilidade,
  thetaParaIndice,
  compararHabilidades,
  K_MINIMO,
} from "../src/lib/brio/tri.ts";

const SEED = readFileSync("supabase/migrations/guerra_de_brio.sql", "utf8");
const GERADOR = readFileSync("testes/gerador-brio-seed.mts", "utf8");
const IMPORTADOR = readFileSync("scripts/brio-importar.mjs", "utf8");

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

console.log("=== 1. O `b` inicial VEM da dificuldade (não é 0 para todos) ===");
teste("as 5 dificuldades têm b inicial distintos", () => {
  const valores = Object.values(B_INICIAL);
  assert.equal(valores.length, 5);
  assert.equal(new Set(valores).size, 5, "há dificuldades com o mesmo b inicial");
});
teste("b cresce com a dificuldade (fácil < ... < especialista)", () => {
  assert.ok(B_INICIAL.facil < B_INICIAL.intermediaria);
  assert.ok(B_INICIAL.intermediaria < B_INICIAL.dificil);
  assert.ok(B_INICIAL.dificil < B_INICIAL.avancada);
  assert.ok(B_INICIAL.avancada < B_INICIAL.especialista);
});
teste("NENHUMA dificuldade tem b inicial 0, exceto 'dificil' (referência)", () => {
  const zerados = Object.entries(B_INICIAL).filter(([, v]) => v === 0).map(([k]) => k);
  assert.deepEqual(zerados, ["dificil"], `b=0 inesperado em: ${zerados.join(", ")}`);
});
teste("parametrosIniciais usa o b da dificuldade e nasce provisório", () => {
  for (const [dif, b] of Object.entries(B_INICIAL)) {
    const p = parametrosIniciais(dif);
    assert.equal(p.b, b, `${dif} → b errado`);
    assert.equal(p.c, ACERTO_CASUAL, `${dif} → c errado`);
    assert.equal(p.provisorio, true);
  }
});

console.log("\n=== 2. O seed GRAVA o b por dificuldade ===");
teste("o seed declara a coluna tri_b", () => {
  assert.match(SEED, /letra_correta, explicacao, referencia, assinatura, status, ativa, versao, tri_b\)/);
});
teste("o seed REESCREVE tri_b no conflito (senão reimportar não corrige)", () => {
  assert.match(SEED, /tri_b = EXCLUDED\.tri_b/);
});
teste("cada dificuldade do seed tem o b correspondente", () => {
  const re = /'(\w+)', \d+, .*?, (TRUE|FALSE), 1, (-?[\d.]+)\)/g;
  const vistos = {};
  let m;
  while ((m = re.exec(SEED)) !== null) {
    const [, dif, , b] = m;
    if (!(dif in B_INICIAL)) continue;
    const esperado = String(B_INICIAL[dif]);
    assert.equal(b, esperado, `${dif}: seed gravou b=${b}, esperado ${esperado}`);
    vistos[dif] = (vistos[dif] ?? 0) + 1;
  }
  assert.equal(Object.keys(vistos).length, 5, "nem todas as dificuldades apareceram no seed");
});
teste("o gerador importa B_INICIAL (uma fonte só para TS e SQL)", () => {
  assert.match(GERADOR, /import \{ B_INICIAL \} from "\.\.\/src\/lib\/brio\/tri"/);
  assert.match(GERADOR, /B_INICIAL\[p\.dificuldade\]/);
});

console.log("\n=== 3. A importação em lote deriva o b da dificuldade ===");
teste("existe a função SQL brio_b_inicial espelhando o TS", () => {
  assert.match(SEED, /FUNCTION public\.brio_b_inicial\(p_dificuldade TEXT\)/);
  for (const b of Object.values(B_INICIAL)) {
    assert.ok(
      SEED.includes(`THEN ${b}`) || SEED.includes(`THEN ${b}\n`),
      `brio_b_inicial não cobre o valor ${b}`,
    );
  }
});
teste("brio_importar_lote NÃO usa 0.0 fixo para tri_b", () => {
  assert.match(SEED, /public\.brio_b_inicial\(COALESCE\(v_item->>'dificuldade'/);
  assert.doesNotMatch(
    SEED,
    /COALESCE\(\(v_item->>'tri_b'\)::NUMERIC, 0\.0\)/,
    "o importador voltou a nivelar tudo em b=0.0",
  );
});

console.log("\n=== 4. A calibração EXISTE e alimenta o banco ===");
teste("existe a RPC brio_calibrar", () => {
  assert.match(SEED, /FUNCTION public\.brio_calibrar\(p_minimo INTEGER/);
});
teste("a calibração ESCREVE em brio_calibracao", () => {
  assert.match(SEED, /INSERT INTO public\.brio_calibracao/);
  assert.match(SEED, /UPDATE public\.brio_calibracao/);
});
teste("a calibração ATUALIZA os parâmetros da pergunta", () => {
  assert.match(SEED, /UPDATE public\.brio_questions\s*\n\s*SET tri_a = v_a, tri_b = v_b, tri_provisorio/);
});
teste("a calibração é administrativa (service_role, não o cliente)", () => {
  assert.match(SEED, /REVOKE ALL ON FUNCTION public\.brio_calibrar\(INTEGER\) FROM PUBLIC/);
  assert.match(SEED, /GRANT EXECUTE ON FUNCTION public\.brio_calibrar\(INTEGER\) TO service_role/);
});
teste("a calibração EXCLUI o adversário virtual (só respostas humanas)", () => {
  assert.match(SEED, /JOIN public\.brio_habilidade h/);
  assert.match(SEED, /WHERE r\.acertou IS NOT NULL/);
});
teste("existe coluna de suspeita e o item suspeito sai da seleção", () => {
  assert.match(SEED, /tri_suspeita TEXT/);
  assert.match(SEED, /ADD COLUMN IF NOT EXISTS tri_suspeita/);
  assert.match(SEED, /AND q\.tri_suspeita IS NULL/);
});
teste("o script administrativo expõe --calibrar", () => {
  assert.match(IMPORTADOR, /--calibrar/);
  assert.match(IMPORTADOR, /rpc\("brio_calibrar"/);
});

console.log("\n=== 5. A matemática da TRI se comporta ===");
teste("P(acerto) cresce com a habilidade", () => {
  const item = { a: 1, b: 0, c: ACERTO_CASUAL, provisorio: false };
  assert.ok(probabilidadeAcerto(-2, item) < probabilidadeAcerto(0, item));
  assert.ok(probabilidadeAcerto(0, item) < probabilidadeAcerto(2, item));
});
teste("θ = b ⇒ P = (c+1)/2 (propriedade do 3PL)", () => {
  const item = { a: 1.3, b: 0.8, c: 0.2, provisorio: false };
  assert.ok(Math.abs(probabilidadeAcerto(0.8, item) - (0.2 + 1) / 2) < 1e-9);
});
teste("P nunca fica abaixo de c (chute) nem acima de 1", () => {
  const item = { a: 2, b: 0, c: 0.1667, provisorio: false };
  for (const t of [-6, -4, -2, 0, 2, 4, 6]) {
    const p = probabilidadeAcerto(t, item);
    assert.ok(p >= item.c - 1e-9, `P(${t}) < c`);
    assert.ok(p <= 1 + 1e-9, `P(${t}) > 1`);
  }
});
teste("item FÁCIL responde melhor que item DIFÍCIL no mesmo θ", () => {
  const facil = parametrosIniciais("facil");
  const especialista = parametrosIniciais("especialista");
  const theta = 0;
  assert.ok(probabilidadeAcerto(theta, facil) > probabilidadeAcerto(theta, especialista));
});
teste("thetaParaIndice mapeia θ=0 → 50 e respeita os limites 0..100", () => {
  assert.equal(thetaParaIndice(0), 50);
  assert.equal(thetaParaIndice(-99), 0);
  assert.equal(thetaParaIndice(99), 100);
});

console.log("\n=== 6. A calibração de item faz shrinkage e marca suspeitos ===");
teste("amostra pequena NÃO declara o item calibrado", () => {
  const poucas = Array.from({ length: 5 }, (_, i) => ({ theta: i * 0.5 - 1, acertou: i % 2 === 0 }));
  const r = calibrarItem(poucas, parametrosIniciais("dificil"));
  assert.equal(r.item.provisorio, true);
  assert.equal(r.suspeito, false, "não se marca suspeito com amostra insuficiente");
});
teste("item que todos acertam → b CAI (fica mais fácil)", () => {
  const respostas = Array.from({ length: K_MINIMO * 2 }, (_, i) => ({
    theta: (i % 10) / 10 - 0.5,
    acertou: true,
  }));
  const antes = parametrosIniciais("especialista");
  const r = calibrarItem(respostas, antes);
  assert.ok(r.item.b < antes.b, `b deveria cair de ${antes.b}, veio ${r.item.b}`);
});
teste("item que ninguém acerta → b SOBE (fica mais difícil)", () => {
  const respostas = Array.from({ length: K_MINIMO * 2 }, (_, i) => ({
    theta: (i % 10) / 10 - 0.5,
    acertou: false,
  }));
  const antes = parametrosIniciais("facil");
  const r = calibrarItem(respostas, antes);
  assert.ok(r.item.b > antes.b, `b deveria subir de ${antes.b}, veio ${r.item.b}`);
});
teste("item com discriminação negativa é marcado suspeito", () => {
  // Os MELHORES erram e os piores acertam: sinal de gabarito errado.
  const respostas = Array.from({ length: K_MINIMO * 2 }, (_, i) => {
    const forte = i % 2 === 0;
    return { theta: forte ? 2 : -2, acertou: !forte };
  });
  const r = calibrarItem(respostas, parametrosIniciais("dificil"));
  assert.equal(r.suspeito, true);
  assert.match(String(r.motivoSuspeita), /discrimina/i);
});
teste("amostra suficiente deixa de ser provisória", () => {
  const respostas = Array.from({ length: K_MINIMO + 10 }, (_, i) => ({
    theta: (i % 20) / 10 - 1,
    acertou: i % 3 !== 0,
  }));
  const r = calibrarItem(respostas, parametrosIniciais("intermediaria"));
  assert.equal(r.item.provisorio, false);
  assert.ok(r.n >= K_MINIMO);
});

console.log("\n=== 7. Estimativa de habilidade e comparação ===");
teste("sem respostas → prior (θ=0, índice 50, confiabilidade 0)", () => {
  const e = estimarHabilidade([]);
  assert.equal(e.theta, 0);
  assert.equal(e.indice, 50);
  assert.equal(e.confiabilidade, 0);
});
teste("quem acerta muito em itens fáceis supera quem só erra", () => {
  const itensFaceis = Array.from({ length: 10 }, () => parametrosIniciais("facil"));
  const bom = estimarHabilidade(itensFaceis.map((item) => ({ item, acertou: true })));
  const ruim = estimarHabilidade(itensFaceis.map((item) => ({ item, acertou: false })));
  assert.ok(bom.theta > ruim.theta);
  assert.ok(bom.indice > ruim.indice);
});
teste("acertar item DIFÍCIL vale mais que acertar item FÁCIL", () => {
  const facil = parametrosIniciais("facil");
  const especialista = parametrosIniciais("especialista");
  // Mesmo número de acertos; só muda a dificuldade do que foi acertado.
  const soFacil = estimarHabilidade(Array.from({ length: 6 }, () => ({ item: facil, acertou: true })));
  const soDificil = estimarHabilidade(
    Array.from({ length: 6 }, () => ({ item: especialista, acertou: true })),
  );
  assert.ok(
    soDificil.theta > soFacil.theta,
    `acertar difícil (θ=${soDificil.theta}) deveria superar acertar fácil (θ=${soFacil.theta})`,
  );
});
teste("compararHabilidades não decide com ruído alto", () => {
  const a = { theta: 0.1, erroPadrao: 2, indice: 51, n: 1, confiabilidade: 0 };
  const b = { theta: -0.1, erroPadrao: 2, indice: 49, n: 1, confiabilidade: 0 };
  assert.equal(compararHabilidades(a, b).favoravel, "equilibrado");
});
teste("parametrosDoBanco cai no inicial quando as colunas vêm nulas", () => {
  const p = parametrosDoBanco("especialista", null, null, null, null);
  assert.equal(p.b, B_INICIAL.especialista);
  assert.equal(p.provisorio, true);
});

console.log(`\n${ok} passaram, ${falhas} falharam (total ${ok + falhas})`);
if (falhas > 0) process.exit(1);
console.log("TRI DO BRIO — OK");
