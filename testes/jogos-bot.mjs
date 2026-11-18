/**
 * Jogadores dos jogos de campanha, clicando na INTERFACE real.
 *
 * Cada função joga uma partida inteira e devolve o que aconteceu. A jogada é
 * escolhida com o motor verdadeiro do jogo (busca alpha-beta para tabuleiro,
 * regra para cartas/dados) e aplicada por clique — o caminho testado é o do
 * jogador, não um atalho pelo estado.
 */

import { HELPERS_JOGO, MINIMAX, esperar } from "./jogo-lib.mjs";

/** Instala os helpers e a busca no browser. */
export async function instalar(page) {
  await page.evaluate(HELPERS_JOGO + MINIMAX);
}

/** Espera a vez voltar para o humano (ou a partida acabar). */
async function esperarVez(page, eu, timeoutMs = 90000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const st = await page.evaluate((jogador) => {
      const p = window.__jogo.partes();
      if (!p) return { ok: false };
      return {
        ok: true,
        acabou: p.motor.isGameOver(p.estado),
        vencedor: p.motor.getWinner(p.estado),
        daVez: p.estado.currentPlayer === jogador,
        fase: p.estado.phase,
      };
    }, eu);
    if (st.ok && (st.acabou || st.daVez)) return st;
    await esperar(200);
  }
  return { ok: false, timeout: true };
}

/** Clica numa casa do tabuleiro pelo rótulo. */
async function clicarCasa(page, x, y) {
  return page.evaluate((cx, cy) => {
    const el = document.querySelector('[aria-label="Casa ' + cx + '-' + cy + '"]');
    if (!el) return false;
    el.click();
    return true;
  }, x, y);
}

/**
 * Jogos de tabuleiro (xadrez, dama): origem e destino clicados na UI.
 */
export async function jogarTabuleiro(page, eu, profundidade, maxJogadas = 240) {
  const log = [];
  for (let n = 0; n < maxJogadas; n += 1) {
    const st = await esperarVez(page, eu);
    if (!st.ok) return { fim: "erro", motivo: st.timeout ? "timeout" : "sem-estado", log };
    if (st.acabou) return { fim: "acabou", vencedor: st.vencedor, jogadas: n, log };

    const jogada = await page.evaluate(
      (prof, jogador) => {
        const j = window.__jogo.melhorJogada(prof, jogador);
        return j ? JSON.parse(JSON.stringify(j)) : null;
      },
      profundidade,
      eu,
    );
    if (!jogada) return { fim: "sem-jogada", jogadas: n, log };

    const pos = await page.evaluate((id) => {
      const p = window.__jogo.partes();
      const pc = p && p.estado.pieces.find((x) => x.id === id);
      return pc ? { x: pc.position.x, y: pc.position.y } : null;
    }, jogada.data.from);
    if (!pos) return { fim: "sem-origem", jogadas: n, log };

    await clicarCasa(page, pos.x, pos.y);
    await esperar(180);
    const [dx, dy] = String(jogada.data.to).split("-").map(Number);
    await clicarCasa(page, dx, dy);
    log.push(`${jogada.data.from}->${jogada.data.to}`);
    await esperar(260);
  }
  return { fim: "limite", jogadas: maxJogadas, log };
}

/**
 * Dominó: escolhe a jogada que descarta mais pontos e joga pela UI.
 *
 * Estratégia simples e honesta — joga a peça de maior valor que couber, que
 * é o que faz o jogador humano razoável; a vitória vem de fechar a mão antes.
 */
export async function jogarDomino(page, maxJogadas = 160) {
  const log = [];
  for (let n = 0; n < maxJogadas; n += 1) {
    const st = await esperarVez(page, 0);
    if (!st.ok) return { fim: "erro", motivo: st.timeout ? "timeout" : "sem-estado", log };
    if (st.acabou) return { fim: "acabou", vencedor: st.vencedor, jogadas: n, log };

    // Primeira jogada: a tela pede para distribuir.
    if (st.fase === "dealing") {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) =>
          /Distribuir as pe/i.test(x.textContent || ""),
        );
        if (b) b.click();
      });
      await esperar(900);
      continue;
    }

    const escolha = await page.evaluate(() => {
      const p = window.__jogo.partes();
      if (!p) return null;
      const jogadas = p.motor.getValidMoves(p.estado);
      const jogar = jogadas.filter((m) => m.type === "play");
      if (jogar.length) {
        // Peça de maior soma primeiro (despacha o peso da mão).
        const valor = (m) => {
          const pc = p.estado.players[0].hand.find((x) => x.id === m.data.pieceId);
          return pc ? Number(pc.data.left) + Number(pc.data.right) : -1;
        };
        jogar.sort((a, b) => valor(b) - valor(a));
        const m = jogar[0];
        const pc = p.estado.players[0].hand.find((x) => x.id === m.data.pieceId);
        return { tipo: "play", pecaId: m.data.pieceId, lado: m.data.side, indice: p.estado.players[0].hand.indexOf(pc) };
      }
      if (jogadas.some((m) => m.type === "draw")) return { tipo: "draw" };
      if (jogadas.some((m) => m.type === "pass")) return { tipo: "pass" };
      return null;
    });
    if (!escolha) return { fim: "sem-jogada", jogadas: n, log };

    if (escolha.tipo === "play") {
      // Clica a peça na mão (mesma ordem da mão renderizada) e depois a ponta.
      const clicou = await page.evaluate((idx) => {
        const pecas = [...document.querySelectorAll('[aria-label^="Peça "]')];
        if (!pecas[idx]) return false;
        pecas[idx].click();
        return true;
      }, escolha.indice);
      if (!clicou) return { fim: "sem-peca", jogadas: n, log };
      await esperar(250);
      await page.evaluate((lado) => {
        const re = lado === "left" ? /ponta esquerda/i : /ponta direita/i;
        const b = [...document.querySelectorAll("button")].find((x) => re.test(x.textContent || ""));
        if (b) b.click();
      }, escolha.lado);
      log.push(`${escolha.pecaId}:${escolha.lado}`);
    } else if (escolha.tipo === "draw") {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) => /Comprar do monte/i.test(x.textContent || ""));
        if (b) b.click();
      });
      log.push("compra");
    } else {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) => /Passar a vez/i.test(x.textContent || ""));
        if (b) b.click();
      });
      log.push("passa");
    }
    await esperar(300);
  }
  return { fim: "limite", jogadas: maxJogadas, log };
}

