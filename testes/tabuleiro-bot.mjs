/**
 * Jogador de jogos de TABULEIRO (xadrez, dama) para os testes de campanha.
 *
 * Escolhe a jogada com busca alpha-beta no motor REAL do jogo e a aplica
 * CLICANDO na interface, como um jogador faria. O clique é o caminho testado;
 * a busca existe porque vencer o MCTS de 6000 iterações clicando ao acaso é
 * impraticável — e um teste que clica ao acaso não prova nada.
 */

/** Espera a vez voltar para o humano (ou o jogo acabar). */
async function esperarMinhaVez(page, eu, timeoutMs = 60000) {
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
      };
    }, eu);
    if (st.ok && (st.acabou || st.daVez)) return st;
    await new Promise((r) => setTimeout(r, 250));
  }
  return { ok: false, timeout: true };
}

/**
 * Joga uma partida inteira de tabuleiro pela UI.
 *
 * @param page página do puppeteer
 * @param eu id do jogador humano (0 nas telas atuais)
 * @param profundidade profundidade da busca alpha-beta
 */
export async function jogarTabuleiro(page, eu, profundidade, maxJogadas = 220) {
  const log = [];
  for (let n = 0; n < maxJogadas; n += 1) {
    const st = await esperarMinhaVez(page, eu);
    if (!st.ok) return { fim: "erro", motivo: st.timeout ? "timeout na vez" : "sem estado", log };
    if (st.acabou) {
      return { fim: "acabou", vencedor: st.vencedor, jogadas: n, log };
    }

    const jogada = await page.evaluate(
      (prof, jogador) => {
        const j = window.__jogo.melhorJogada(prof, jogador);
        return j ? JSON.parse(JSON.stringify(j)) : null;
      },
      profundidade,
      eu,
    );
    if (!jogada) return { fim: "sem-jogada", jogadas: n, log };

    // Clica origem e destino na UI, como o jogador.
    const aplicou = await page.evaluate((j) => {
      const p = window.__jogo.partes();
      if (!p) return false;
      const peca = p.estado.pieces.find((x) => x.id === j.data.from);
      if (!peca) return false;
      const sel = (x, y) => document.querySelector('[aria-label="Casa ' + x + '-' + y + '"]');
      const origem = sel(peca.position.x, peca.position.y);
      if (!origem) return false;
      origem.click();
      return true;
    }, jogada);
    if (!aplicou) return { fim: "sem-origem", jogadas: n, log };

    await new Promise((r) => setTimeout(r, 220));

    const [dx, dy] = String(jogada.data.to).split("-");
    const destinoOk = await page.evaluate((x, y) => {
      const el = document.querySelector('[aria-label="Casa ' + x + '-' + y + '"]');
      if (!el) return false;
      el.click();
      return true;
    }, dx, dy);
    if (!destinoOk) return { fim: "sem-destino", jogadas: n, log };

    log.push(`${jogada.data.from}->${jogada.data.to}`);
    await new Promise((r) => setTimeout(r, 300));
  }
  return { fim: "limite", jogadas: maxJogadas, log };
}
