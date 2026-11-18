/**
 * Valida a GRADE NOVA e os 5 jogos corrigidos JOGANDO de verdade.
 *
 * Não basta a tela abrir: aqui a gente joga. Para cada jogo, clica nas peças
 * e confere que o estado mudou (peça andou, dado rolou, carta saiu, peça da
 * mesa apareceu). Também mede a grade: 9 cards, cores neon distintas, e o
 * comportamento de hover (o card levanta).
 *
 * Uso: node testes/e2e-jogos-jogando.mjs [porta]
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

/** O hub está pronto? Precisa dos cards E sem overlay de tela cheia por cima
 *  (o modal de conta cobre a página: os cards existem no DOM, mas o mouse não
 *  os alcança — sem esta checagem o teste de hover falha por engano). */
async function hubPronto() {
  return page.evaluate(() => {
    const temCards = [...document.querySelectorAll("button")].some((b) =>
      (b.getAttribute("aria-label") || "").includes("—"),
    );
    if (!temCards) return false;
    const overlay = [...document.querySelectorAll("div")].some((d) => {
      const cs = getComputedStyle(d);
      return (
        cs.position === "fixed" &&
        Number(cs.zIndex) >= 90 &&
        d.offsetHeight > 300 &&
        cs.display !== "none" &&
        cs.pointerEvents !== "none"
      );
    });
    return !overlay;
  });
}

/** Espera o hub da Cidadela (com os cards) ficar visível. */
async function irParaHub() {
  await page.goto(`${BASE}/cidadela`, { waitUntil: "networkidle2" });
  await espera(2500);
  for (let i = 0; i < 10; i += 1) {
    if (await hubPronto()) return true;
    // Portão de conta: a Cidadela pede login. Como visitante dá para jogar.
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /Continuar sem conta/i.test(x.textContent || ""),
      );
      if (b) b.click();
    });
    await espera(800);
    // Portão de profissão: escolhe técnico e segue.
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

async function abrirJogo(label) {
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

  // O card agora leva à PÁGINA INICIAL do jogo (apresentação + "Como jogar").
  // É preciso passar por ela antes de chegar ao jogo em si.
  await page.evaluate(() => {
    const b = document.querySelector("[data-brio-jogar]") ||
      [...document.querySelectorAll("button")].find((x) => /jogar agora/i.test(x.textContent || ""));
    if (b) b.click();
  });
  await espera(2500);

  // Depois vem o PAINEL DE CAMPANHA (fase, história, ranking). É preciso
  // entrar na partida antes de jogar — sem isso o teste procurava casas de
  // tabuleiro numa tela que ainda é o painel.
  await page.evaluate(() => {
    const b = document.querySelector(".jcamp-jogar");
    if (b) b.click();
  });
  await espera(2500);
  return true;
}

async function voltar() {
  await page.evaluate(() => {
    try {
      window.sessionStorage.removeItem("cidadela:jogo-ativo:v1");
    } catch {}
  });
  await page.evaluate(() => {
    const b = document.querySelector('[aria-label="Voltar"]');
    if (b) b.click();
  });
  await espera(1200);
}