/**
 * Yahtzee: rola até 3 vezes mantendo os dados que servem e marca a categoria
 * de maior pontuação real (a mesma função do adapter que a IA usa).
 */
export async function jogarYahtzee(page, maxTurnos = 30) {
  const log = [];
  for (let t = 0; t < maxTurnos; t += 1) {
    const st = await esperarVez(page, 0);
    if (!st.ok) return { fim: "erro", motivo: st.timeout ? "timeout" : "sem-estado", log };
    if (st.acabou) return { fim: "acabou", vencedor: st.vencedor, turnos: t, log };

    // Turno do humano: rola até 3 vezes, mantendo a maioria.
    for (let r = 0; r < 3; r += 1) {
      const podeRolar = await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) => /Rolar Dados/i.test(x.textContent || ""));
        return Boolean(b) && !b.disabled;
      });
      if (!podeRolar) break;
      if (r > 0) {
        // Mantém os dados que mais repetem antes de rolar de novo.
        await page.evaluate(() => {
          const p = window.__jogo.partes();
          if (!p) return;
          const dados = (p.estado.customState && p.estado.customState.dice) || [];
          const cont = new Map();
          for (const d of dados) cont.set(d, (cont.get(d) || 0) + 1);
          const max = Math.max(...cont.values());
          const alvo = [...cont.entries()].find(([, c]) => c === max)[0];
          const dadosDom = [...document.querySelectorAll('[aria-label^="Dado "]')];
          dados.forEach((d, i) => {
            const el = dadosDom[i];
            if (!el) return;
            const jaMantido = /mantido/.test(el.getAttribute("aria-label") || "");
            const queroManter = d === alvo;
            if (queroManter !== jaMantido) el.click();
          });
        });
        await esperar(250);
      }
      await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) => /Rolar Dados/i.test(x.textContent || ""));
        if (b && !b.disabled) b.click();
      });
      await esperar(450);
    }

    // Marca a categoria de maior pontuação real entre as livres.
    const marcou = await page.evaluate(() => {
      const p = window.__jogo.partes();
      if (!p) return null;
      const dados = (p.estado.customState && p.estado.customState.dice) || [];
      const adapter = p.motor;
      const jaMarcadas = ((p.estado.customState && p.estado.customState.categories) || {})[0] || [];
      const ROTULO = { ones: "1s", twos: "2s", threes: "3s", fours: "4s", fives: "5s", sixes: "6s",
        three_of_kind: "Trinca", four_of_kind: "Quadra", full_house: "Full House",
        small_straight: "Seq. Pequena", large_straight: "Seq. Grande", yahtzee: "Yahtzee", chance: "Chance" };
      const todas = ["ones","twos","threes","fours","fives","sixes","three_of_kind","four_of_kind","full_house","small_straight","large_straight","yahtzee","chance"];
      const livres = todas.filter((c) => !jaMarcadas.includes(c));
      if (!livres.length) return null;
      let melhor = livres[0];
      let melhorPts = -1;
      for (const c of livres) {
        let pts = 0;
        try {
          pts = adapter.calcularPontuacaoCategoria
            ? adapter.calcularPontuacaoCategoria(dados, c)
            : 0;
        } catch { pts = 0; }
        if (pts > melhorPts) { melhorPts = pts; melhor = c; }
      }
      const botoes = [...document.querySelectorAll("button")];
      const rotulo = ROTULO[melhor];
      const alvo = botoes.find((b) => {
        const rot = (b.textContent || "").trim();
        return !b.disabled && rot.startsWith(rotulo);
      });
      if (!alvo) return null;
      alvo.click();
      return { categoria: melhor, pontos: melhorPts };
    });
    if (!marcou) return { fim: "sem-marcar", turnos: t, log };
    log.push(`${marcou.categoria}=${marcou.pontos}`);
    // Depois de marcar, a IA joga o turno dela (rola 3x e marca). Esperar
    // aqui e o que faz o loop voltar para a vez do humano.
    await esperar(3000);
  }
  return { fim: "limite", turnos: maxTurnos, log };
}

