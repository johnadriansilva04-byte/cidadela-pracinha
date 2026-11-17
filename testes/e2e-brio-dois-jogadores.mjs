/**
 * E2E do GUERRA DE BRIO com DOIS JOGADORES REAIS, contra o Supabase de
 * produção (duas contas de teste dedicadas).
 *
 * Prova o critério mais forte do documento: "não declare que o duelo está
 * funcional sem testar dois jogadores reais em uma partida sincronizada".
 *
 * Fluxo: A cria a sala de convite → B entra pelo link → os dois jogam as
 * MESMAS rodadas → os dois veem o MESMO resultado final.
 *
 * ATENÇÃO AO CRONÔMETRO: a rodada dura 7 SEGUNDOS (o servidor é a
 * autoridade). O teste NÃO pode esperar mais que isso entre olhar a tela e
 * responder, senão a rodada fecha sozinha e as alternativas somem. Por isso
 * o laço abaixo age assim que encontra as opções, com passos curtos.
 *
 * Uso: node testes/e2e-brio-dois-jogadores.mjs [porta]
 */
import puppeteer from "puppeteer-core";

const PORTA = Number(process.argv[2] ?? 3417);
const BASE = `http://localhost:${PORTA}`;
const CHROMIUM = process.env.CHROMIUM_PATH ?? "/usr/bin/chromium";

const CONTA_A = { email: "tdts.brio.a@example.invalid", senha: "TesteBrio!2026" };
const CONTA_B = { email: "tdts.brio.b@example.invalid", senha: "TesteBrio!2026" };

let ok = 0;
let falhas = 0;
const errosDePagina = [];

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
const texto = (page) => page.evaluate(() => document.body.innerText);

async function novaPagina(browser) {
  // Contexto ISOLADO por jogador: no mesmo contexto os dois logins dividem o
  // localStorage e a segunda conta sobrescreve a sessão da primeira.
  const contexto = await browser.createBrowserContext();
  const page = await contexto.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on("pageerror", (e) => errosDePagina.push(e.message));
  return page;
}

/** Faz login pelo portão da Cidadela e abre o card do jogo. */
async function entrarNoJogo(page, conta) {
  await page.goto(`${BASE}/cidadela`, { waitUntil: "networkidle2" });
  await espera(2500);

  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      /^Aceitar$/i.test(x.textContent.trim()),
    );
    if (b) b.click();
  });
  await espera(400);

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
      conta.email,
      conta.senha,
    );
    await espera(600);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /^ENTRAR$/i.test(x.textContent.trim()),
      );
      if (b && !b.disabled) b.click();
    });
    await espera(5000);
  }

  // Chega ao hub de jogos. Contas novas passam pelo portão de profissão;
  // contas que já têm profissão podem cair na tela "Trocar de profissão",
  // que se sai pelo "Voltar".
  for (let tentativa = 0; tentativa < 12; tentativa += 1) {
    const t = await texto(page);
    if (/Guerra de Brio/i.test(t)) break;
    if (/Quem é você na Cidadela/i.test(t)) {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) =>
          /T[ée]cnico de Futebol/i.test(x.textContent),
        );
        if (b) b.click();
      });
    } else {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll("button, a")].find((x) =>
          /^Voltar$/i.test(x.textContent.trim()),
        );
        if (b) b.click();
      });
    }
    await espera(1200);
  }

  await page.evaluate(() => {
    const card = [...document.querySelectorAll("button, a")].find((x) =>
      /Guerra de Brio/i.test(x.textContent),
    );
    if (card) card.click();
  });
  await espera(3000);
}

/** Estado da tela do jogo numa página. */
const estado = (page) =>
  page.evaluate(() => {
    const t = document.body.innerText;
    if (/Revanche/i.test(t)) return "resultado";
    const opcoes = [...document.querySelectorAll("[data-brio-option]")].filter(
      (b) => !b.disabled,
    );
    if (opcoes.length > 0) return "opcoes";
    if (document.querySelector("[data-brio-continuar]")) return "revelacao";
    if (/Sala aberta/i.test(t)) return "espera";
    return "outro";
  });

const responder = (page, letra) =>
  page.evaluate((l) => {
    const b = [...document.querySelectorAll("[data-brio-option]")].find(
      (x) => x.getAttribute("data-brio-option") === l && !x.disabled,
    );
    if (!b) return false;
    b.click();
    return true;
  }, letra);

const continuar = (page) =>
  page.evaluate(() => {
    const b = document.querySelector("[data-brio-continuar]");
    if (!b) return false;
    b.click();
    return true;
  });

const lerEnunciado = (page) =>
  page.evaluate(() => {
    const el = document.querySelector(".brio-enunciado");
    return el ? el.textContent.trim() : null;
  });

const lerAlternativas = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-brio-option]")]
      .map((b) => b.getAttribute("data-brio-option"))
      .join(""),
  );

const browser = await puppeteer.launch({
  executablePath: CHROMIUM,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});

