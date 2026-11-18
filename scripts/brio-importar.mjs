/**
 * IMPORTAÇÃO EM LOTE DO ACERVO DO GUERRA DE BRIO.
 *
 * O motor de perguntas já nasceu pronto para escala (a migration tem
 * `brio_importar_lote` e `brio_aprovar_perguntas`), mas faltava o caminho para
 * ALIMENTAR o banco: este script fecha essa lacuna.
 *
 * Fluxo (§3.1): lote → validação → deduplicação → gravação como RASCUNHO →
 * aprovação editorial. Nada é publicado sem passar pela aprovação.
 *
 * As duas RPCs são `service_role` (operação administrativa, não do cliente):
 * sem `SUPABASE_SERVICE_ROLE_KEY` o script para em vez de tentar contornar.
 *
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/brio-importar.mjs lote.json
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/brio-importar.mjs --acervo
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/brio-importar.mjs --lotes dir/
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/brio-importar.mjs --aprovar <origem>
 *
 * Formato do lote: array de perguntas com
 *   { area_slug, subcategoria_slug, dificuldade, ordem, enunciado,
 *     alternativas: [{letra, texto}×6], letra_correta, explicacao, referencia }
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const URL_BASE =
  process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
const CHAVE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

export const DIFICULDADES = [
  "facil",
  "intermediaria",
  "dificil",
  "avancada",
  "especialista",
];
export const LETRAS = ["A", "B", "C", "D", "E", "F"];

/**
 * Normaliza o enunciado para a assinatura de deduplicação.
 *
 * Precisa ser IDÊNTICA à do seed (src/lib/brio/selecao.ts `assinaturaPergunta`)
 * e à do SQL: enunciado + alternativas, sem acentos, minúsculo, pontuação
 * virando espaço. Se divergir, a importação não reconhece o que o acervo
 * curado já tem e duplica o banco.
 */
export function assinatura(p) {
  const limpar = (s) =>
    String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const alts = (p.alternativas ?? [])
    .map((a) => limpar(a?.texto))
    .sort()
    .join("|");
  return `${limpar(p.enunciado)}##${alts}`;
}

/**
 * Validação local (§3.5): reprova antes de gastar rede.
 *
 * A mesma checagem existe no SQL, mas falhar aqui dá o motivo exato — e o
 * relatório de inválidas é o que permite corrigir o lote.
 */
export function validarLote(perguntas) {
  const validas = [];
  const invalidas = [];

  perguntas.forEach((p, i) => {
    const erros = [];
    if (!p || typeof p !== "object") {
      invalidas.push({ indice: i, motivo: "não é um objeto" });
      return;
    }
    const alts = Array.isArray(p.alternativas) ? p.alternativas : [];
    if (alts.length !== 6) erros.push(`tem ${alts.length} alternativas (exige 6)`);
    const letras = alts.map((a) => a?.letra);
    for (const l of LETRAS) if (!letras.includes(l)) erros.push(`falta a alternativa ${l}`);
    const textos = new Set(alts.map((a) => String(a?.texto ?? "").trim().toLowerCase()));
    if (textos.size !== alts.length) erros.push("tem alternativas repetidas");
    if (!LETRAS.includes(p.letra_correta)) erros.push("letra_correta inválida");
    if (String(p.enunciado ?? "").trim().length < 10) erros.push("enunciado curto demais");
    if (!String(p.explicacao ?? "").trim()) erros.push("sem explicação");
    if (!p.area_slug) erros.push("sem area_slug");
    if (!p.subcategoria_slug) erros.push("sem subcategoria_slug");
    if (p.dificuldade && !DIFICULDADES.includes(p.dificuldade)) {
      erros.push(`dificuldade inválida (${p.dificuldade})`);
    }
    if (erros.length) invalidas.push({ indice: i, motivo: erros.join("; ") });
    else validas.push(p);
  });

  return { validas, invalidas };
}

