import { useCallback, useMemo, useState } from "react";
import { ArenaJogo } from "@/components/universal/ArenaJogo";
import { UniversalGameFactory } from "@/lib/universal/UniversalGameFactory";
import type { GameMove, UniversalGameState } from "@/lib/universal/UniversalGameEngine";
import {
  acharJogada,
  chaveDaCasa,
  destinosDaCasa,
  lerTabuleiro,
} from "@/lib/universal/estadoTabuleiro";
import { MCTS } from "@/lib/ai/MCTS";
import { useFimDeJogo } from "@/lib/universal/useFimDeJogo";
import type { ResultadoPartida } from "@/lib/universal/campanhaJogos";

interface ChessGameViewProps {
  onBack: () => void;
  /** Força da IA da fase da campanha (ausente = partida avulsa). */
  forca?: { maxIterations: number; timeBudgetMs: number } | undefined;
  /** Avisa a campanha do resultado da partida (uma vez por partida). */
  onFim?: ((resultado: ResultadoPartida) => void) | undefined;
}

/** Símbolo por dono + tipo de peça (a peça traz `data.pieceType`). */
const SIMBOLOS: Record<string, string> = {
  "0-king": "♔",
  "0-queen": "♕",
  "0-rook": "♖",
  "0-bishop": "♗",
  "0-knight": "♘",
  "0-pawn": "♙",
  "1-king": "♚",
  "1-queen": "♛",
  "1-rook": "♜",
  "1-bishop": "♝",
  "1-knight": "♞",
  "1-pawn": "♟",
};

export function ChessGameView({ onBack, forca, onFim }: ChessGameViewProps) {
  const [gameState, setGameState] = useState<UniversalGameState | null>(() =>
    UniversalGameFactory.createGame("board_chess", 2),
  );
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [iaPensando, setIaPensando] = useState(false);

  const engine = useMemo(() => UniversalGameFactory.createEngine("board_chess"), []);

  // As peças vivem em `state.pieces` — as casas do engine ficam sem conteúdo.
  const tabuleiro = useMemo(() => lerTabuleiro(gameState), [gameState]);
  const movimentos = useMemo(
    () => (engine && gameState ? engine.getValidMoves(gameState) : []),
    [engine, gameState],
  );
  const acabou = engine && gameState ? engine.isGameOver(gameState) : false;
  const vencedor = acabou && engine && gameState ? engine.getWinner(gameState) : null;

  // Origem das jogadas é o ID DA PEÇA; o destino é "x-y".
  const destinos = useMemo(
    () => destinosDaCasa(movimentos, selecionada ?? undefined),
    [movimentos, selecionada],
  );

  /** Depois da jogada do humano, a IA responde na mesma partida. */
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
    setGameState(UniversalGameFactory.createGame("board_chess", 2));
    setSelecionada(null);
  };

  // Reporta o fim à campanha (uma única vez).
  useFimDeJogo(acabou, vencedor, onFim);

  const casaClara = (x: number, y: number) => (x + y) % 2 === 0;

  return (
    <ArenaJogo
      titulo="Xadrez"
      onBack={onBack}
      turno={acabou ? undefined : gameState?.currentPlayer === 0 ? "Brancas" : "Pretas"}
      iaPensando={iaPensando}
      acabou={acabou}
      resultado={
        acabou ? (vencedor === null ? "empate" : vencedor === 0 ? "vitoria" : "derrota") : null
      }
      mensagemFim={acabou ? (vencedor === null ? "Empate!" : "Xeque-mate!") : null}
      versus={{ eu: "Brancas", oponente: "Pretas" }}
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
              return (
                <button
                  key={chave}
                  onClick={() => clicar(x, y)}
                  disabled={acabou || iaPensando}
                  aria-label={`Casa ${chave}`}
                  className={[
                    "flex aspect-square items-center justify-center text-4xl transition-all duration-150 md:text-5xl",
                    casaClara(x, y) ? "bg-amber-100" : "bg-amber-700",
                    selecionadaAqui ? "bg-cyan-400! shadow-[0_0_18px_rgba(34,211,238,0.8)]" : "",
                    alvo ? "bg-emerald-400! shadow-[0_0_18px_rgba(52,211,153,0.75)]" : "",
                    !acabou && !iaPensando ? "hover:opacity-80" : "cursor-not-allowed",
                  ].join(" ")}
                >
                  {peca && (
                    <span
                      className={
                        peca.owner === 0
                          ? "text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
                          : "text-black"
                      }
                    >
                      {SIMBOLOS[`${peca.owner}-${String(peca.data?.["pieceType"] ?? "")}`] ?? "?"}
                    </span>
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
