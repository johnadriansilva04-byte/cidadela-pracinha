/**
 * Campanha completa dos 5 jogos universais, com conta real.
 *
 * Abre cada jogo, joga a fase atrás da fase (4 por jogo = 20 fases) clicando na
 * interface, e registra o desfecho narrado pela campanha. O SOV e o progresso
 * são gravados pelo próprio app no Supabase — este script só joga e observa.
 *
 * Uso: BASE=http://localhost:3417 node testes/e2e-campanha-completa.mjs
 */

import puppeteer from "puppeteer-core";
import { esperar, abrirJogo, lerFim, lerPainel } from "./jogo-lib.mjs";
import { instalar, jogarTabuleiro, jogarDomino, jogarYahtzee, jogarBlackjack } from "./jogos-bot.mjs";

const BASE = process.env["BASE"] || "http://localhost:3417";
// Conta E2E oficial do projeto (README, seção "Conta E2E oficial").
const EMAIL = process.env["E2E_EMAIL"] || "openhands.rookie.e2e@gmail.com";
const SENHA = process.env["E2E_PASSWORD"] || "";

if (!SENHA) {
  console.error(
    "Defina E2E_PASSWORD (a senha da conta E2E do README) antes de rodar.\n" +
      "Ex.: E2E_PASSWORD='...' node testes/e2e-campanha-completa.mjs",
  );
  process.exit(1);
}

/** Entra na Cidadela com a conta real e chega ao hub de jogos. */
async function entrar(page) {
  await page.goto(`${BASE}/cidadela`, { waitUntil: "networkidle2" });
  await esperar(3000);

  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      /^Aceitar$/i.test(x.textContent.trim()),
    );
    if (b) b.click();
  });
  await esperar(600);

  const temLogin = await page.evaluate(
    () => document.querySelectorAll("input.field-input").length >= 2,
  );
  if (temLogin) {
    await page.evaluate(
      (email, senha) => {
        const inputs = [...document.querySelectorAll("input.field-input")];
        const emailEl = inputs.find((i) => i.type === "email");
        const senhaEl = inputs.find((i) => i.type === "password");
        const set = (el, valor) => {
          const proto = Object.getPrototypeOf(el);
          Object.getOwnPropertyDescriptor(proto, "value").set.call(el, valor);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        };
        if (emailEl) set(emailEl, email);
        if (senhaEl) set(senhaEl, senha);
      },
      EMAIL,
      SENHA,
    );
    await esperar(800);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /^ENTRAR$/i.test(x.textContent.trim()),
      );
      if (b && !b.disabled) b.click();
    });
    await esperar(6000);
  }

  // Contas novas passam pelo portão de profissão; contas com profissão caem
  // na tela "Trocar de profissão". Nos dois casos, escolher Técnico de Futebol
  // leva ao hub.
  for (let i = 0; i < 10; i += 1) {
    const pronto = await page.evaluate(() =>
      [...document.querySelectorAll("button")].some((b) =>
        (b.getAttribute("aria-label") || "").includes(" — "),
      ),
    );
    if (pronto) return true;
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /T[ée]cnico de Futebol/i.test(x.textContent || ""),
      );
      if (b) b.click();
    });
    await esperar(1500);
  }
  return false;
}

const JOGOS = [
  { nome: "Xadrez", joga: (p) => jogarTabuleiro(p, 0, 4) },
  { nome: "Dama", joga: (p) => jogarTabuleiro(p, 0, 4) },
  { nome: "Dominó", joga: (p) => jogarDomino(p) },
  { nome: "Yahtzee", joga: (p) => jogarYahtzee(p) },
  { nome: "Blackjack", joga: (p) => jogarBlackjack(p, 30) },
];

let ok = 0;
let falhas = 0;
const historia = [];
const check = (cond, msg) => {
  if (cond) { ok += 1; console.log(`  ok  ${msg}`); }
  else { falhas += 1; console.log(`  FALHA  ${msg}`); }
};

