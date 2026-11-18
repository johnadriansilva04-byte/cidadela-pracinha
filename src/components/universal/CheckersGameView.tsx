import { useCallback, useMemo, useState } from "react";
import { ArenaJogo } from "@/components/universal/ArenaJogo";
import { UniversalGameFactory } from "@/lib/universal/UniversalGameFactory";
import type { UniversalGameState } from "@/lib/universal/UniversalGameEngine";
import {
  acharJogada,
  chaveDaCasa,
  destinosDaCasa,
  lerTabuleiro,
} from "@/lib/universal/estadoTabuleiro";
import { MCTS } from "@/lib/ai/MCTS";
import { useFimDeJogo } from "@/lib/universal/useFimDeJogo";
import type { ResultadoPartida } from "@/lib/universal/campanhaJogos";

interface CheckersGameViewProps {
  onBack: () => void;
  /** Força da IA da fase da campanha (ausente = partida avulsa). */
  forca?: { maxIterations: number; timeBudgetMs: number } | undefined;
  /** Avisa a campanha do resultado da partida (uma vez por partida). */
  onFim?: ((resultado: ResultadoPartida) => void) | undefined;
}

const JOGO = "board_checkers";

export function CheckersGameView({ onBack, forca, onFim }: CheckersGameViewProps) {
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

  // Reporta o fim à campanha (uma única vez por partida).
  useFimDeJogo(acabou, vencedor, onFim);

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
        const mcts = new MCTS(
          engine,
          forca ?? { maxIterations: 3000, timeBudgetMs: 1500 },
        );
        const escolha = mcts.computeMove(estado, 1);
        setGameState(escolha.move ? engine.applyMove(estado, escolha.move) : estado);
        setIaPensando(false);
      }, 300);
    },
    [engine, forca],
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
    <ArenaJogo
      titulo="Dama"
      onBack={onBack}
      turno={acabou ? undefined : gameState?.currentPlayer === 0 ? "Vermelho" : "Preto"}
      iaPensando={iaPensando}
      acabou={acabou}
      resultado={
        acabou ? (vencedor === null ? "empate" : vencedor === 0 ? "vitoria" : "derrota") : null
      }
      mensagemFim={acabou ? (vencedor === null ? "Empate!" : "Dama capturada!") : null}
      versus={{ eu: "Vermelho", oponente: "Preto" }}
      onNovoJogo={novaPartida}
    >
      <div className="mx-auto w-full max-w-md">
        <div className="grid aspect-square grid-cols-8 overflow-hidden rounded-xl ring-2 ring-amber-500/30 shadow-2xl">
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
                    selecionadaAqui ? "bg-cyan-400! shadow-[0_0_18px_rgba(34,211,238,0.8)]" : "",
                    // bg-green-400 é o contrato que o E2E usa para achar os
                    // destinos destacados (não trocar por emerald).
                    alvo ? "bg-green-400! shadow-[0_0_18px_rgba(52,211,153,0.75)]" : "",
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
                    <div className="h-3 w-3 rounded-full bg-emerald-600 opacity-70" />
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </ArenaJogo>
  );
}
