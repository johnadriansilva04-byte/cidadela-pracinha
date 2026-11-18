/**
 * Utilitário compartilhado pelos testes de campanha: acessa o MOTOR e o
 * ESTADO reais do jogo a partir do fiber do React, para escolher jogadas
 * legais em vez de clicar às cegas.
 *
 * Isto existe porque vencer o xadrez/dama contra o MCTS de 6000 iterações
 * com cliques aleatórios é impraticável — e um teste que clica ao acaso não
 * prova nada sobre a campanha. As jogadas continuam sendo aplicadas PELA UI
 * (clique no botão da casa), então o caminho testado é o do jogador.
 */

/** Instala no browser os helpers `__jogo`. */
export const HELPERS_JOGO = `
window.__jogo = {
  /** Fiber do componente que hospeda estado + motor do jogo. */
  fiber() {
    const ancora =
      document.querySelector('[aria-label^="Casa "]') ||
      document.querySelector('[aria-label^="Peça "]') ||
      document.querySelector('[aria-label^="Dado "]') ||
      document.querySelector('[aria-label^="Carta "]') ||
      document.querySelector("button");
    if (!ancora) return null;
    const chave = Object.keys(ancora).find((k) => k.startsWith("__reactFiber$"));
    if (!chave) return null;
    let f = ancora[chave];
    for (let i = 0; i < 40 && f; i += 1) {
      let hook = f.memoizedState;
      let n = 0;
      while (hook && n < 40) {
        const s = hook.memoizedState;
        if (Array.isArray(s) && s[0] && typeof s[0].getValidMoves === "function") {
          return f;
        }
        hook = hook.next;
        n += 1;
      }
      f = f.return;
    }
    return null;
  },

  /**
   * O fiber pertence a arvore ATUAL do React?
   *
   * Cada fiber tem um gemeo (alternate); so um lado esta na arvore corrente.
   * Subindo ate a raiz, o HostRoot da arvore atual satisfaz
   * stateNode.current === ele mesmo — e o unico criterio exato. Desempatar
   * por "progresso" NAO serve: no domino os dois lados tem o mesmo numero de
   * pecas e o lado velho vencia (a fase ficava presa em "dealing").
   */
  ehAtual(no) {
    let r = no;
    let guarda = 0;
    while (r.return && guarda < 200) { r = r.return; guarda += 1; }
    return Boolean(r.stateNode && r.stateNode.current === r);
  },

  /**
   * Estado e motor do jogo aberto.
   *
   * Le os dois gemeos e fica com o que esta na arvore ATUAL.
   */
  partes() {
    const ancora =
      document.querySelector('[aria-label^="Casa "]') ||
      document.querySelector('[aria-label^="Peça "]') ||
      document.querySelector('[aria-label^="Dado "]') ||
      document.querySelector('[aria-label^="Carta "]') ||
      document.querySelector("button");
    if (!ancora) return null;
    const chave = Object.keys(ancora).find((k) => k.startsWith("__reactFiber$"));
    if (!chave) return null;

    const atuais = [];
    const outros = [];
    let f = ancora[chave];
    for (let i = 0; i < 40 && f; i += 1) {
      for (const no of [f, f.alternate]) {
        if (!no) continue;
        let hook = no.memoizedState;
        let n = 0;
        let motor = null;
        let estado = null;
        while (hook && n < 40) {
          const s = hook.memoizedState;
          if (Array.isArray(s) && s[0] && typeof s[0].getValidMoves === "function") motor = s[0];
          if (s && typeof s === "object" && Array.isArray(s.pieces) && s.players) estado = s;
          hook = hook.next;
          n += 1;
        }
        if (!motor || !estado) continue;
        (this.ehAtual(no) ? atuais : outros).push({ estado, motor });
      }
      f = f.return;
    }
    const lista = atuais.length ? atuais : outros;
    if (!lista.length) return null;

    const progresso = (c) => {
      const h = c.estado.moveHistory;
      if (Array.isArray(h)) return h.length;
      const mesa = Array.isArray(c.estado.pieces) ? c.estado.pieces.length : 0;
      const mao = (c.estado.players && c.estado.players[0] && c.estado.players[0].hand) || [];
      return mesa + mao.length;
    };
    lista.sort((a, b) => progresso(a) - progresso(b));
    return lista[lista.length - 1];
  },
  /** Jogadas legais do jogador da vez. */
  jogadas() {
    const p = this.partes();
    if (!p) return [];
    try {
      return p.motor.getValidMoves(p.estado) || [];
    } catch {
      return [];
    }
  },

  /** Aplica uma jogada pelo MOTOR (mesma função que a UI usa no clique). */
  aplicar(jogada) {
    const p = this.partes();
    if (!p) return false;
    try {
      window.__jogo._aplicar(p.estado, jogada);
      return true;
    } catch {
      return false;
    }
  },

  /** Ganchos internos preenchidos pelo teste (setState do componente). */
  _aplicar: null,
  _setEstado: null,
};
`;

/**
 * Instala, além dos helpers, um "aplicador" que usa o setState REAL do
 * componente — para que o clique e o motor andem juntos.
 */
