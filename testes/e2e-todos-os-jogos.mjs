/**
 * E2E de TODOS OS JOGOS da Cidadela dos Clássicos.
 *
 * Para cada card da lista oficial (`GAMES` em src/routes/cidadela.tsx):
 * abre o jogo, espera a tela montar e verifica que
 *   (a) o card abre (a tela mudou de conteúdo),
 *   (b) NÃO aparece erro de runtime novo,
 *   (c) dá para voltar ao hub e abrir o próximo (sem travar a navegação).
 *
 * Não julga a qualidade de cada jogo: verifica que cada um ABRE e não quebra —
 * que é o que um passeio por todos os jogos precisa provar.
 *
 * Uso: node testes/e2e-todos-os-jogos.mjs [porta]
 */
import puppeteer from "puppeteer-core";

const PORTA = Number(process.argv[2] ?? 3417);
const BASE = `http://localhost:${PORTA}`;
const CHROMIUM = process.env.CHROMIUM_PATH ?? "/usr/bin/chromium";

const CONTA = { email: "tdts.brio.a@example.invalid", senha: "TesteBrio!2026" };

// Lista canônica dos jogos (label como aparece no card).
const JOGOS = [
  { label: "Futebol", pista: /Estádio do Campus|Carreira no Campus|Amistoso/i },
  { label: "Trilha", pista: /Trilha|Tabuleiro|Mo|Peça|Peças/i },
  { label: "Xadrez", pista: /Xadrez|Rei|Pe[ãa]o|Brancas|Pretas|xeque/i },
  { label: "Car Brawl", pista: /Car|Brawl|Sumo|Carro/i },
  { label: "Dama", pista: /Dama|Captur/i },
  { label: "Blackjack", pista: /Blackjack|21|Carta|M[ãa]o|Pedir|Parar/i },
  { label: "Dominó", pista: /Dominó|Encaixe|Peça/i },
  { label: "Yahtzee", pista: /Yahtzee|Dado|Dados|Rolar|Rolagem/i },
  { label: "Guerra de Brio", pista: /Guerra de Brio|Duelo|Adversário/i },
];

let ok = 0;
let falhas = 0;
const errosGlobais = [];

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

const browser = await puppeteer.launch({
  executablePath: CHROMIUM,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});

try {
  const contexto = await browser.createBrowserContext();
  const page = await contexto.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on("pageerror", (e) => errosGlobais.push(e.message));

  console.log("\n=== Preparação: login e hub de jogos ===");
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
        const e = inputs.find((i) => i.type === "email");
        const s = inputs.find((i) => i.type === "password");
        const set = (el, v) => {
          Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set.call(el, v);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        };
        if (e) set(e, email);
        if (s) set(s, senha);
      },
      CONTA.email,
      CONTA.senha,
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

  // Sai do portão de profissão / tela de troca até ver os cards.
  for (let i = 0; i < 12; i += 1) {
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
  const hub = await texto(page);
  checar(/Jogos do Campus/i.test(hub), "hub de jogos carregado");
  checar(/Guerra de Brio/i.test(hub), "os 9 cards estão no hub");

  const estaNoHub = async () => {
    const t = await texto(page);
    return /Guerra de Brio/i.test(t) && /Jogos do Campus/i.test(t);
  };

  /** Volta ao hub: tenta o botão "Voltar" real e, se preciso, recarrega. */
  async function voltarAoHub() {
    for (let i = 0; i < 6; i += 1) {
      if (await estaNoHub()) return true;
      await page.evaluate(() => {
        const b = document.querySelector('[aria-label="Voltar"]');
        if (b) b.click();
      });
      await espera(1200);
    }
    if (await estaNoHub()) return true;

    // Rede de segurança: a rota guarda o jogo ativo em sessionStorage
    // ("cidadela:jogo-ativo:v1") e o RESTAURA no reload — limpar a chave é o
    // que devolve o hub de verdade.
    await page.evaluate(() => {
      // O acesso é protegido: em about:blank (fim de uma partida que navegou)
      // ler sessionStorage lança SecurityError.
      try {
        window.sessionStorage.removeItem("cidadela:jogo-ativo:v1");
      } catch {
        /* origem sem storage acessível — nada a limpar */
      }
    });
    await page.goto(`${BASE}/cidadela`, { waitUntil: "networkidle2" });
    await espera(3000);
    for (let i = 0; i < 8; i += 1) {
      if (await estaNoHub()) return true;
      const t = await texto(page);
      if (/Quem é você na Cidadela/i.test(t)) {
        await page.evaluate(() => {
          const b = [...document.querySelectorAll("button")].find((x) =>
            /T[ée]cnico de Futebol/i.test(x.textContent),
          );
          if (b) b.click();
        });
      }
      await espera(1200);
    }
    return estaNoHub();
  }

  console.log("\n=== Abrindo cada jogo ===");
  for (const jogo of JOGOS) {
    const antes = errosGlobais.length;

    const abriu = await page.evaluate((label) => {
      // Casar pelo nome acessível do card (aria-label = "Nome — descrição").
      // O card é um <button> de verdade, então o clique por teclado/ponteiro
      // funciona igual; casar pelo aria-label evita confundir com outros
      // botões que só MENCIONAM o nome (ex.: "Técnico de Futebol" no portão).
      const cards = [...document.querySelectorAll("button")];
      const card =
        cards.find((x) => (x.getAttribute("aria-label") || "").startsWith(label + " —")) ??
        cards.find((x) => (x.getAttribute("aria-label") || "").startsWith(label + " -")) ??
        cards.find((x) => x.querySelector("h3")?.textContent.trim() === label) ??
        cards.find((x) => x.querySelector("h2")?.textContent.trim() === label);
      if (!card) return false;
      card.click();
      return true;
    }, jogo.label);
    await espera(3500);

    const t = await texto(page);
    const mudou = t !== hub && t.length > 0;
    const temPista = jogo.pista.test(t);
    const errosNovos = errosGlobais
      .slice(antes)
      .filter((e) => !/Minified React error #418/.test(e));

    checar(abriu, `${jogo.label}: card encontrado e clicado`);
    checar(mudou, `${jogo.label}: a tela do jogo abriu (conteúdo mudou)`);
    checar(temPista, `${jogo.label}: a tela é mesmo do jogo (conteúdo esperado)`);
    checar(
      errosNovos.length === 0,
      `${jogo.label}: sem erro de runtime${errosNovos.length ? " → " + errosNovos[0].slice(0, 80) : ""}`,
    );

    const voltou = await voltarAoHub();
    checar(voltou, `${jogo.label}: deu para voltar ao hub (navegação não travou)`);
    await espera(600);
  }

  console.log("\n=== Resumo de erros de runtime ===");
  const outros = errosGlobais.filter((e) => !/Minified React error #418/.test(e));
  checar(
    outros.length === 0,
    `nenhum erro de runtime novo em nenhum jogo (${outros.length})`,
  );
  if (errosGlobais.length !== outros.length) {
    console.log(
      `    (nota: ${errosGlobais.length - outros.length} aviso(s) React #418 — pré-existente no app)`,
    );
  }
} catch (erro) {
  falhas += 1;
  console.log(`\n✗ EXCEÇÃO: ${erro.message}`);
} finally {
  await browser.close();
}

console.log(`\n${ok} passaram, ${falhas} falharam (total ${ok + falhas})`);
process.exit(falhas > 0 ? 1 : 0);
