/**
 * E2E real das 5 mesas universais no navegador (build de produção).
 *
 * Prova que cada jogo ABRE e ACEITA jogadas de verdade — não só que o módulo
 * compila. Requer o build servido:
 *
 *   npm run build
 *   node testes/serve-build.mjs 3417
 *   node testes/e2e-jogos.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.E2E_BASE ?? "http://localhost:3417";
let ok = 0;
let fail = 0;
const check = (nome, cond, detalhe = "") => {
  if (cond) {
    ok++;
    console.log(`  ok   ${nome}`);
  } else {
    fail++;
    console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
};

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

const erros = [];
page.on("pageerror", (e) => erros.push(String(e).slice(0, 200)));
page.on("console", (m) => {
  if (m.type() === "error") erros.push(m.text().slice(0, 200));
});

await page.goto(`${BASE}/cidadela`, { waitUntil: "networkidle2", timeout: 60_000 });
await new Promise((r) => setTimeout(r, 2500));

// Sem login: a Cidadela abre o portão de conta. O visitante precisa poder
// dispensá-lo — senão o modal fica por cima do tabuleiro e nenhum clique chega.
const corpo = await page.evaluate(() => document.body.innerText);
check("página /cidadela carrega", corpo.length > 40, `${corpo.length} chars`);

const dispensa = await page.evaluate(() => {
  const alvo = [...document.querySelectorAll("button")].find((b) =>
    /continuar sem conta/i.test(b.textContent ?? ""),
  );
  if (!alvo) return "ausente";
  alvo.click();
  return "clicado";
});
check("visitante consegue dispensar o portão de conta", dispensa !== "ausente", dispensa);
await new Promise((r) => setTimeout(r, 1200));

const semModal = await page.evaluate(
  () => document.querySelectorAll('div.fixed.inset-0[class*="z-[100]"]').length,
);
check("modal de login não cobre mais o hub", semModal === 0, `${semModal} overlay(s)`);

const JOGOS = [
  { nome: "Xadrez", slug: "xadrez" },
  { nome: "Dama", slug: "dama" },
  { nome: "Blackjack", slug: "blackjack" },
  { nome: "Dominó", slug: "domino" },
  { nome: "Yahtzee", slug: "yahtzee" },
  { nome: "Liga 4", slug: "liga4" },
  { nome: "Jogo da Velha", slug: "velha" },
  { nome: "Reversi", slug: "reversi" },
  { nome: "Mancala", slug: "mancala" },
];

console.log("\nABERTURA DAS MESAS NA UI\n");
for (const jogo of JOGOS) {
  const achou = await page.evaluate((nome) => {
    const alvo = [...document.querySelectorAll("button, a, [role=button]")].find((el) =>
      (el.textContent ?? "").toLowerCase().includes(nome.toLowerCase()),
    );
    if (!alvo) return false;
    alvo.click();
    return true;
  }, jogo.nome);

  if (!achou) {
    check(`${jogo.nome}: card presente na Cidadela`, false, "card não encontrado");
    continue;
  }
  check(`${jogo.nome}: card presente na Cidadela`, true);

  await new Promise((r) => setTimeout(r, 1800));
  const texto = await page.evaluate(() => document.body.innerText);
  const abriu = texto.includes("Voltar") || texto.toLowerCase().includes(jogo.nome.toLowerCase());
  check(`${jogo.nome}: mesa abre`, abriu, texto.slice(0, 90).replace(/\n/g, " | "));

  // Joga de verdade, sem assumir as regras de cada jogo:
  //   1. clica num alvo do jogo (casa do tabuleiro ou peça da mão);
  //   2. se o texto da mesa mudou, o lance foi aceito (jogos de 1 clique,
  //      como o dominó);
  //   3. senão procura o marcador de destino legal que a UI desenha
  //      (ponto esmeralda / anel rosa ou âmbar) e clica nele (xadrez, dama).
  // Selecionar uma peça só muda CSS, por isso o sinal de progresso é o texto.
  const antes = await page.evaluate(() => document.body.innerText);
  const textoAtual = () => page.evaluate(() => document.body.innerText);
  const clicar = async (seletor) => {
    try {
      await page.click(seletor, { delay: 20 });
      return true;
    } catch {
      return false;
    }
  };
  const destinoMarcado = () =>
    page.evaluate(() => {
      for (const b of document.querySelectorAll("button[aria-label]")) {
        const marcado = [...b.querySelectorAll("span")].some((sp) =>
          /bg-emerald-400|ring-rose-500|ring-amber-400/.test(String(sp.className)),
        );
        if (marcado) return b.getAttribute("aria-label");
      }
      return null;
    });

  const alvos = await page.evaluate(() =>
    [...document.querySelectorAll("button[aria-label]")]
      .map((b) => b.getAttribute("aria-label") ?? "")
      .filter((l) => l && !/fechar|close/i.test(l)),
  );

  let jogou = false;
  for (const alvo of alvos) {
    if (!(await clicar(`button[aria-label="${alvo}"]`))) continue;
    await new Promise((r) => setTimeout(r, 300));
    if ((await textoAtual()) !== antes) {
      jogou = true;
      break;
    }
    const destino = await destinoMarcado();
    if (!destino || destino === alvo) continue;
    await clicar(`button[aria-label="${destino}"]`);
    await new Promise((r) => setTimeout(r, 550));
    if ((await textoAtual()) !== antes) {
      jogou = true;
      break;
    }
  }

  // Jogos sem peças endereçáveis (cartas/dados): tenta os botões de ação.
  if (!jogou) {
    const acoes = await page.evaluate(() =>
      [...document.querySelectorAll("button:not([disabled])")].map((b, i) => ({
        i,
        t: (b.textContent ?? "").trim(),
      })),
    );
    for (const acao of acoes.filter(
      (a) => a.t && !/voltar|reiniciar|desistir|fácil|médio|difícil/i.test(a.t),
    )) {
      await page.evaluate((idx) => {
        [...document.querySelectorAll("button:not([disabled])")][idx]?.click();
      }, acao.i);
      await new Promise((r) => setTimeout(r, 450));
      if ((await textoAtual()) !== antes) {
        jogou = true;
        break;
      }
    }
  }
  check(`${jogo.nome}: aceita interação (estado muda)`, jogou);

  // Um overlay por cima do tabuleiro é o defeito que deixa o jogo "morto".
  const bloqueio = await page.evaluate(() => {
    const overlay = document.querySelector('div.fixed.inset-0[class*="z-[100]"]');
    if (!overlay) return null;
    return (overlay.textContent ?? "").trim().slice(0, 40);
  });
  check(`${jogo.nome}: nenhum overlay cobre o tabuleiro`, bloqueio === null, String(bloqueio));

  // Volta para a lista antes do próximo jogo (o botão tem aria-label fixo).
  await page.evaluate(() => {
    const voltar = document.querySelector('button[aria-label="Voltar"]');
    voltar?.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  const voltou = await page.evaluate(() => document.body.innerText.includes("Jogos"));
  if (!voltou) {
    // Fallback: recarrega o hub, que é mais lento mas sempre volta à lista.
    await page.goto(`${BASE}/cidadela`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2000));
  }
}

console.log(`\nerros de runtime no console: ${erros.length}`);
for (const e of erros.slice(0, 6)) console.log(`   ${e}`);

console.log(`\n═══ ${ok} passaram, ${fail} falharam ═══`);
await browser.close();
if (fail > 0) process.exit(1);
