/**
 * Prova de que cada mesa universal RENDERIZA e RESPONDE a interação.
 *
 * Renderiza cada view com `react-dom/server` (pega crash de render e markup
 * quebrado) e depois exercita o motor por trás dela (pega jogo que abre mas
 * não aceita jogada).
 *
 * Uso: JITI_TSCONFIG_PATHS=true npx jiti testes/render-jogos.tsx
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChessGameView } from "../src/components/universal/ChessGameView";
import { CheckersGameView } from "../src/components/universal/CheckersGameView";
import { BlackjackGameView } from "../src/components/universal/BlackjackGameView";
import { DominoGameView } from "../src/components/universal/DominoGameView";
import { YahtzeeGameView } from "../src/components/universal/YahtzeeGameView";
import { ConnectFourGameView } from "../src/components/universal/ConnectFourGameView";
import { TicTacToeGameView } from "../src/components/universal/TicTacToeGameView";
import { ReversiGameView } from "../src/components/universal/ReversiGameView";
import { MancalaGameView } from "../src/components/universal/MancalaGameView";
import { UniversalGameFactory } from "../src/lib/universal/UniversalGameFactory";
import type { GameCategory } from "../src/lib/universal/UniversalGameEngine";

let ok = 0;
let fail = 0;
function check(nome: string, cond: boolean, detalhe = "") {
  if (cond) {
    ok++;
    console.log(`  ok   ${nome}`);
  } else {
    fail++;
    console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

const VIEWS: Array<{ nome: string; categoria: GameCategory; view: () => unknown }> = [
  { nome: "Xadrez", categoria: "board_chess", view: () => createElement(ChessGameView, { onBack: () => {} }) },
  { nome: "Damas", categoria: "board_checkers", view: () => createElement(CheckersGameView, { onBack: () => {} }) },
  { nome: "Blackjack", categoria: "card_blackjack", view: () => createElement(BlackjackGameView, { onBack: () => {} }) },
  { nome: "Dominó", categoria: "domino_block", view: () => createElement(DominoGameView, { onBack: () => {} }) },
  { nome: "Yahtzee", categoria: "dice_yahtzee", view: () => createElement(YahtzeeGameView, { onBack: () => {} }) },
  { nome: "Liga 4", categoria: "board_connect_four", view: () => createElement(ConnectFourGameView, { onBack: () => {} }) },
  { nome: "Jogo da Velha", categoria: "board_tic_tac_toe", view: () => createElement(TicTacToeGameView, { onBack: () => {} }) },
  { nome: "Reversi", categoria: "board_reversi", view: () => createElement(ReversiGameView, { onBack: () => {} }) },
  { nome: "Mancala", categoria: "board_mancala", view: () => createElement(MancalaGameView, { onBack: () => {} }) },
];

console.log("RENDER DAS MESAS (SSR)\n");
for (const { nome, categoria, view } of VIEWS) {
  let html = "";
  try {
    html = renderToStaticMarkup(view() as never);
  } catch (error) {
    check(`${nome}: renderiza sem crash`, false, String(error).slice(0, 160));
    continue;
  }

  check(`${nome}: renderiza sem crash`, html.length > 0, `html ${html.length} chars`);
  check(`${nome}: tem título e botão de voltar`, html.includes("Voltar"));
  check(`${nome}: markup não vazio`, html.replace(/<[^>]*>/g, "").trim().length > 20);

  // O motor por trás da view precisa aceitar jogadas de verdade.
  const engine = UniversalGameFactory.createEngine(categoria);
  const state = UniversalGameFactory.createGame(categoria, 2);
  check(`${nome}: motor existe`, engine !== null && state !== null);
  if (engine && state) {
    const moves = engine.getValidMoves(state);
    check(`${nome}: há jogadas legais na abertura`, moves.length > 0, `${moves.length} jogadas`);
    const first = moves[0];
    if (first) {
      const after = engine.applyMove(state, first);
      check(`${nome}: aplicar jogada produz novo estado`, after !== state);
      check(`${nome}: histórico registra a jogada`, (after.moveHistory?.length ?? 0) >= 1);
    }
  }
}

console.log(`\n═══ ${ok} passaram, ${fail} falharam ═══`);
if (fail > 0) process.exit(1);