export const INSTALAR_APLICADOR = `
(() => {
  const f = window.__jogo.fiber();
  if (!f) return "sem fiber";
  // Procura o dispatch do useState do estado (o hook que guarda as pecas).
  let hook = f.memoizedState;
  let n = 0;
  while (hook && n < 40) {
    const s = hook.memoizedState;
    if (s && typeof s === "object" && Array.isArray(s.pieces) && s.queue && s.queue.dispatch) {
      const dispatch = s.queue.dispatch;
      const motor = (() => {
        let h = f.memoizedState, m = 0;
        while (h && m < 40) {
          const v = h.memoizedState;
          if (Array.isArray(v) && v[0] && typeof v[0].getValidMoves === "function") return v[0];
          h = h.next; m += 1;
        }
        return null;
      })();
      if (!motor) return "sem motor";
      window.__jogo._setEstado = dispatch;
      window.__jogo._motor = motor;
      window.__jogo._aplicar = (estado, jogada) => {
        dispatch(motor.applyMove(estado, jogada));
      };
      return "ok";
    }
    hook = hook.next;
    n += 1;
  }
  return "sem dispatch";
})();
`;

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Entra na Cidadela como visitante e escolhe profissão. */
export async function irParaHub(page, base) {
  await page.goto(`${base}/cidadela`, { waitUntil: "networkidle2" });
  await esperar(2500);
  for (let i = 0; i < 10; i += 1) {
    const pronto = await page.evaluate(() =>
      [...document.querySelectorAll("button")].some((b) =>
        (b.getAttribute("aria-label") || "").includes(" — "),
      ),
    );
    if (pronto) return true;
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /Continuar sem conta/i.test(x.textContent || ""),
      );
      if (b) b.click();
    });
    await esperar(900);
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

/** Abre um jogo pelo card e entra na partida (atravessa o painel de campanha). */
export async function abrirJogo(page, label) {
  const achou = await page.evaluate((l) => {
    const card = [...document.querySelectorAll("button")].find((b) =>
      (b.getAttribute("aria-label") || "").startsWith(l + " —"),
    );
    if (!card) return false;
    card.click();
    return true;
  }, label);
  await esperar(2500);
  if (!achou) return false;
  await page.evaluate(() => document.querySelector(".jcamp-jogar")?.click());
  await esperar(2500);
  return true;
}

/** Volta para o painel de campanha a partir da partida. */
export async function voltarAoPainel(page) {
  await page.evaluate(() => {
    const b = document.querySelector('[aria-label="Voltar"]');
    if (b) b.click();
  });
  await esperar(2500);
}

/** Lê o painel de campanha (fase, história, metas, recorde). */
export async function lerPainel(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    return {
      fase: q(".jcamp-fase-chip")?.textContent?.trim() ?? null,
      tituloFase: q(".jcamp-fase-titulo")?.textContent?.trim() ?? null,
      historia: q(".jcamp-historia")?.textContent?.trim() ?? null,
      metas: [...document.querySelectorAll(".jcamp-meta")].map((m) => (m.textContent || "").trim()),
      tiles: [...document.querySelectorAll(".jcamp-tile")].map((t) => (t.textContent || "").trim()),
      rodape: q(".jcamp-rodape")?.textContent?.trim() ?? null,
    };
  });
}

/** Lê a tela de fim de partida. */
export async function lerFim(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    return {
      temFim: Boolean(q(".jfim-wrap")),
      titulo: q(".jfim-titulo")?.textContent?.trim() ?? null,
      fala: q(".jfim-fala")?.textContent?.trim() ?? null,
      premios: [...document.querySelectorAll(".jfim-premio")].map((x) => x.textContent.trim()),
      recorde: q(".jfim-recorde")?.textContent?.trim() ?? null,
    };
  });
}

/**
 * Busca alpha-beta usando o MOTOR real do jogo. O MCTS da IA faz rollouts
 * aleatórios; uma busca material com poda joga melhor que ele nos jogos de
 * tabuleiro — é assim que o bot vence as fases finais (especialista).
 */
export const MINIMAX = `
window.__jogo.melhorJogada = function (profundidade, eu) {
  const p = this.partes();
  if (!p) return null;
  const { estado, motor } = p;
  const avaliar = (e) => {
    if (motor.isGameOver(e)) {
      const w = motor.getWinner(e);
      if (w === eu) return 1000000;
      if (w === null) return 0;
      return -1000000;
    }
    return motor.evaluate(e, eu);
  };
  const busca = (e, prof, alfa, beta) => {
    if (prof === 0 || motor.isGameOver(e)) return avaliar(e);
    const jogadas = motor.getValidMoves(e);
    if (!jogadas.length) return avaliar(e);
    const max = e.currentPlayer === eu;
    let melhor = max ? -Infinity : Infinity;
    for (const j of jogadas) {
      const v = busca(motor.applyMove(e, j), prof - 1, alfa, beta);
      if (max) { if (v > melhor) melhor = v; if (melhor > alfa) alfa = melhor; }
      else { if (v < melhor) melhor = v; if (melhor < beta) beta = melhor; }
      if (beta <= alfa) break;
    }
    return melhor;
  };
  const jogadas = motor.getValidMoves(estado);
  if (!jogadas.length) return null;
  // Ordena por captura primeiro: poda muito mais cedo.
  const valor = (j) => {
    const e2 = motor.applyMove(estado, j);
    return motor.evaluate(e2, eu);
  };
  jogadas.sort((a, b) => valor(b) - valor(a));
  let melhorJ = jogadas[0];
  let melhorV = -Infinity;
  for (const j of jogadas) {
    const v = busca(motor.applyMove(estado, j), profundidade - 1, -Infinity, Infinity);
    if (v > melhorV) { melhorV = v; melhorJ = j; }
  }
  return melhorJ;
};

/** Joga UMA jogada de tabuleiro clicando na UI (para a IA responder). */
window.__jogo.jogarNaUI = function (jogada) {
  const p = this.partes();
  if (!p || !jogada) return false;
  const peca = p.estado.pieces.find((x) => x.id === jogada.data.from);
  if (!peca) return false;
  const origem = '[aria-label="Casa ' + peca.position.x + '-' + peca.position.y + '"]';
  const el = document.querySelector(origem);
  if (!el) return false;
  el.click();
  return jogada.data.to;
};
`;
