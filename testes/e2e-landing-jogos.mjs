/**
 * E2E da PÁGINA INICIAL de todos os jogos da Cidadela.
 *
 * A regra: clicar num jogo da grade NÃO pode cair direto na tela do jogo.
 * Primeiro vem a apresentação (nome, promessa, pilares, ajuda sob demanda).
 */
import puppeteer from "puppeteer-core";

const BASE = "http://localhost:3417";
let ok = 0, falhas = 0;
const checar = (c, m) => { if (c) { ok++; console.log("  ✓", m); } else { falhas++; console.log("  ✗ FALHA:", m); } };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

const texto = () => page.evaluate(() => document.body.innerText);
const clicar = (re) => page.evaluate((src) => {
  const rx = new RegExp(src, "i");
  const b = [...document.querySelectorAll("button")].find((x) => rx.test((x.textContent || "").trim()));
  if (b) { b.click(); return true; } return false;
}, re.source);

await page.goto(`${BASE}/cidadela`, { waitUntil: "networkidle2" });
await esperar(2500);
await clicar(/visitante/);
await esperar(2500);

const tGrade = await texto();
checar(/Jogos do Campus|jogos/i.test(tGrade), "a grade de jogos aparece");

// Cada jogo testado: clicar no card deve abrir a APRESENTAÇÃO, não o jogo.
const jogos = [
  { card: "Xadrez", esperado: "Xadrez" },
  { card: "Dominó", esperado: "Dominó" },
  { card: "Blackjack", esperado: "Blackjack" },
];

for (const j of jogos) {
  const abriu = await page.evaluate((nome) => {
    const el = [...document.querySelectorAll("*")].find(
      (x) => x.children.length === 0 && new RegExp(nome, "i").test(x.textContent || ""),
    );
    const card = el?.closest("button, a, [role=button]");
    if (card && !card.disabled) { card.click(); return true; }
    return false;
  }, j.card);
  checar(abriu, `o card do ${j.card} é clicável`);
  await esperar(2200);

  const t = await texto();
  checar(new RegExp(j.esperado, "i").test(t), `a apresentação do ${j.card} abriu`);
  checar(/Como jogar/i.test(t), `a apresentação do ${j.card} oferece "Como jogar"`);
  checar(/Todos os jogos/i.test(t), `a apresentação do ${j.card} tem volta para a grade`);

  // O modal de ajuda abre de verdade
  const abriuAjuda = await clicar(/Como jogar/);
  checar(abriuAjuda, `"Como jogar" do ${j.card} é clicável`);
  await esperar(800);
  const tAjuda = await texto();
  checar(/Como jogar/i.test(tAjuda) && /Entendi/i.test(tAjuda), `o modal do ${j.card} abriu`);
  await clicar(/^Entendi$/);
  await esperar(700);

  // Volta para a grade
  await clicar(/Todos os jogos/);
  await esperar(1800);
}

const tVolta = await texto();
checar(/Jogos do Campus|jogos/i.test(tVolta), "voltou para a grade de jogos");

console.log(`\nE2E LANDING DOS JOGOS — ${ok} ok, ${falhas} falhas`);
if (erros.length) console.log("erros:", erros.slice(0, 3));
await browser.close();
process.exit(falhas > 0 ? 1 : 0);
