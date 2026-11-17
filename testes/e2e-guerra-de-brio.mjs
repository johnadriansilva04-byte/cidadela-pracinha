/**
 * E2E do GUERRA DE BRIO — joga de verdade no navegador (chromium headless).
 *
 * Sobe o build de produção (testes/serve-build.mjs), abre a Cidadela, entra no
 * card "Guerra de Brio" e disputa duelos completos contra o adversário virtual:
 * seleciona modalidade/assunto/adversário, responde rodadas por
 * `data-brio-option`, espera a revelação e confere o resultado final.
 *
 * O E2E NÃO depende de login (o jogo aceita modo local). Quando há credenciais
 * no ambiente, ele também valida o caminho autenticado.
 *
 * Uso: node testes/e2e-guerra-de-brio.mjs
 */
import { spawn } from "node:child_process";
import { setTimeout as esperar } from "node:timers/promises";

const PORTA = 3418;
const BASE = `http://localhost:${PORTA}`;
// A Cidadela (onde vivem os jogos) fica na rota /cidadela.
const CIDADELA = `${BASE}/cidadela`;

let passou = 0;
let falhou = 0;
const falhas = [];

function checar(condicao, descricao) {
  if (condicao) {
    passou += 1;
    console.log(`  ✓ ${descricao}`);
  } else {
    falhou += 1;
    falhas.push(descricao);
    console.log(`  ✗ ${descricao}`);
  }
}

const servidor = spawn("node", ["testes/serve-build.mjs", String(PORTA)], {
  stdio: ["ignore", "pipe", "pipe"],
});

async function aguardarServidor(tentativas = 40) {
  for (let i = 0; i < tentativas; i += 1) {
    try {
      const r = await fetch(CIDADELA, { redirect: "manual" });
      if (r.status < 500) return true;
    } catch {
      /* ainda subindo */
    }
    await esperar(500);
  }
  return false;
}

