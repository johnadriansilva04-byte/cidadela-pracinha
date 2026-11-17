import { useCallback, useMemo, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { UniversalGameFactory } from "@/lib/universal/UniversalGameFactory";
import type { UniversalGameState } from "@/lib/universal/UniversalGameEngine";
import {
  acharJogada,
  chaveDaCasa,
  destinosDaCasa,
  lerTabuleiro,
} from "@/lib/universal/estadoTabuleiro";
import { MCTS } from "@/lib/ai/MCTS";

interface CheckersGameViewProps {
  onBack: () => void;
}

const JOGO = "board_checkers";

export function CheckersGameView({ onBack }: CheckersGameViewProps) {
  const [gameState, setGameState] = useState<UniversalGameState | null>(() =>
    UniversalGameFactory.createGame(JOGO, 2),
  );
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [iaPensando, setIaPensando] = useState(false);

  const engine = useMemo(() => UniversalGameFactory.createEngine(JOGO), []);

  // As peças vivem em `state.pieces` — as casas do engine ficam sem conteúdo.
  const tabuleiro = useMemo(() => lerTabuleiro(gameState), [gameState]);
  const movimentos = useMemo(
    () => (engine && gameState ? engine.getValidMoves(gameState) : []),
    [engine, gameState],
  );
  const acabou = engine && gameState ? engine.isGameOver(gameState) : false;
  const vencedor = acabou && engine && gameState ? engine.getWinner(gameState) : null;

  // Origem = id da peça; destino = "x-y".
  const destinos = useMemo(
    () => destinosDaCasa(movimentos, selecionada ?? undefined),
    [movimentos, selecionada],
  );

  const jogarIa = useCallback(
    (estado: UniversalGameState) => {
      if (!engine || engine.isGameOver(estado)) return;
      setIaPensando(true);
      window.setTimeout(() => {
        const mcts = new MCTS(engine, { maxIterations: 3000, timeBudgetMs: 1500 });
        const escolha = mcts.computeMove(estado, 1);
        setGameState(escolha.move ? engine.applyMove(estado, escolha.move) : estado);
        setIaPensando(false);
      }, 300);
    },
    [engine],
  );

  const clicar = (x: number, y: number) => {
    if (acabou || iaPensando || !engine || !gameState) return;
    const peca = tabuleiro[y]?.[x]?.piece ?? null;

    if (selecionada) {
      const jogada = acharJogada(movimentos, selecionada, chaveDaCasa(x, y));
      if (jogada) {
        const novo = engine.applyMove(gameState, jogada);
        setGameState(novo);
        setSelecionada(null);
        jogarIa(novo);
        return;
      }
    }

    const minha = peca != null && peca.owner === gameState.currentPlayer;
    setSelecionada(minha ? peca.id : null);
  };

  const novaPartida = () => {
    setGameState(UniversalGameFactory.createGame(JOGO, 2));
    setSelecionada(null);
  };

  const casaClara = (x: number, y: number) => (x + y) % 2 === 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4">
      <BackButton onClick={onBack} />
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">Dama</h1>

        <div className="mb-4 rounded-lg bg-slate-800 p-4 text-white">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-300">
              Turno:{" "}
              <span className="font-bold text-white">
                {gameState?.currentPlayer === 0 ? "Vermelho" : "Preto"}
              </span>
            </p>
            {iaPensando && <p className="text-sm text-yellow-400">IA pensando...</p>}
          </div>
          {acabou && (
            <p className="mt-2 text-lg font-bold text-green-400">
              {vencedor === null
                ? "Empate!"
                : vencedor === 0
                  ? "Vermelho venceu!"
                  : "Preto venceu!"}
            </p>
          )}
        </div>

        <div className="mx-auto max-w-md">
          <div className="grid aspect-square grid-cols-8 overflow-hidden rounded-lg shadow-2xl">
            {tabuleiro.map((linha, y) =>
              linha.map((casa, x) => {
                const peca = casa.piece;
                const chave = chaveDaCasa(x, y);
                const selecionadaAqui = peca != null && selecionada === peca.id;
                const alvo = destinos.has(chave);
                const dama = peca?.data?.["isKing"] === true;
                return (
                  <button
                    key={chave}
                    onClick={() => clicar(x, y)}
                    disabled={acabou || iaPensando}
                    aria-label={`Casa ${chave}`}
                    className={[
                      "flex aspect-square items-center justify-center transition-all duration-150",
                      casaClara(x, y) ? "bg-amber-100" : "bg-amber-700",
                      selecionadaAqui ? "bg-blue-400!" : "",
                      alvo ? "bg-green-400!" : "",
                      !acabou && !iaPensando ? "hover:opacity-80" : "cursor-not-allowed",
                    ].join(" ")}
                  >
                    {peca && (
                      <div
                        className={[
                          "flex h-10 w-10 items-center justify-center rounded-full border-4 shadow-lg",
                          peca.owner === 0
                            ? "border-red-300 bg-red-600"
                            : "border-slate-700 bg-slate-900",
                        ].join(" ")}
                      >
                        {dama && (
                          <span className="text-2xl font-bold text-amber-400" aria-hidden>
                            ♛
                          </span>
                        )}
                      </div>
                    )}
                    {alvo && !peca && (
                      <div className="h-3 w-3 rounded-full bg-green-500 opacity-60" />
                    )}
                  </button>
                );
              }),
            )}
          </div>
        </div>

        {acabou && (
          <div className="mt-6 text-center">
            <button
              onClick={novaPartida}
              className="rounded-lg bg-green-600 px-8 py-3 font-bold text-white transition hover:bg-green-700"
            >
              Novo Jogo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
