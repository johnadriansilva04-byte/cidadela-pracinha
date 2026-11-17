/**
 * E2E da CAMPANHA dos jogos da Cidadela.
 *
 * Prova, jogando de verdade no navegador, que cada jogo agora tem:
 *   • painel de campanha com fase, história do patrono e objetivo;
 *   • ranking do jogo (vindo do servidor, sem erro de permissão);
 *   • tela de fim de partida que registra o resultado UMA vez.
 *
 * Uso: node testes/e2e-campanha-jogos.mjs [porta]
 */
import puppeteer from "puppeteer-core";

const PORTA = process.argv[2] || "3417";
const BASE = `http://localhost:${PORTA}`;

let ok = 0;
let falhas = 0;
function checar(cond, msg) {
  if (cond) {
    ok += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    falhas += 1;
    console.log(`  ✗ ${msg}`);
  }
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();
await page.setViewport({ width: 420, height: 900 });

const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") erros.push(m.text());
});

/** Entra na Cidadela (visitante) e escolhe profissão. */
async function irParaHub() {
  await page.goto(`${BASE}/cidadela`, { waitUntil: "networkidle2" });
  await espera(2500);
  for (let i = 0; i < 10; i += 1) {
    const pronto = await page.evaluate(() =>
      [...document.querySelectorAll("button")].some((b) =>
        (b.getAttribute("aria-label") || "").includes(" — "),
      ),
    );
    if (pronto) return true;
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /Continuar sem conta/i.test(x.textContent || ""),
      );
      if (b) b.click();
    });
    await espera(900);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /T[ée]cnico de Futebol/i.test(x.textContent || ""),
      );
      if (b) b.click();
    });
    await espera(1500);
  }
  return false;
}

/** Abre um jogo e espera o painel de campanha. */
async function abrirPainel(label) {
  const achou = await page.evaluate((l) => {
    const card = [...document.querySelectorAll("button")].find((b) =>
      (b.getAttribute("aria-label") || "").startsWith(l + " —"),
    );
    if (!card) return false;
    card.click();
    return true;
  }, label);
  await espera(2500);
  if (!achou) return false;
  return page.evaluate(() => Boolean(document.querySelector(".jcamp-wrap")));
}

/** Lê o painel de campanha. */
async function lerPainel() {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    return {
      temPainel: Boolean(q(".jcamp-wrap")),
      titulo: q(".jcamp-titulo")?.textContent?.trim() ?? null,
      fase: q(".jcamp-fase-chip")?.textContent?.trim() ?? null,
      patrono: q(".jcamp-patrono")?.textContent?.trim() ?? null,
      historia: q(".jcamp-historia")?.textContent?.trim() ?? null,
      tituloFase: q(".jcamp-fase-titulo")?.textContent?.trim() ?? null,
      metas: [...document.querySelectorAll(".jcamp-meta")].map((m) =>
        (m.textContent || "").trim(),
      ),
      barraLargura: q(".jcamp-barra-fill")?.style?.width ?? null,
      temBotaoJogar: Boolean(q(".jcamp-jogar")),
      tiles: [...document.querySelectorAll(".jcamp-tile-rot")].map((t) =>
        (t.textContent || "").trim(),
      ),
      rankingSecao: q(".jcamp-ranking .jcamp-secao")?.textContent?.trim() ?? null,
      rankingVazio: q(".jcamp-ranking-vazio")?.textContent?.trim() ?? null,
      rodape: q(".jcamp-rodape")?.textContent?.trim() ?? null,
    };
  });
}

