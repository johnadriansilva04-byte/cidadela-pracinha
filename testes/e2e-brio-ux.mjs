/**
 * E2E da UX do Guerra de Brio: página inicial, assistente por etapas e clima.
 */
import puppeteer from "puppeteer-core";

const BASE = "http://localhost:3417";
let ok = 0, falhas = 0;
const checar = (c, m) => { if (c) { ok++; console.log("  ✓", m); } else { falhas++; console.log("  ✗ FALHA:", m); } };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

const clicar = (re) => page.evaluate((src) => {
  const rx = new RegExp(src, "i");
  const b = [...document.querySelectorAll("button")].find((x) => rx.test((x.textContent || "").trim()));
  if (b) { b.click(); return true; } return false;
}, re.source);

const texto = () => page.evaluate(() => document.body.innerText);

await page.goto(`${BASE}/cidadela`, { waitUntil: "networkidle2" });
await esperar(2500);
await clicar(/visitante/);
await esperar(2500);
await page.evaluate(() => {
  const el = [...document.querySelectorAll("*")].find(x => x.children.length === 0 && /Guerra de Brio/i.test(x.textContent || ""));
  el?.closest("button, a, [role=button]")?.click();
});
await esperar(3500);

// ---------------------------------------------- PÁGINA INICIAL
const t1 = await texto();
checar(/Dois competidores/i.test(t1), "a landing mostra a chamada do jogo");
checar(/Duelo de verdade/i.test(t1), "a landing mostra os pilares");
checar(/Índice de Conhecimento/i.test(t1), "a landing explica o índice");
checar(/QI oficial/i.test(t1), "o aviso honesto aparece na landing");

// o detalhe completo está ESCONDIDO atrás do "?"
const antes = (await texto()).length;
await clicar(/Como jogar/);
await esperar(900);
const tAjuda = await texto();
checar(/A partida em 6 etapas/i.test(tAjuda), "o modal 'Como jogar' abre com o passo a passo");
checar(/O tempo é do servidor/i.test(tAjuda), "o modal explica o relógio do servidor");
await clicar(/^Entendi$/);
await esperar(700);

await clicar(/Modos de jogo/);
await esperar(900);
const tModos = await texto();
checar(/Duelo livre/i.test(tModos) && /Convidar um amigo/i.test(tModos) && /Modo história/i.test(tModos),
  "o modal 'Modos de jogo' lista os 3 modos (incluindo o ONLINE)");
await clicar(/^Entendi$/);
await esperar(700);

await clicar(/Regras e detalhes/);
await esperar(900);
const tDet = await texto();
checar(/Teoria de Resposta ao Item/i.test(tDet), "o modal de detalhes explica a TRI");
checar(/Antirrepetição/i.test(tDet), "o modal de detalhes explica a antirrepetição");
await clicar(/^Entendi$/);
await esperar(700);

// ---------------------------------------------- ASSISTENTE POR ETAPAS
await clicar(/Jogar agora/);
await esperar(2000);
const t2 = await texto();
checar(/Sobre o que vai ser o duelo/i.test(t2), "o assistente começa com UMA pergunta");
checar(/RECOMENDADO/i.test(t2), "a opção recomendada já vem marcada");
// NÃO pode despejar tudo: adversário não aparece na etapa 1
checar(!/Especialista/i.test(t2), "o nível de adversário NÃO aparece na primeira etapa");
checar(!/Estudante/i.test(t2), "a lista de níveis está escondida na etapa 1");

await clicar(/^Continuar$/);
await esperar(1500);
const t3 = await texto();
checar(/Contra quem/i.test(t3), "avançou para a etapa do adversário");
checar(/RECOMENDADO/i.test(t3), "o adversário recomendado vem marcado");
checar(/15 segundos por pergunta/i.test(t3), "o resumo mostra o formato da partida");

