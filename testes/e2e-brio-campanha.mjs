/**
 * E2E do MODO HISTÓRIA do Guerra de Brio — prova no navegador real.
 */
import puppeteer from "puppeteer-core";

const BASE = "http://localhost:3417";
const CHROME = "/usr/bin/chromium";
let ok = 0, falhas = 0;
const checar = (c, m) => { if (c) { ok++; console.log("  ✓", m); } else { falhas++; console.log("  ✗ FALHA:", m); } };

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });

const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

// Entra na Cidadela e abre o Guerra de Brio
await page.goto(`${BASE}/cidadela`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 2500));

// Visitante: "Continuar como visitante" quando aparecer
const visitante = await page.$x
  ? null : null;
const btnVisitante = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /visitante/i.test(x.textContent || ""));
  if (b) { b.click(); return true; }
  return false;
});
if (btnVisitante) await new Promise((r) => setTimeout(r, 2500));

// Procura o card do Brio
const abriuBrio = await page.evaluate(() => {
  const el = [...document.querySelectorAll("*")].find(
    (x) => x.children.length === 0 && /Guerra de Brio/i.test(x.textContent || ""),
  );
  if (!el) return false;
  const card = el.closest("button, a, [role=button]") || el.parentElement?.closest("button, a, [role=button]");
  if (card) { card.click(); return true; }
  el.click();
  return true;
});
checar(abriuBrio, "o card do Guerra de Brio existe na Cidadela");
await new Promise((r) => setTimeout(r, 3000));

// O jogo agora abre na PÁGINA INICIAL (apresentação), não no lobby.
const textoInicio = await page.evaluate(() => document.body.innerText);
checar(/Guerra de Brio/i.test(textoInicio), "a página inicial do Brio carregou");
checar(/Dois competidores/i.test(textoInicio), "a página inicial traz a chamada do jogo");

// O modo história é oferecido na própria página inicial.
const entrouCampanha = await page.evaluate(() => {
  const b = document.querySelector("[data-brio-historia]");
  if (b) { b.click(); return true; }
  return false;
});
checar(entrouCampanha, "o botão do MODO HISTÓRIA é clicável na página inicial");
await new Promise((r) => setTimeout(r, 2500));

const textoCamp = await page.evaluate(() => document.body.innerText);
checar(/O Despertar/i.test(textoCamp), "abriu no Ato 1 — O Despertar");
checar(/Ato 1 de 6/i.test(textoCamp), "o cabeçalho mostra Ato 1 de 6");
checar(/Sem Nevoeiro/i.test(textoCamp), "a primeira cena carregou");
checar(/Fato histórico|Ficção do universo|Hipótese|Fonte secundária/i.test(textoCamp), "a classificação da fonte é exibida");
// A narrativa é digitada ao vivo: as escolhas só entram depois que o texto
// termina de ser escrito (ou quando o jogador toca para revelar tudo).
async function esperarEscolha(limite = 30000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limite) {
    if (await page.evaluate(() => Boolean(document.querySelector("[data-brio-escolha]")))) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}
checar(await esperarEscolha(), "as escolhas são apresentadas depois da digitação");
checar(/FEB|expedicionário/i.test(textoCamp), "o protagonista é o expedicionário da FEB");

// Escolhe a primeira opção
const escolheu = await page.evaluate(() => {
  const b = document.querySelector("[data-brio-escolha]");
  if (b) { b.click(); return true; }
  return false;
});
checar(escolheu, "há um botão de escolha clicável");
await new Promise((r) => setTimeout(r, 2000));

const textoConseq = await page.evaluate(() => document.body.innerText);
checar(/Consequência/i.test(textoConseq), "a consequência da escolha aparece");
checar(/Continuar|Encarar a prova/i.test(textoConseq), "há botão para continuar a leitura");

// Continua → deve ir para a segunda cena
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /^Continuar$/i.test((x.textContent || "").trim()));
  if (b) b.click();
});
// A cena 2 também é digitada ao vivo: espera o título dela aparecer.
await new Promise((r) => setTimeout(r, 3500));
const textoCena2 = await page.evaluate(() => document.body.innerText);
checar(/O Século que Não É o Meu/i.test(textoCena2), "avançou para a cena 2 do ato 1");

// Progresso
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /Progresso/i.test(x.textContent || ""));
  if (b) b.click();
});
await new Promise((r) => setTimeout(r, 1200));
const textoProg = await page.evaluate(() => document.body.innerText);
checar(/Sua campanha/i.test(textoProg), "o painel de progresso abre");
checar(/O Navio e o Silêncio/i.test(textoProg), "os 6 atos estão listados (ato 3 visível)");
checar(/A Ciência do Desprezo/i.test(textoProg), "o ato de eugenia está na campanha");
checar(/O Tribunal/i.test(textoProg), "o ato de Nuremberg está na campanha");

// Persistência: F5 mantém o progresso
await page.reload({ waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 3500));
const aposF5 = await page.evaluate(() => {
  const raw = Object.keys(localStorage).filter((k) => k.includes("brio:campanha"));
  return { chaves: raw, valor: raw.length ? localStorage.getItem(raw[0]) : null };
});
checar(aposF5.chaves.length > 0, "o progresso da campanha é persistido no aparelho");
checar(!!aposF5.valor && /ato-1/.test(aposF5.valor), "o estado salvo contém o ato atual");
checar(!!aposF5.valor && /rigor|empatia|coragem/.test(aposF5.valor), "os traços de caráter são salvos");

console.log(`\nE2E MODO HISTÓRIA — ${ok} ok, ${falhas} falhas`);
if (erros.length) console.log("erros de página:", erros.slice(0, 3));
await browser.close();
process.exit(falhas > 0 ? 1 : 0);