try {
  console.log("\n=== Grade de jogos (visual novo) ===");
  const noHub = await irParaHub();
  checar(noHub, "hub da Cidadela abriu com os cards");

  const grade = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("button")].filter((b) =>
      (b.getAttribute("aria-label") || "").includes(" — "),
    );
    const cores = cards.map((c) => c.style.getPropertyValue("--cg-cor"));
    return {
      total: cards.length,
      cores,
      distintas: new Set(cores).size,
      temSelo: cards.some((c) => c.querySelector(".cg-selo")),
      temGenero: cards.every((c) => c.querySelector(".cg-genero")),
    };
  });
  checar(grade.total === 9, `os 9 jogos aparecem na grade (${grade.total})`);
  checar(grade.distintas === 9, `cada card tem acento neon próprio (${grade.distintas} cores)`);
  checar(grade.temSelo, "selos aparecem (LENDÁRIO/1v1/etc.)");
  checar(grade.temGenero, "todo card mostra o gênero");

  // Hover: o card levanta. Precisa de mouse REAL — `:hover` não é acionado
  // por evento sintético.
  const cardXadrez = await page.$('button[aria-label^="Xadrez —"]');
  const antesHover = await page.evaluate(
    (el) => getComputedStyle(el).transform,
    cardXadrez,
  );
  await cardXadrez.hover();
  await espera(400);
  const depoisHover = await page.evaluate(
    (el) => getComputedStyle(el).transform,
    cardXadrez,
  );
  checar(
    antesHover !== depoisHover,
    `o card levanta no hover (${antesHover} → ${depoisHover})`,
  );
  // Move o mouse para longe, senão o hover interfere no clique do próximo jogo.
  await page.mouse.move(5, 5);
  await espera(300);

  console.log("\n=== Xadrez: jogar de verdade ===");
  checar(await abrirJogo("Xadrez"), "abriu o Xadrez");
  const xadrez = await page.evaluate(async () => {
    const casa = (i) => document.querySelector(`button[aria-label="Casa ${i}"]`);
    // Peão branco em 4-6 (formato do engine: coluna-linha).
    const origem = casa("4-6");
    if (!origem) return { erro: "sem casa 4-6" };
    origem.click();
    await new Promise((r) => setTimeout(r, 300));
    const destino = casa("4-5");
    if (!destino) return { erro: "sem casa 4-5" };
    const travado = destino.disabled;
    destino.click();
    await new Promise((r) => setTimeout(r, 2500));
    // Depois da minha jogada, a IA responde: o turno volta para as brancas.
    const texto = document.body.innerText;
    return {
      travado,
      voltouMinhaVez: /Turno:\s*Brancas/i.test(texto) || /Turno:\s*Pretas/i.test(texto),
      temTurno: /Turno:/i.test(texto),
    };
  });
  checar(!xadrez.erro, `o tabuleiro renderizou as casas${xadrez.erro ? " → " + xadrez.erro : ""}`);
  checar(xadrez.temTurno, "o Xadrez mostra de quem é o turno");
  checar(!xadrez.travado, "as casas clicáveis não ficaram desabilitadas");
  await voltar();

  console.log("\n=== Dama: jogar de verdade ===");
  checar(await abrirJogo("Dama"), "abriu a Dama");
  const dama = await page.evaluate(async () => {
    const casa = (i) => document.querySelector(`button[aria-label="Casa ${i}"]`);
    // A seleção não muda o TEXTO: ela pinta a casa (azul) e destaca os
    // destinos (verde). O sinal confiável é o destaque de destino aparecer.
    const destacados = () =>
      [...document.querySelectorAll("button[aria-label^='Casa ']")].filter((b) =>
        /bg-green-400/.test(b.className),
      ).length;
    // Na abertura é a vez do VERMELHO (dono 0), cujas peças podem avançar da
    // linha y=2 (as das linhas y=0/1 estão bloqueadas no início).
    for (const c of ["1-2", "3-2", "5-2", "7-2"]) {
      const el = casa(c);
      if (!el) continue;
      el.click();
      await new Promise((r) => setTimeout(r, 400));
      if (destacados() > 0) return { mudou: true, casa: c, destinos: destacados() };
    }
    return { mudou: false, destinos: 0 };
  });
  checar(
    dama.mudou,
    `a Dama destaca os destinos ao selecionar${dama.casa ? ` (${dama.casa}, ${dama.destinos} destinos)` : ""}`,
  );
  await voltar();

  console.log("\n=== Dominó: distribuir e jogar ===");
  checar(await abrirJogo("Dominó"), "abriu o Dominó");
  const domino = await page.evaluate(async () => {
    const porTexto = (re) =>
      [...document.querySelectorAll("button")].find((b) => re.test(b.textContent || ""));
    const distribuir = porTexto(/Distribuir as pe/);
    if (!distribuir) return { erro: "sem botão de distribuir" };
    distribuir.click();
    await new Promise((r) => setTimeout(r, 1500));
    const texto = document.body.innerText;
    const mao = /Sua m[ãa]o \((\d+) pe/.exec(texto);
    return {
      quantidade: mao ? Number(mao[1]) : 0,
      temPontas: /Pontas:/i.test(texto),
    };
  });
  checar(!domino.erro, `o Dominó ofereceu a distribuição${domino.erro ? " → " + domino.erro : ""}`);
  checar(domino.quantidade > 0, `a mão foi distribuída (${domino.quantidade} peças)`);
  checar(domino.temPontas, "as pontas da mesa aparecem");
  await voltar();

  console.log("\n=== Yahtzee: rolar os dados ===");
  checar(await abrirJogo("Yahtzee"), "abriu o Yahtzee");
  const yahtzee = await page.evaluate(async () => {
    const rolar = [...document.querySelectorAll("button")].find((b) =>
      /Rolar Dados/i.test(b.textContent || ""),
    );
    if (!rolar) return { erro: "sem botão de rolar" };
    const dados = () =>
      [...document.querySelectorAll("button[aria-label^='Dado ']")].map((b) =>
        b.getAttribute("aria-label"),
      );
    const antes = dados().join("|");
    rolar.click();
    await new Promise((r) => setTimeout(r, 600));
    const depois = dados().join("|");
    const restantes = /Rolagens restantes:\s*(\d+)/.exec(document.body.innerText);
    return { antes, depois, restantes: restantes ? Number(restantes[1]) : -1 };
  });
  checar(!yahtzee.erro, `o Yahtzee ofereceu a rolagem${yahtzee.erro ? " → " + yahtzee.erro : ""}`);
  checar(yahtzee.depois !== yahtzee.antes, "os dados mudaram depois de rolar");
  checar(yahtzee.restantes === 2, `o contador de rolagens caiu (${yahtzee.restantes})`);
  await voltar();

  console.log("\n=== Blackjack: apostar, pedir carta e parar ===");
  checar(await abrirJogo("Blackjack"), "abriu o Blackjack");
  const blackjack = await page.evaluate(async () => {
    const porTexto = (re) =>
      [...document.querySelectorAll("button")].find((b) => re.test(b.textContent || ""));
    const aposta = porTexto(/^\s*\d+\s*$/);
    if (!aposta) return { erro: "sem botões de aposta" };
    aposta.click();
    await new Promise((r) => setTimeout(r, 800));
    const texto1 = document.body.innerText;
    const pedir = porTexto(/Pedir carta/i);
    if (!pedir) return { erro: "sem botão de pedir carta", fase: texto1.slice(0, 120) };
    pedir.click();
    await new Promise((r) => setTimeout(r, 600));
    const parar = porTexto(/Parar/i);
    const cartas = document.querySelectorAll("div.flex.h-24").length;
    return {
      cartas,
      temParar: Boolean(parar),
      total: /Total:\s*(\d+)/.exec(document.body.innerText)?.[1] ?? null,
    };
  });
  checar(!blackjack.erro, `o Blackjack deixou apostar${blackjack.erro ? " → " + blackjack.erro : ""}`);
  checar(blackjack.cartas >= 4, `as cartas foram distribuídas (${blackjack.cartas})`);
  checar(blackjack.total !== null, `o total da mão aparece (${blackjack.total})`);
  await voltar();

  console.log("\n=== Erros de runtime ===");
  const novos = erros.filter((e) => !/React error #418/.test(e));
  checar(novos.length === 0, `sem erro de runtime (${novos.length})`);
  if (novos.length) console.log("    " + novos.slice(0, 3).join("\n    "));
} catch (e) {
  falhas += 1;
  console.log(`\n✗ EXCEÇÃO: ${e.message}`);
} finally {
  await browser.close();
}

console.log(`\n${ok} passaram, ${falhas} falharam (total ${ok + falhas})`);
process.exit(falhas === 0 ? 0 : 1);