/** Deduplicação: assinatura idêntica e quase-duplicata (Jaccard ≥ 0,9). */
export function deduplicar(perguntas) {
  const unicas = [];
  const repetidas = [];
  const vistos = new Map();

  for (const p of perguntas) {
    const a = assinatura(p);
    const igual = vistos.get(a);
    if (igual) {
      repetidas.push({ enunciado: p.enunciado, tipo: "identica", colideCom: igual });
      continue;
    }
    vistos.set(a, p.enunciado);
    unicas.push({ ...p, _assinatura: a });
  }

  const tokens = (s) => new Set(s.split(/[\s|#]+/).filter(Boolean));
  for (let i = 0; i < unicas.length; i += 1) {
    const a = tokens(unicas[i]._assinatura);
    for (let j = i + 1; j < unicas.length; j += 1) {
      const b = tokens(unicas[j]._assinatura);
      let inter = 0;
      for (const t of a) if (b.has(t)) inter += 1;
      const uniao = a.size + b.size - inter;
      const sim = uniao === 0 ? 0 : inter / uniao;
      if (sim >= 0.9) {
        repetidas.push({
          enunciado: unicas[j].enunciado,
          tipo: "semelhante",
          similaridade: Number(sim.toFixed(3)),
          colideCom: unicas[i].enunciado,
        });
        unicas.splice(j, 1);
        j -= 1;
      }
    }
  }

  return { unicas, repetidas };
}

async function rpc(nome, corpo) {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: {
      apikey: CHAVE,
      Authorization: `Bearer ${CHAVE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(corpo),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${nome} → HTTP ${r.status}: ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

/** Lê o acervo curado executando o exportador TS com jiti. */
function carregarAcervo() {
  const saida = execFileSync(
    "npx",
    ["jiti", "scripts/brio-acervo.mts"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(saida.trim().split("\n").pop());
}

/** Lê um diretório de lotes .json (alimentação contínua do acervo). */
function lerLotes(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

async function aprovar(origem) {
  const lista = await fetch(
    `${URL_BASE}/rest/v1/brio_questions?select=id&status=eq.revisao&origem=eq.${encodeURIComponent(origem)}`,
    { headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` } },
  ).then((r) => r.json());
  const ids = (lista ?? []).map((q) => q.id);
  if (!ids.length) {
    console.log(`Nada em revisão com origem "${origem}".`);
    return;
  }
  const r = await rpc("brio_aprovar_perguntas", { p_ids: ids });
  console.log(`Aprovadas: ${r?.aprovadas ?? 0} de ${ids.length} em revisão.`);
}

/**
 * Recalibra os itens a partir das respostas reais (brio_calibrar).
 *
 * É operação administrativa e IDEMPOTENTE: pode rodar quantas vezes quiser.
 * Enquanto um item tiver menos que o mínimo de respostas, ele continua
 * provisório — o relatório diz quantos de cada.
 */
async function calibrar(minimo) {
  const r = await rpc("brio_calibrar", { p_minimo: minimo });
  if (!r) {
    console.log("Calibração não respondeu — a migration foi aplicada?");
    return;
  }
  console.log("Calibração concluída:");
  console.log(`  itens avaliados: ${r.itens_avaliados ?? 0}`);
  console.log(`  calibrados (amostra suficiente): ${r.calibrados ?? 0}`);
  console.log(`  ainda provisórios: ${r.provisorios ?? 0}`);
  console.log(`  marcados como suspeitos: ${r.suspeitos ?? 0}`);
  console.log(`  amostra mínima por item: ${r.minimo_amostra ?? "-"}`);
}

async function importar(perguntas, origem) {
  const { validas, invalidas } = validarLote(perguntas);
  const { unicas, repetidas } = deduplicar(validas);

  console.log(`Lote: ${perguntas.length} perguntas`);
  console.log(`  válidas: ${validas.length} | inválidas: ${invalidas.length}`);
  console.log(`  únicas: ${unicas.length} | duplicadas no lote: ${repetidas.length}`);
  for (const inv of invalidas.slice(0, 10)) console.log(`  ✗ #${inv.indice}: ${inv.motivo}`);
  for (const rep of repetidas.slice(0, 10)) {
    console.log(`  ⧗ ${rep.tipo}: ${String(rep.enunciado).slice(0, 70)}…`);
  }

  if (!unicas.length) {
    console.log("Nada a importar.");
    return;
  }

  // A assinatura vai PRONTA no payload: não dependemos de o SQL derivá-la
  // igual ao seed. Se as duas regras divergirem, a antirrepetição falha em
  // silêncio e o acervo duplica.
  const limpas = unicas.map(({ _assinatura, ...p }) => ({
    ...p,
    assinatura: assinatura(p),
  }));
  const resultado = await rpc("brio_importar_lote", {
    p_perguntas: limpas,
    p_origem: origem,
  });

  console.log("\nGravado no banco (como RASCUNHO/revisão — nada publicado):");
  console.log(`  inseridas: ${resultado?.inseridas ?? 0}`);
  console.log(`  duplicadas já no banco: ${resultado?.duplicadas ?? 0}`);
  console.log(`  recusadas pelo SQL: ${resultado?.invalidas ?? 0}`);
  console.log(`\nRevisão editorial:\n  node scripts/brio-importar.mjs --aprovar ${origem}`);
}

function ajuda() {
  console.log(
    "Uso:\n" +
      "  node scripts/brio-importar.mjs <lote.json> [origem]\n" +
      "  node scripts/brio-importar.mjs --lotes <diretorio> [origem]\n" +
      "  node scripts/brio-importar.mjs --acervo [origem]\n" +
      "  node scripts/brio-importar.mjs --aprovar <origem>\n" +
      "  node scripts/brio-importar.mjs --calibrar [minimo_amostra]",
  );
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    ajuda();
    process.exit(1);
  }
  if (!URL_BASE) {
    console.error("Defina SUPABASE_URL (ou VITE_SUPABASE_URL).");
    process.exit(1);
  }
  if (!CHAVE) {
    console.error(
      "Defina SUPABASE_SERVICE_ROLE_KEY. A importação é operação administrativa:\n" +
        "as RPCs brio_importar_lote/brio_aprovar_perguntas só aceitam service_role.",
    );
    process.exit(1);
  }

  if (arg === "--aprovar") {
    await aprovar(process.argv[3] ?? "lote");
    return;
  }

  if (arg === "--calibrar") {
    await calibrar(Number(process.argv[3] ?? 30));
    return;
  }

  const origem = process.argv[3] ?? "lote";
  if (arg === "--acervo") return importar(carregarAcervo(), origem);
  if (arg === "--lotes") return importar(lerLotes(process.argv[3]), process.argv[4] ?? "lote");

  const caminho = arg;
  const perguntas =
    statSync(caminho).isDirectory() === true
      ? lerLotes(caminho)
      : JSON.parse(readFileSync(caminho, "utf8"));
  await importar(perguntas, origem);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  await main();
}
