/**
 * Mesa de MANCALA (Kalah).
 *
 * Tabuleiro oval: as casas do jogador embaixo, as da máquina em cima, com os
 * depósitos nas pontas. Mostra quantas sementes cada casa tem (o número é o
 * dado que importa neste jogo) e quais casas são jogáveis.
 */
import { useCallback, useMemo, useState } from "react";
import {
  MancalaAdapter,
  MANCALA_PITS,
  type MancalaMove,
  type MancalaState,
} from "@/lib/universal/adapters/MancalaAdapter";
import { jogadaComImperfeicao, type AiLevel } from "@/lib/universal/aiUniversal";
import { GameShell, ResultBanner, TablePanel } from "./GameShell";

interface MancalaGameViewProps {
  onBack: () => void;
}

export function MancalaGameView({ onBack }: MancalaGameViewProps) {
  const engine = useMemo(() => new MancalaAdapter(), []);
  const [level, setLevel] = useState<AiLevel>("medio");
  const [state, setState] = useState<MancalaState>(() =>
    engine.initializeGame("board_mancala", 2),
  );
  const [thinking, setThinking] = useState(false);
  const [restartKey, setRestartKey] = useState(0);

  const pits = state.customState.pits;
  const gameOver = state.gameOver;
  const humanTurn = state.currentPlayer === 0 && !gameOver;

  const jogaveis = useMemo(() => {
    const set = new Set<number>();
    if (!gameOver && state.currentPlayer === 0) {
      for (const move of engine.getValidMoves(state) as MancalaMove[]) {
        set.add(move.data.pit);
      }
    }
    return set;
  }, [engine, state, gameOver]);

  const restart = useCallback(() => {
    setState(engine.initializeGame("board_mancala", 2));
    setThinking(false);
    setRestartKey((k) => k + 1);
  }, [engine]);

  const jogar = useCallback(
    (pit: number) => {
      const move = (engine.getValidMoves(state) as MancalaMove[]).find(
        (m) => m.data.pit === pit,
      );
      if (!move) return;

      const after = engine.applyMove(state, move) as MancalaState;
      setState(after);
      if (after.gameOver || after.currentPlayer !== 1) return;

      setThinking(true);
      window.setTimeout(() => {
        const decision = jogadaComImperfeicao(engine, after, 1, level);
        if (decision.move) {
          let next = engine.applyMove(after, decision.move) as MancalaState;
          // A máquina pode ter ganho o direito de jogar de novo (caiu na
          // própria kalah): resolve enquanto a vez continuar sendo dela.
          let guard = 0;
          while (!next.gameOver && next.currentPlayer === 1 && guard < 20) {
            const follow = engine.getValidMoves(next) as MancalaMove[];
            if (follow.length === 0) break;
            const d = jogadaComImperfeicao(engine, next, 1, level);
            if (!d.move) break;
            next = engine.applyMove(next, d.move) as MancalaState;
            guard++;
          }
          setState(next);
        }
        setThinking(false);
      }, 60);
    },
    [engine, state, level],
  );

  /** Casa (bolinha) com o número de sementes. */
  const Casa = ({
    indice,
    jogavel,
    rotulo,
  }: {
    indice: number;
    jogavel: boolean;
    rotulo: string;
  }) => (
    <button
      onClick={() => jogavel && jogar(indice)}
      disabled={!jogavel}
      aria-label={`${rotulo}: ${pits[indice] ?? 0} sementes`}
      className={`flex aspect-square min-w-0 flex-col items-center justify-center rounded-full border-2 transition-all ${
        jogavel
          ? "cursor-pointer border-amber-400/70 bg-amber-900/40 hover:border-amber-300 hover:bg-amber-800/50 active:scale-95"
          : "cursor-default border-stone-600/60 bg-stone-800/60"
      }`}
    >
      <span className="text-lg font-black leading-none text-amber-100 sm:text-xl">
        {pits[indice] ?? 0}
      </span>
    </button>
  );

  const statusText = gameOver
    ? state.winner === 0
      ? "Você venceu!"
      : state.winner === 1
        ? "A máquina venceu"
        : "Empate"
    : humanTurn
      ? "Sua vez — escolha uma casa"
      : "Vez da máquina";

  return (
    <GameShell
      key={restartKey}
      title="Mancala"
      subtitle="Você é o lado de baixo — recolha mais sementes no seu depósito"
      onBack={onBack}
      onRestart={restart}
      level={level}
      onLevelChange={setLevel}
      usesMCTS
      thinking={thinking}
      status={
        <>
          <span className="font-semibold">{statusText}</span>
          <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span>Seu depósito: {pits[6] ?? 0}</span>
            <span>Máquina: {pits[13] ?? 0}</span>
          </span>
        </>
      }
      footer="Cair na sua kalah dá jogada extra. Casa vazia sua com sementes do lado oposto captura as duas."
    >
      <TablePanel>
        <div className="mx-auto max-w-[min(96vw,44rem)] rounded-[40%] border-2 border-amber-900/70 bg-gradient-to-b from-amber-950/60 to-stone-900/80 p-3 sm:p-5">
          <div className="flex items-stretch gap-2 sm:gap-4">
            {/* Depósito do jogador 1 (máquina). */}
            <div className="flex w-12 shrink-0 items-center justify-center rounded-full border-2 border-stone-600 bg-stone-800 sm:w-16">
              <div className="text-center">
                <div className="text-lg font-black text-amber-100 sm:text-2xl">{pits[13] ?? 0}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Máq</div>
              </div>
            </div>

            <div className="grid flex-1 grid-rows-2 gap-2 sm:gap-3">
              {/* Fileira de cima: casas da máquina, da direita para a esquerda
                  (o sentido do jogo é anti-horário). */}
              <div className="grid grid-cols-6 gap-1.5 sm:gap-3">
                {Array.from({ length: MANCALA_PITS }, (_, i) => 12 - i).map((indice) => (
                  <Casa key={indice} indice={indice} jogavel={false} rotulo="casa da máquina" />
                ))}
              </div>
              {/* Fileira de baixo: casas do jogador. */}
              <div className="grid grid-cols-6 gap-1.5 sm:gap-3">
                {Array.from({ length: MANCALA_PITS }, (_, i) => i).map((indice) => (
                  <Casa
                    key={indice}
                    indice={indice}
                    jogavel={humanTurn && !thinking && jogaveis.has(indice)}
                    rotulo="sua casa"
                  />
                ))}
              </div>
            </div>

            {/* Depósito do jogador 0 (você). */}
            <div className="flex w-12 shrink-0 items-center justify-center rounded-full border-2 border-amber-500/70 bg-amber-900/40 sm:w-16">
              <div className="text-center">
                <div className="text-lg font-black text-amber-100 sm:text-2xl">{pits[6] ?? 0}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Você</div>
              </div>
            </div>
          </div>
        </div>

        {gameOver ? (
          <ResultBanner
            winner={state.winner}
            reason={state.reason}
            opponentName="A máquina"
            onRestart={restart}
          />
        ) : null}
      </TablePanel>
    </GameShell>
  );
}