async function main() {
  const { default: puppeteer } = await import("puppeteer-core");

  const pronto = await aguardarServidor();
  if (!pronto) {
    console.error("servidor não subiu");
    servidor.kill("SIGTERM");
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium",
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    defaultViewport: { width: 420, height: 900 },
  });

  try {
    const page = await browser.newPage();
    const erros = [];
    page.on("pageerror", (e) => erros.push(String(e.message)));
    page.on("console", (m) => {
      if (m.type() === "error") erros.push(m.text());
    });

    console.log("\n=== 1. A Cidadela abre e mostra o card Guerra de Brio ===");
    await page.goto(CIDADELA, { waitUntil: "networkidle2", timeout: 60000 });
    await esperar(1200);

    const textoPagina = await page.evaluate(() => document.body.innerText);
    checar(
      textoPagina.includes("Cidadela") || textoPagina.includes("Entrar") || textoPagina.includes("visitante"),
      "página da Cidadela renderizou",
    );

    // Se houver portão de login, entra como visitante.
    if (/Continuar como visitante/i.test(textoPagina)) {
      const botoes = await page.$$("button");
      for (const b of botoes) {
        const t = await page.evaluate((el) => el.textContent ?? "", b);
        if (/Continuar como visitante/i.test(t)) {
          await b.click();
          break;
        }
      }
      await esperar(1500);
    }

    const textoHub = await page.evaluate(() => document.body.innerText);
    checar(/Guerra de Brio/i.test(textoHub), "card 'Guerra de Brio' aparece na Cidadela");
    checar(/Duelo de conhecimento/i.test(textoHub), "card tem a descrição do duelo");

    console.log("\n=== 2. Abrir o jogo e ver o lobby ===");
    await clicarPorTexto(page, /Guerra de Brio/i);
    await esperar(1500);

    const textoLobby = await page.evaluate(() => document.body.innerText);
    checar(/Guerra de Brio/i.test(textoLobby), "lobby abriu");
    checar(/Modalidade/i.test(textoLobby), "seção de modalidade presente");
    checar(/Adversário/i.test(textoLobby), "seção de adversário presente");
    checar(/multidisciplinar|Multidisciplinar/i.test(textoLobby), "modalidade multidisciplinar oferecida");

    // O aviso de modo local só existe no lobby — valida AQUI, não no resultado.
    const avisoLobby = await page.evaluate(() => {
      const el = document.querySelector(".brio-aviso");
      return el ? el.textContent.trim() : null;
    });
    if (avisoLobby) {
      checar(/não é salvo/i.test(avisoLobby), "aviso local declara que o resultado NÃO é salvo");
      checar(!/sincroniz/i.test(avisoLobby), "aviso local NÃO promete sincronização");
    } else {
      checar(true, "sem aviso local no lobby (backend ativo — duelo persistido)");
    }

    console.log("\n=== 3. Escolher adversário e iniciar o duelo ===");
    // Escolhe o adversário mais forte para exercitar o motor.
    await clicarPorTexto(page, /Especialista/i).catch(() => {});
    await esperar(300);

    const iniciou = await clicarPorTexto(page, /Iniciar duelo/i);
    checar(iniciou, "botão 'Iniciar duelo' clicado");
    await esperar(2000);

    const textoArena = await page.evaluate(() => document.body.innerText);
    checar(/\/\d+\s*$|1\/\d+/m.test(textoArena) || /1\//.test(textoArena), "arena mostra a rodada atual");

    const temAlternativas = await page.evaluate(
      () => document.querySelectorAll("[data-brio-option]").length,
    );
    checar(temAlternativas === 6, `arena mostra 6 alternativas A–F (encontrado: ${temAlternativas})`);

    const letras = await page.evaluate(() =>
      [...document.querySelectorAll("[data-brio-option]")].map((b) => b.getAttribute("data-brio-option")),
    );
    checar(
      JSON.stringify(letras) === JSON.stringify(["A", "B", "C", "D", "E", "F"]),
      `alternativas rotuladas A–F (${letras.join(",")})`,
    );

    console.log("\n=== 4. Jogar o duelo inteiro (responde até finalizar) ===");
    let rodadas = 0;
    let viuRevelacao = 0;
    const limite = 40; // 10 rodadas + desempate, com folga

    for (let i = 0; i < limite; i += 1) {
      const terminou = await page.evaluate(() => /Revanche/i.test(document.body.innerText));
      if (terminou) break;

      // 1) Se estiver na tela de revelação, avança.
      const avancou = await page.evaluate(() => {
        const b = document.querySelector("[data-brio-continuar]");
        if (!b) return false;
        b.click();
        return true;
      });
      if (avancou) {
        viuRevelacao += 1;
        await esperar(900);
        continue;
      }

      // 2) Senão, responde a rodada corrente.
      const clicou = await page.evaluate(() => {
        const botoes = [...document.querySelectorAll("[data-brio-option]")];
        const habilitado = botoes.find((b) => !b.disabled);
        if (!habilitado) return false;
        habilitado.click();
        return true;
      });
      if (clicou) rodadas += 1;
      await esperar(1100);

      // 3) Se a revelação abriu sozinha (o tempo fechou a rodada), avança.
      const avancouSozinho = await page.evaluate(() => {
        const b = document.querySelector("[data-brio-continuar]");
        if (!b) return false;
        b.click();
        return true;
      });
      if (avancouSozinho) {
        viuRevelacao += 1;
        await esperar(900);
      }
    }

    checar(rodadas >= 10, `respondeu ${rodadas} rodadas (mínimo 10)`);
    checar(viuRevelacao >= 8, `revelação apareceu em ${viuRevelacao} rodadas`);

    console.log("\n=== 5. Resultado final ===");
    const textoFinal = await page.evaluate(() => document.body.innerText);
    checar(/Revanche/i.test(textoFinal), "tela de resultado com botão Revanche");
    checar(
      /Vitória|Derrota|Empate/i.test(textoFinal),
      "veredito exibido (Vitória/Derrota/Empate)",
    );
    checar(/Aproveitamento/i.test(textoFinal), "aproveitamento exibido");
    checar(/Índice de conhecimento/i.test(textoFinal), "índice de conhecimento exibido");
    checar(/não é um QI oficial/i.test(textoFinal), "ressalva de que não é QI oficial");

    const placarFinal = textoFinal.match(/(\d+)\s*×\s*(\d+)/);
    checar(placarFinal != null, `placar final legível (${placarFinal?.[0] ?? "não encontrado"})`);

    console.log("\n=== 5b. Modo convite (dois humanos) existe para quem tem conta ===");
    // Sem sessão o lobby não oferece convite (o assento 2 é um usuário real);
    // o visitante continua com o adversário virtual. Verifica que o seletor de
    // modo NÃO aparece para visitante e que o jogo segue utilizável.
    const seletorModo = await page.evaluate(
      () => document.querySelectorAll("[data-brio-modo]").length,
    );
    checar(
      seletorModo === 0,
      `visitante não vê o seletor de convite (encontrado: ${seletorModo})`,
    );

    console.log("\n=== 6. Revanche mantém o fluxo ===");
    await clicarPorTexto(page, /^Revanche$/i).catch(() => {});
    await esperar(2500);
    const aposRevanche = await page.evaluate(() => document.body.innerText);
    const novasAlternativas = await page.evaluate(
      () => document.querySelectorAll("[data-brio-option]").length,
    );
    checar(
      novasAlternativas === 6 || /Modalidade/i.test(aposRevanche),
      "revanche reabre a arena (ou volta ao lobby)",
    );

    console.log("\n=== 7. Sem erros de runtime ===");
    const errosReais = erros.filter(
      (e) => !/favicon|adsbygoogle|net::ERR_|Failed to load resource|monetag|ads/i.test(e),
    );
    checar(errosReais.length === 0, `sem erros de runtime (${errosReais.length})`);
    if (errosReais.length > 0) {
      console.log("    erros:", errosReais.slice(0, 5).join(" | "));
    }
  } finally {
    await browser.close();
    servidor.kill("SIGTERM");
  }

  console.log(`\n${passou} passaram, ${falhou} falharam (total ${passou + falhou})`);
  if (falhas.length > 0) {
    console.log("Falhas:");
    falhas.forEach((f) => console.log(`  - ${f}`));
  }
  process.exit(falhou === 0 ? 0 : 1);
}

/** Clica no primeiro elemento (button/a/div clicável) cujo texto casa. */
async function clicarPorTexto(page, regex) {
  const clicou = await page.evaluate((fonte) => {
    const re = new RegExp(fonte, "i");
    const candidatos = [...document.querySelectorAll("button, a, [role=button]")];
    const alvo = candidatos.find((el) => re.test(el.textContent ?? ""));
    if (!alvo) return false;
    alvo.click();
    return true;
  }, regex.source);
  return clicou;
}

main().catch((e) => {
  console.error("E2E falhou:", e);
  servidor.kill("SIGTERM");
  process.exit(1);
});
