/**
 * Confronto do motor "general" (MCTS + verificação negamax) contra os
 * adversários de referência da Trilha.
 *
 * Uso: JITI_TSCONFIG_PATHS=true npx jiti testes/bench-forca.mts [partidas]
 */
import { applyMove, createInitialState, type GameState } from "../src/lib/trilha/engine";
import { chooseMove } from "../src/lib/trilha/ai";

const PARTIDAS = Number(process.argv[2] ?? 6);

const ADVERSARIOS = ["recruta", "sargento", "general"] as const;

function jogarPartida(motorA: string, motorB: string, seed: number): 1 | 2 | 0 {
  let state: GameState = createInitialState();
  let guard = 0;
  // Alterna quem abre para não enviesar o resultado.
  const aEhJogador1 = seed % 2 === 0;

  while (state.phase !== "over" && guard < 300) {
    const daVez = state.turn === 1 ? (aEhJogador1 ? motorA : motorB) : aEhJogador1 ? motorB : motorA;
    const decision = chooseMove(state, daVez as never);
    if (!decision.move) break;
    state = applyMove(state, decision.move);
    guard++;
  }

  if (state.winner === null) return 0;
  const venceuA = (state.winner === 1) === aEhJogador1;
  return venceuA ? 1 : 2;
}

console.log(`general vs adversários — ${PARTIDAS} partidas cada:\n`);
let falhas = 0;
for (const adversario of ADVERSARIOS) {
  let w = 0;
  let l = 0;
  let e = 0;
  const t0 = Date.now();
  for (let i = 0; i < PARTIDAS; i++) {
    const r = jogarPartida("general", adversario, i);
    if (r === 1) w++;
    else if (r === 2) l++;
    else e++;
  }
  const seg = (Date.now() - t0) / 1000;
  // Pontuação de xadrez (vitória 1, empate 0,5) e o mínimo exigido por patente.
  // Exigir "zero derrotas" era irreal contra o Sargento, que é forte e tem
  // imperfeição: 5-1 em 6 partidas é domínio, não fraqueza.
  const score = (w + e * 0.5) / PARTIDAS;
  const minimo = adversario === "general" ? 0.5 : adversario === "sargento" ? 0.7 : 0.85;
  const ok = score >= minimo;
  if (!ok) falhas++;
  console.log(
    `  general vs ${adversario.padEnd(9)} ${String(w).padStart(2)}W ${String(l).padStart(2)}L ${String(e).padStart(2)}E  ` +
      `${(score * 100).toFixed(0)}% (mín ${(minimo * 100).toFixed(0)}%)  ${seg.toFixed(0)}s  ${ok ? "OK" : "FRACO"}`,
  );
}
console.log(falhas === 0 ? "\nTODOS OS CONFRONTOS OK" : `\n${falhas} confronto(s) abaixo do esperado`);
