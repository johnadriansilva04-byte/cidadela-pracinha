/**
 * E2E da PROVA do modo história — joga a prova do ato 1 até o fim e confirma
 * que o resultado volta para a narrativa (e que o ato é concluído).
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

const clicar = (re) =>
  page.evaluate((src) => {
    const rx = new RegExp(src, "i");
    const b = [...document.querySelectorAll("button")].find((x) => rx.test((x.textContent || "").trim()));
    if (b) { b.click(); return true; }
    return false;
  }, re.source);

await page.goto(`${BASE}/cidadela`, { waitUntil: "networkidle2" });
await esperar(2500);
await clicar(/visitante/);
await esperar(2500);
await page.evaluate(() => {
  const el = [...document.querySelectorAll("*")].find(
    (x) => x.children.length === 0 && /Guerra de Brio/i.test(x.textContent || ""),
  );
  const card = el?.closest("button, a, [role=button]");
  if (card) card.click();
});
await esperar(3000);

// Entra no modo história pela PÁGINA INICIAL (o fluxo mudou: a apresentação
// vem antes do lobby/configuração).
await page.evaluate(() => document.querySelector("[data-brio-historia]")?.click());
await esperar(2500);

// --- cena 1: o texto é digitado ao vivo; espera a escolha existir de fato.
async function esperarEscolha(limite = 25000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limite) {
    const existe = await page.evaluate(() => Boolean(document.querySelector("[data-brio-escolha]")));
    if (existe) return true;
    await esperar(400);
  }
  return false;
}
checar(await esperarEscolha(), "as escolhas aparecem depois da digitação (cena 1)");
await page.evaluate(() => document.querySelector("[data-brio-escolha]")?.click());
await esperar(1500);
await clicar(/^Continuar$/);
await esperar(1800);

// --- cena 2 (última do ato 1): escolhe e encara a prova
const textoCena2 = await page.evaluate(() => document.body.innerText);
checar(/O Século que Não É o Meu/i.test(textoCena2), "chegou na última cena do ato 1");
checar(await esperarEscolha(), "as escolhas aparecem depois da digitação (cena 2)");
await page.evaluate(() => document.querySelector("[data-brio-escolha]")?.click());
await esperar(1500);

const temBotaoProva = await page.evaluate(() =>
  [...document.querySelectorAll("button")].some((x) => /Encarar a prova/i.test(x.textContent || "")),
);
checar(temBotaoProva, "o botão 'Encarar a prova' aparece na última cena");
await clicar(/Encarar a prova/);
await esperar(3000);

// --- a arena abriu?
const textoArena = await page.evaluate(() => document.body.innerText);
checar(/1\/4|2\/4|3\/4|4\/4/.test(textoArena), "a arena da prova abriu (mostra a rodada N/M)");
const temAlternativas = await page.evaluate(() =>
  document.querySelectorAll("[data-brio-option]").length,
);
checar(temAlternativas >= 6, `a prova tem 6 alternativas (${temAlternativas})`);
checar(/Estudante/i.test(textoArena), "o adversário da prova é o Estudante (nível 1)");

// --- joga a prova inteira respondendo sempre a primeira alternativa.
// A revelação tem botão próprio (`data-brio-continuar`): usar o atributo evita
// clicar em "Continuar a leitura" do bloco de resultado da campanha, que o
// fecharia antes da verificação.
let rodadas = 0;
for (let i = 0; i < 40; i++) {
  const respondeu = await page.evaluate(() => {
    const b = document.querySelector("[data-brio-option]");
    if (b && !b.disabled) { b.click(); return true; }
    return false;
  });
  if (respondeu) rodadas++;
  await esperar(800);
  // Fecha a rodada SOMENTE pelo botão da revelação.
  await page.evaluate(() => document.querySelector("[data-brio-continuar]")?.click());
  await esperar(900);
  const txt = await page.evaluate(() => document.body.innerText);
  if (/Prova vencida|Prova não vencida/i.test(txt)) break;
}
checar(rodadas >= 4, `a prova teve rodadas respondidas (${rodadas})`);

// --- o resultado voltou para a narrativa?
const textoFinal = await page.evaluate(() => document.body.innerText);
checar(/Prova vencida|Prova não vencida/i.test(textoFinal), "o resultado da prova voltou para a campanha");
checar(/acertos/i.test(textoFinal), "o resultado mostra os acertos");

// --- o ato 2 ficou acessível (se venceu) ou dá para repetir (se não)
const progressoSalvo = await page.evaluate(() => {
  const k = Object.keys(localStorage).find((x) => x.includes("brio:campanha"));
  return k ? localStorage.getItem(k) : null;
});
checar(!!progressoSalvo, "o progresso foi salvo depois da prova");
const estado = progressoSalvo ? JSON.parse(progressoSalvo) : null;
checar(!!estado?.historicoPerguntas?.length, "as perguntas da prova entraram no antirrepetição");
checar(estado?.historicoPerguntas?.length >= 4, `histórico tem as perguntas vistas (${estado?.historicoPerguntas?.length})`);

console.log(`\nE2E PROVA DO ATO — ${ok} ok, ${falhas} falhas`);
if (erros.length) console.log("erros:", erros.slice(0, 3));
await browser.close();
process.exit(falhas > 0 ? 1 : 0);