/** Clica um botão pelo texto (primeiro habilitado que casar). */
async function clicarTexto(page, re) {
  return page.evaluate((fonte) => {
    const re = new RegExp(fonte, "i");
    const b = [...document.querySelectorAll("button")].find(
      (x) => re.test((x.textContent || "").trim()) && !x.disabled,
    );
    if (!b) return false;
    b.click();
    return true;
  }, re.source);
}

/** Espera a tela de fim de partida aparecer. */
async function esperarFim(page, timeoutMs = 120000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const fim = await lerFim(page);
    if (fim.temFim) return fim;
    await esperar(600);
  }
  return null;
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 950 });
page.on("pageerror", (e) => console.log("  PAGEERROR:", String(e).slice(0, 200)));

try {
  const entrou = await entrar(page);
  check(entrou, "login real e hub de jogos alcançado");

  for (const jogo of JOGOS) {
    console.log(`\n== ${jogo.nome} ==`);
    await abrirJogo(page, jogo.nome);
    await instalar(page);

    for (let fase = 1; fase <= 4; fase += 1) {
      // `abrirJogo` só foi chamado na fase 1: nas seguintes voltamos pelo
      // painel, então aqui garantimos que a partida está aberta.
      const noJogo = await page.evaluate(() => Boolean(window.__jogo && window.__jogo.partes()));
      if (!noJogo) {
        // O botão do painel é o `.jcamp-jogar`; casar por /jogar/i pegava
        // "Cansou de jogar? Descubra algo novo" (card do rodapé) e nada abria.
        const abriu = await page.evaluate(() => {
          const b = document.querySelector(".jcamp-jogar");
          if (!b) return false;
          b.click();
          return true;
        });
        if (!abriu) await clicarTexto(page, /jogar pela gl|come/);
        await esperar(2000);
        await instalar(page);
      }

      // Um jogador real repete a fase perdida. Até 4 tentativas por fase.
      let r = null;
      let fim = null;
      for (let tent = 1; tent <= 4; tent += 1) {
        r = await jogo.joga(page);
        fim = await esperarFim(page);
        if (!fim) break;
        if (fim.titulo === "Vitória!") break;
        // Perdeu/empatou: volta ao painel e enfrenta de novo.
        if (tent < 4) {
          await clicarTexto(page, /painel da campanha/);
          await esperar(2000);
          await page.evaluate(() => document.querySelector(".jcamp-jogar")?.click());
          await esperar(2000);
          await instalar(page);
        }
      }
      check(Boolean(fim), `${jogo.nome} fase ${fase}: tela de fim apareceu`);
      if (!fim) break;

      check(fim.titulo !== null, `${jogo.nome} fase ${fase}: título "${fim.titulo}"`);
      if (fim.fala) historia.push(`${jogo.nome} f${fase}: ${fim.fala}`);
      check(
        Boolean(fim.fala && fim.fala.length > 10),
        `${jogo.nome} fase ${fase}: história narrada`,
      );

      if (r.fim === "acabou") {
        check(r.vencedor === 0, `${jogo.nome} fase ${fase}: jogador venceu (vencedor=${r.vencedor})`);
      }

      // Volta ao painel para liberar/abrir a próxima fase.
      const voltou = await clicarTexto(page, /painel da campanha/);
      if (!voltou) {
        await clicarTexto(page, /jogar de novo/);
      }
      await esperar(1500);
    }

    // Sai do jogo para o hub antes do próximo.
    await clicarTexto(page, /voltar/i);
    await esperar(1200);
  }
} finally {
  console.log(`\n== HISTÓRIA NARRADA (${historia.length} falas) ==`);
  for (const f of historia) console.log("  " + f);
  console.log(`\nRESULTADO: ${ok} ok, ${falhas} falhas`);
  await browser.close();
}

process.exit(falhas > 0 ? 1 : 0);
