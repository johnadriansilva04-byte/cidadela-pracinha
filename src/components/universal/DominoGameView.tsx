import { useCallback, useMemo, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { UniversalGameFactory } from "@/lib/universal/UniversalGameFactory";
import type { GameMove, GamePiece, UniversalGameState } from "@/lib/universal/UniversalGameEngine";
import { lerMesaDomino, lerPontasDomino } from "@/lib/universal/estadoTabuleiro";
import { MCTS } from "@/lib/ai/MCTS";

interface DominoGameViewProps {
  onBack: () => void;
}

/** Id registrado no factory. O antigo `tile_domino` não existe. */
const JOGO = "domino_block";

function Peca({ peca, onClick, clicavel = false }: { peca: GamePiece; onClick?: () => void; clicavel?: boolean }) {
  const esquerda = Number(peca.data?.["left"] ?? 0);
  const direita = Number(peca.data?.["right"] ?? 0);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clicavel}
      aria-label={`Peça ${esquerda}-${direita}`}
      className={[
        "flex h-20 w-10 flex-col items-center justify-center gap-1 rounded border-2 border-slate-300 bg-white shadow-lg",
        clicavel ? "cursor-pointer transition-transform hover:scale-105" : "",
      ].join(" ")}
    >
      <Pontos n={esquerda} />
      <div className="h-px w-6 bg-slate-300" />
      <Pontos n={direita} />
    </button>
  );
}

function Pontos({ n }: { n: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      {Array.from({ length: Math.max(0, Math.min(n, 6)) }).map((_, i) => (
        <div key={i} className="h-1.5 w-1.5 rounded-full bg-slate-900" />
      ))}
    </div>
  );
}