try {
  console.log("\n=== 1. Dois jogadores entram (contas reais de produção) ===");
  const pageA = await novaPagina(browser);
  await entrarNoJogo(pageA, CONTA_A);
  const corpoA = await texto(pageA);
  checar(/Guerra de Brio/i.test(corpoA), "jogador A está no lobby do duelo");
  checar(/Adversário/i.test(corpoA), "A vê a seção de adversário");
  checar(/Convidar um amigo/i.test(corpoA), "A vê a opção de convidar (tem conta + backend)");

  const pageB = await novaPagina(browser);
  await entrarNoJogo(pageB, CONTA_B);
  const corpoB = await texto(pageB);
  checar(/Guerra de Brio/i.test(corpoB), "jogador B está no lobby do duelo");

  console.log("\n=== 2. A cria a sala de convite e recebe o link ===");
  await pageA.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      /Convidar um amigo/i.test(x.textContent),
    );
    if (b) b.click();
  });
  await espera(400);
  await pageA.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      /Criar sala e convidar/i.test(x.textContent),
    );
    if (b) b.click();
  });
  await espera(3500);

  const corpoSala = await texto(pageA);
  checar(/Sala aberta/i.test(corpoSala), "A vê a tela de sala aberta");
  checar(/Aguardando o adversário/i.test(corpoSala), "A está aguardando o convidado");

  const link = await pageA.evaluate(() => {
    const el = document.querySelector("[data-brio-link]");
    return el ? el.textContent.trim() : null;
  });
  checar(Boolean(link && /\?brio=/.test(link)), `link de convite gerado (${link ?? "nenhum"})`);
  if (!link) throw new Error("sem link de convite — não dá para continuar");

  console.log("\n=== 3. B entra pelo link ===");
  await pageB.goto(link, { waitUntil: "networkidle2" });
  await espera(2500);
  const estadoB = await estado(pageB);
  checar(estadoB !== "espera", `B NÃO ficou na tela de espera (estado: ${estadoB})`);

  console.log("\n=== 4. Os dois jogam a MESMA partida (sincronizado) ===");
  let enunciadoIgual = null;
  let alternativasIguais = null;
  let rodadasJogadas = 0;
  let viuEsperaA = false;

  for (let passo = 0; passo < 900; passo += 1) {
    const [eA, eB] = await Promise.all([estado(pageA), estado(pageB)]);
    if (eA === "resultado" && eB === "resultado") break;

    // Primeira rodada em que os DOIS estão escolhendo: compara o conteúdo.
    if (eA === "opcoes" && eB === "opcoes" && enunciadoIgual === null) {
      const [enA, enB, altA, altB] = await Promise.all([
        lerEnunciado(pageA),
        lerEnunciado(pageB),
        lerAlternativas(pageA),
        lerAlternativas(pageB),
      ]);
      enunciadoIgual = enA && enA === enB ? enA : false;
      alternativasIguais = altA === altB && altA.length === 6 ? altA : false;
    }

    if (eA === "opcoes") {
      await responder(pageA, "A");
      rodadasJogadas += 1;
    } else if (eA === "revelacao") {
      await continuar(pageA);
    } else if (eA === "espera") {
      viuEsperaA = true;
    }

    if (eB === "opcoes") await responder(pageB, "B");
    else if (eB === "revelacao") await continuar(pageB);

    await espera(120);
  }

  checar(!viuEsperaA, "A saiu da sala de espera quando o convidado entrou");
  checar(
    Boolean(enunciadoIgual),
    `os dois recebem o MESMO enunciado (${String(enunciadoIgual).slice(0, 46)}…)`,
  );
  checar(
    Boolean(alternativasIguais),
    `as mesmas 6 alternativas A–F nos dois (${alternativasIguais || "—"})`,
  );
  checar(rodadasJogadas > 0, `o duelo avançou rodadas (${rodadasJogadas} respostas de A)`);

  console.log("\n=== 5. Resultado final consistente para os dois ===");
  const fimA = await texto(pageA);
  const fimB = await texto(pageB);
  checar(/Revanche/i.test(fimA), "A chegou ao resultado final");
  checar(/Revanche/i.test(fimB), "B chegou ao resultado final");

  const placar = async (page) =>
    page.evaluate(() => {
      const m = document.body.innerText.match(/(\d+)\s*[×x]\s*(\d+)/);
      return m ? `${m[1]}x${m[2]}` : null;
    });
  const [pA, pB] = await Promise.all([placar(pageA), placar(pageB)]);
  checar(Boolean(pA) && Boolean(pB), `os dois veem um placar (A=${pA} B=${pB})`);
  // O placar aparece na PERSPECTIVA de cada jogador ("meu placar × adversário"),
  // então os números vêm invertidos de propósito. A consistência real é: o
  // número de um é o do outro espelhado — prova de que é a MESMA partida.
  const espelhado = (x, y) => {
    if (!x || !y) return false;
    const [a1, a2] = x.split("x").map(Number);
    const [b1, b2] = y.split("x").map(Number);
    return a1 === b2 && a2 === b1;
  };
  checar(
    espelhado(pA, pB),
    `placar espelhado nos dois (A=${pA} B=${pB}) — mesma partida, visão de cada um`,
  );
  checar(
    /índice de conhecimento/i.test(fimA) && /índice de conhecimento/i.test(fimB),
    "os dois veem o índice de conhecimento",
  );

  console.log("\n=== 6. Erros de runtime ===");
  // O React #418 (hydration mismatch) é PRÉ-EXISTENTE no app (o AGENTS.md
  // registra a mesma classe de erro em outras telas). O que importa aqui é
  // não haver erro NOVO do duelo.
  const outros = errosDePagina.filter((e) => !/Minified React error #418/.test(e));
  checar(
    outros.length === 0,
    `nenhum erro de runtime no duelo (${outros.length}${outros.length ? ": " + outros[0].slice(0, 90) : ""})`,
  );
  if (errosDePagina.length !== outros.length) {
    console.log(`    (nota: ${errosDePagina.length - outros.length} aviso(s) React #418 — pré-existente)`);
  }
} catch (erro) {
  falhas += 1;
  console.log(`\n✗ EXCEÇÃO: ${erro.message}`);
} finally {
  await browser.close();
}

console.log(`\n${ok} passaram, ${falhas} falharam (total ${ok + falhas})`);
process.exit(falhas > 0 ? 1 : 0);