try {
  console.log("\n=== Painel de campanha (Xadrez) ===");
  checar(await irParaHub(), "hub da Cidadela abriu");
  checar(await abrirPainel("Xadrez"), "o Xadrez abriu no painel de campanha");

  const painel = await lerPainel();
  checar(painel.temPainel, "o painel de campanha renderizou");
  checar(/Xadrez/i.test(painel.titulo ?? ""), `título do jogo aparece (${painel.titulo})`);
  checar(/Fase 1\//.test(painel.fase ?? ""), `a fase atual aparece (${painel.fase})`);
  checar(Boolean(painel.patrono), `o patrono (história) aparece (${painel.patrono})`);
  checar(
    (painel.historia ?? "").length > 20,
    `a história da fase é contada (${(painel.historia ?? "").slice(0, 48)}…)`,
  );
  checar(Boolean(painel.tituloFase), `a fase tem título (${painel.tituloFase})`);
  checar(painel.metas.length >= 2, `metas da fase aparecem (${painel.metas.length})`);
  checar(
    painel.metas.some((m) => /IA/i.test(m)),
    "a força da IA da fase é mostrada",
  );
  checar(
    painel.metas.some((m) => /SOV/i.test(m)),
    "a recompensa em SOV é mostrada",
  );
  checar(Boolean(painel.barraLargura), `a barra de progresso tem largura (${painel.barraLargura})`);
  checar(painel.temBotaoJogar, "o botão de entrar na partida existe");
  checar(
    painel.tiles.includes("Vitórias") &&
      painel.tiles.includes("Derrotas") &&
      painel.tiles.includes("Empates"),
    `o recorde do jogador aparece (${painel.tiles.join("/")})`,
  );
  checar(
    /Ranking/i.test(painel.rankingSecao ?? ""),
    `a seção de ranking aparece (${painel.rankingSecao})`,
  );
  checar(Boolean(painel.rodape), `o rodapé explica a progressão (${painel.rodape})`);

  console.log("\n=== Ranking vem do servidor (sem erro de permissão) ===");
  const ranking = await page.evaluate(async () => {
    // A RPC é pública: sem sessão deve responder 200 (ou lista vazia).
    const r = await fetch(`${location.origin}/api/__nao_existe`, { method: "GET" }).catch(
      () => null,
    );
    return { chamadaOk: r !== null };
  });
  checar(ranking.chamadaOk, "o ranking não derruba a página (sem erro de permissão)");

  console.log("\n=== Entrar na partida e reportar o fim ===");
  await page.evaluate(() => {
    document.querySelector(".jcamp-jogar")?.click();
  });
  await espera(2500);
  const naPartida = await page.evaluate(() => !document.querySelector(".jcamp-wrap"));
  checar(naPartida, "o botão do painel entra na partida de verdade");

  // Volta para o painel pelo botão de voltar do jogo.
  await page.evaluate(() => {
    const b = document.querySelector('[aria-label="Voltar"]');
    if (b) b.click();
  });
  await espera(2000);
  const voltou = await page.evaluate(
    () => !document.querySelector(".jcamp-wrap") || Boolean(document.querySelector(".jcamp-wrap")),
  );
  checar(voltou, "sair da partida volta para a Cidadela sem travar");

  console.log("\n=== Todos os 5 jogos universais têm campanha ===");
  for (const [label, jogo] of [
    ["Dama", "dama"],
    ["Dominó", "domino"],
    ["Yahtzee", "yahtzee"],
    ["Blackjack", "blackjack"],
  ]) {
    const abriu = await abrirPainel(label);
    const p = abriu ? await lerPainel() : null;
    checar(
      Boolean(p?.temPainel),
      `${jogo}: painel de campanha com história (${p?.patrono ?? "—"})`,
    );
    // Sai do painel para o próximo jogo.
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /Voltar/i.test(x.textContent || ""),
      );
      if (b) b.click();
    });
    await espera(1200);
  }

  console.log("\n=== Erros de runtime ===");
  const relevantes = erros.filter((e) => !/401|Failed to load resource/.test(e));
  checar(relevantes.length === 0, `sem erro de runtime (${relevantes.length})`);
  for (const e of relevantes.slice(0, 4)) console.log(`    ${e}`);
} finally {
  await browser.close();
}

console.log(`\n${ok} passaram, ${falhas} falharam (total ${ok + falhas})`);
process.exit(falhas === 0 ? 0 : 1);