// ------------------------------------ ONLINE SEMPRE VISÍVEL (com motivo)
// Antes a seção de convite SUMIA para quem não estava logado e o jogador
// perguntava "cadê o online?". Agora ela aparece sempre; sem conta, o botão
// fica desabilitado DIZENDO o motivo.
const conviteVisivel = await page.evaluate(() => Boolean(document.querySelector("[data-brio-modo=\"convite\"]")));
checar(conviteVisivel, "a opção de convidar SEMPRE aparece (mesmo sem conta)");
const motivo = await page.evaluate(() => {
  const b = document.querySelector('[data-brio-modo="convite"]');
  return b ? (b.querySelector(".pj-opcao-desc")?.textContent || "").trim() : "";
});
checar(/Entre na Cidadela/i.test(motivo), `sem conta, o botão diz o motivo (lido: "${motivo}")`);
const desabilitado = await page.evaluate(() => document.querySelector('[data-brio-modo="convite"]')?.disabled === true);
checar(desabilitado, "sem conta, o botão de convite fica desabilitado (não promete o que não faz)");

// ---------------------------------------------- CLIMA NA CAMPANHA
// "← Anterior" volta UMA etapa; a landing exige voltar até o passo 0 e então
// "← Voltar". (Antes eu clicava uma vez só e caía na etapa de modalidade.)
await clicar(/^← Anterior$/);
await esperar(1000);
await clicar(/^← Voltar$/);
await esperar(1500);
const tLanding = await texto();
checar(/Dois competidores/i.test(tLanding), "voltou para a página inicial do jogo");
await clicar(/modo história/i);
await esperar(2500);
const t4 = await texto();
checar(/Ato 1 de 6/i.test(t4), "a campanha abriu");
const clima1 = await page.evaluate(() => document.querySelector("[data-clima]")?.getAttribute("data-clima"));
checar(clima1 === "deslocamento", `o clima do ato 1 é 'deslocamento' (lido: ${clima1})`);
checar(/Fora do tempo/i.test(t4), "o selo do clima aparece");

// A digitação: o texto começa INCOMPLETO e cresce
// Medir o TOTAL visível de todos os parágrafos: como a digitação é
// sequencial, esse número só cresce. Medir "o último parágrafo" atravessava
// parágrafos (o 1º terminava e o 2º começava) e dava leitura falsa.
const medir = () => page.evaluate(() => {
  const todos = [...document.querySelectorAll(".brio-narrativa--viva")];
  const visivel = todos.reduce((soma, p) => soma + (p.querySelector("span")?.textContent?.length ?? 0), 0);
  const completo = todos.reduce((soma, p) => soma + (p.getAttribute("aria-label")?.length ?? 0), 0);
  return { completo, visivel };
});
const m1 = await medir();
const parcial1 = m1.completo;
const visivel1 = m1.visivel;
await esperar(2200);
const m2 = await medir();
const visivel2 = m2.visivel;
checar(visivel1 > 0 && visivel2 > visivel1, `o texto está sendo digitado ao vivo (${visivel1} → ${visivel2})`);
checar(parcial1 > visivel1, "o texto completo existe no DOM (acessível) antes de terminar de digitar");
checar(await page.evaluate(() => Boolean(document.querySelector(".brio-cursor"))), "o cursor de digitação aparece");

// as escolhas NÃO aparecem antes do texto terminar
checar(!(await page.evaluate(() => Boolean(document.querySelector("[data-brio-escolha]")))) ||
  /O relatório está sendo escrito/.test(t4) === false, "as escolhas respeitam a digitação");

// ---------------------------------------------- CLIMA MUDA POR CENA
await esperar(9000); // deixa o texto terminar
const escolheu = await page.evaluate(() => { const b = document.querySelector("[data-brio-escolha]"); if (b) { b.click(); return true; } return false; });
checar(escolheu, "as escolhas aparecem depois da digitação");
await esperar(1500);
await clicar(/^Continuar$/);
await esperar(3000);
const clima2 = await page.evaluate(() => document.querySelector("[data-clima]")?.getAttribute("data-clima"));
checar(clima2 === "presente", `o clima MUDA na cena 2 (século XXI) — lido: ${clima2}`);
const t5 = await texto();
checar(/Século XXI/i.test(t5), "o selo mostra o novo lugar");

console.log(`\nE2E UX DO BRIO — ${ok} ok, ${falhas} falhas`);
if (erros.length) console.log("erros:", erros.slice(0, 3));
await browser.close();
process.exit(falhas > 0 ? 1 : 0);