/**
 * Blackjack: sessão com a estratégia básica (o que a mesa espera de um
 * jogador competente) até atingir o alvo de lucro ou esgotar as mãos.
 */
/**
 * Valor da carta VISIVEL da banca (a primeira; a segunda fica fechada).
 *
 * A decisao de pedir/parar no blackjack depende so do que o jogador ve. Usar
 * o total do dealer incluiria a carta fechada — informacao que ninguem tem —
 * e foi o que fazia o bot parar/pedir na hora errada.
 */
async function lerCartaVisivel(page) {
  return page.evaluate(() => {
    const p = window.__jogo.partes();
    if (!p) return 0;
    const mao = (p.estado.customState && p.estado.customState.dealerHand) || [];
    const c = mao[0];
    return c ? Number((c.data && c.data.value) || 0) : 0;
  });
}

export async function jogarBlackjack(page, maxMaos = 40) {
  const log = [];
  const lerMesa = () =>
    page.evaluate(() => {
      const p = window.__jogo.partes();
      if (!p) return null;
      const e = p.estado;
      const valor = (cartas) => {
        let t = 0, ases = 0;
        for (const c of cartas) {
          t += Number((c.data && c.data.value) || 0);
          if (c.data && c.data.rank === "A") ases += 1;
        }
        while (t > 21 && ases > 0) { t -= 10; ases -= 1; }
        return t;
      };
      return {
        fase: e.phase,
        acabou: p.motor.isGameOver(e),
        minha: valor((e.players[0] && e.players[0].hand) || []),
        dealer: valor((e.customState && e.customState.dealerHand) || []),
        // Resultado DESTA mão: 1 ganhou, 0 empate, -1 perdeu.
        resultado: (e.scores && e.scores[0]) ?? null,
      };
    });

  // A sessão é a SOMA das mãos (±1 cada). As fichas voltam a 1000 a cada mão,
  // então medir fichas nunca mostra lucro — o que decide a campanha é o saldo
  // acumulado de vitórias menos derrotas.
  let soma = 0;
  for (let m = 0; m < maxMaos; m += 1) {
    let mesa = await lerMesa(page);
    if (!mesa) return { fim: "sem-estado", soma, log };

    // Aposta mínima (10) — a aposta não muda o resultado da campanha, só o
    // tamanho do risco; menos exposição deixa a sorte trabalhar mais mãos.
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /^10$/.test((x.textContent || "").trim()));
      if (b && !b.disabled) b.click();
    });
    await esperar(600);

    // Mão com ESTRATÉGIA BÁSICA: pedir carta em tudo abaixo de 17 queima a
    // mão — com 12-16 contra banca fraca (2 a 6) o certo é PARAR. A decisão
    // usa só a carta VISÍVEL (a segunda fica fechada).
    for (let j = 0; j < 12; j += 1) {
      mesa = await lerMesa(page);
      if (!mesa || mesa.acabou) break;
      const visivel = await lerCartaVisivel(page);
      let pedir;
      if (mesa.minha <= 11) pedir = true;
      else if (mesa.minha >= 17) pedir = false;
      else pedir = visivel >= 7;
      await page.evaluate((p) => {
        const re = p ? /Pedir carta/i : /^Parar$/i;
        const b = [...document.querySelectorAll("button")].find((x) => re.test(x.textContent || ""));
        if (b && !b.disabled) b.click();
      }, pedir);
      await esperar(500);
    }

    mesa = await lerMesa(page);
    const r = mesa && mesa.resultado !== null ? mesa.resultado : 0;
    soma += r;
    log.push(`${mesa ? mesa.minha + "x" + mesa.dealer : "?"}=${r > 0 ? "V" : r < 0 ? "D" : "E"}`);

    // Fecha a sessão À FRENTE: a casa tem vantagem, então a sessão vencedora
    // é a que o jogador encerra no lucro, não a que ele estica.
    //
    // Mínimo de 5 mãos: sair na primeira mão vencida seria sessão de fachada
    // (a campanha julga o líquido, mas o jogo tem de ser jogado de verdade).
    if (m + 1 >= 5 && soma > 0) {
      await sairDaMesa(page);
      return { fim: "lucro", soma, maos: m + 1, log };
    }

    // Próxima mão: "Novo Jogo" reinicia as fichas (a soma da sessão continua).
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /Novo Jogo/i.test(x.textContent || ""));
      if (b && !b.disabled) b.click();
    });
    await esperar(600);
  }

  await sairDaMesa(page);
  return { fim: "limite", soma, maos: maxMaos, log };
}

/** Sai da mesa de blackjack (fecha a sessão e vai para a tela de fim). */
async function sairDaMesa(page) {
  await page.evaluate(() => {
    const b = document.querySelector('[aria-label="Voltar"]');
    if (b) b.click();
  });
  await esperar(2500);
}