export function DominoGameView({ onBack }: DominoGameViewProps) {
  const [gameState, setGameState] = useState<UniversalGameState | null>(() =>
    UniversalGameFactory.createGame(JOGO, 2),
  );
  const [selecionada, setSelecionada] = useState<number | null>(null);
  const [iaPensando, setIaPensando] = useState(false);

  const engine = useMemo(() => UniversalGameFactory.createEngine(JOGO), []);

  const movimentos = useMemo(
    () => (engine && gameState ? engine.getValidMoves(gameState) : []),
    [engine, gameState],
  );
  const acabou = engine && gameState ? engine.isGameOver(gameState) : false;
  const vencedor = acabou && engine && gameState ? engine.getWinner(gameState) : null;

  // Mãos e pontas vivem no estado real, não em `hands`/`board` do topo.
  const minhaMao = gameState?.players?.[0]?.hand ?? [];
  const maoOponente = gameState?.players?.[1]?.hand ?? [];
  const mesa = useMemo(() => lerMesaDomino(gameState), [gameState]);
  const pontas = useMemo(() => lerPontasDomino(gameState), [gameState]);

  /**
   * Na PRIMEIRA jogada o engine está em `phase: "dealing"` com as mãos vazias:
   * é a própria jogada que distribui as peças. Por isso, quando ainda não há
   * mão, a tela pede a distribuição em vez de travar sem jogadas.
   */
  const precisaDistribuir = gameState?.phase === "dealing";
  const minhaVez = gameState?.currentPlayer === 0;

  const jogarIa = useCallback(
    (estado: UniversalGameState) => {
      if (!engine || engine.isGameOver(estado)) return;
      setIaPensando(true);
      window.setTimeout(() => {
        const opcoes = engine.getValidMoves(estado);
        if (opcoes.length === 0) {
          setIaPensando(false);
          return;
        }
        const mcts = new MCTS(engine, { maxIterations: 2000, timeBudgetMs: 1000 });
        const escolha = mcts.computeMove(estado, 1);
        const jogada = escolha.move ?? opcoes[0] ?? null;
        setGameState(jogada ? engine.applyMove(estado, jogada) : estado);
        setIaPensando(false);
      }, 500);
    },
    [engine],
  );

  /** Aplica um movimento e devolve a vez à IA. */
  const aplicar = useCallback(
    (movimento: (typeof movimentos)[number]) => {
      if (!engine || !gameState) return;
      const novo = engine.applyMove(gameState, movimento);
      setGameState(novo);
      setSelecionada(null);
      jogarIa(novo);
    },
    [engine, gameState, jogarIa],
  );

  const distribuir = () => {
    if (!engine || !gameState) return;
    // Qualquer jogada em `dealing` dispara a distribuição das mãos.
    const novo = engine.applyMove(gameState, {
      playerId: 0,
      type: "pass",
      timestamp: Date.now(),
      data: {},
    } satisfies GameMove);
    setGameState(novo);
    setSelecionada(null);
  };

  const jogarNaPonta = (ponta: "left" | "right") => {
    if (selecionada === null || !minhaVez || iaPensando) return;
    const peca = minhaMao[selecionada];
    if (!peca) return;
    const jogada = movimentos.find(
      (m) => m.data?.["pieceId"] === peca.id && m.data?.["side"] === ponta,
    );
    if (jogada) aplicar(jogada);
  };

  const passar = () => {
    const jogada = movimentos.find((m) => m.type === "pass");
    if (jogada) aplicar(jogada);
  };

  const comprar = () => {
    const jogada = movimentos.find((m) => m.type === "draw");
    if (jogada) aplicar(jogada);
  };

  const novaPartida = () => {
    setGameState(UniversalGameFactory.createGame(JOGO, 2));
    setSelecionada(null);
  };

  const pontosDaMao = (mao: GamePiece[]) =>
    mao.reduce((soma, p) => soma + Number(p.data?.["left"] ?? 0) + Number(p.data?.["right"] ?? 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4">
      <BackButton onClick={onBack} />
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">Dominó</h1>

        <div className="mb-4 rounded-lg bg-slate-800 p-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-300">
              Turno:{" "}
              <span className="font-bold text-white">{minhaVez ? "Você" : "IA"}</span>
            </p>
            <p className="text-sm text-slate-300">
              Pontas:{" "}
              <span className="font-bold text-white">
                {pontas.left === -1 ? "mesa vazia" : `${pontas.left} · ${pontas.right}`}
              </span>
            </p>
            {iaPensando && <p className="text-sm text-yellow-400">IA pensando...</p>}
          </div>
          {acabou && (
            <p className="mt-2 text-lg font-bold text-green-400">
              {vencedor === null ? "Empate!" : vencedor === 0 ? "Você venceu!" : "IA venceu!"}
            </p>
          )}
        </div>

        {/* Mesa */}
        <div className="mb-6 rounded-lg bg-slate-800 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-300">Mesa</h3>
          <div className="flex min-h-24 flex-wrap items-center gap-2">
            {mesa.length === 0 && (
              <p className="text-sm text-slate-400">Nenhuma peça na mesa ainda.</p>
            )}
            {mesa.map((peca) => (
              <Peca key={peca.id} peca={peca} />
            ))}
          </div>
        </div>

        {/* Mão do oponente (só a contagem) */}
        <div className="mb-4 rounded-lg bg-slate-800 p-3 text-sm text-slate-300">
          IA: <span className="font-bold text-white">{maoOponente.length}</span> peças
          {" · "}
          {pontosDaMao(maoOponente)} pontos na mão
        </div>

        {/* Sua mão */}
        <div className="rounded-lg bg-slate-800 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-300">
            Sua mão ({minhaMao.length} peças)
          </h3>

          {precisaDistribuir ? (
            <button
              onClick={distribuir}
              className="rounded-lg bg-emerald-600 px-6 py-3 font-bold text-white transition hover:bg-emerald-700"
            >
              Distribuir as peças e começar
            </button>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                {minhaMao.map((peca, indice) => (
                  <div
                    key={peca.id}
                    className={indice === selecionada ? "rounded ring-4 ring-emerald-400" : ""}
                  >
                    <Peca
                      peca={peca}
                      clicavel={minhaVez && !iaPensando && !acabou}
                      onClick={() => setSelecionada(indice === selecionada ? null : indice)}
                    />
                  </div>
                ))}
              </div>

              {selecionada !== null && minhaVez && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => jogarNaPonta("left")}
                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-700"
                  >
                    Jogar na ponta esquerda
                  </button>
                  <button
                    onClick={() => jogarNaPonta("right")}
                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-700"
                  >
                    Jogar na ponta direita
                  </button>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {movimentos.some((m) => m.type === "draw") && (
                  <button
                    onClick={comprar}
                    disabled={!minhaVez || iaPensando}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-700 disabled:opacity-50"
                  >
                    Comprar do monte
                  </button>
                )}
                {movimentos.some((m) => m.type === "pass") && (
                  <button
                    onClick={passar}
                    disabled={!minhaVez || iaPensando}
                    className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-50"
                  >
                    Passar a vez
                  </button>
                )}
              </div>
            </>
          )}
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
