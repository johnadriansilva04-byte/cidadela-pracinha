import { useCallback, useMemo, useState } from "react";
import { ArenaJogo } from "@/components/universal/ArenaJogo";
import { UniversalGameFactory } from "@/lib/universal/UniversalGameFactory";
import type { GameMove, GamePiece, UniversalGameState } from "@/lib/universal/UniversalGameEngine";
import { lerMesaDomino, lerPontasDomino } from "@/lib/universal/estadoTabuleiro";
import { MCTS } from "@/lib/ai/MCTS";
import { useFimDeJogo } from "@/lib/universal/useFimDeJogo";
import type { ResultadoPartida } from "@/lib/universal/campanhaJogos";

interface DominoGameViewProps {
  onBack: () => void;
  /** Força da IA da fase da campanha (ausente = partida avulsa). */
  forca?: { maxIterations: number; timeBudgetMs: number } | undefined;
  /** Avisa a campanha do resultado da partida (uma vez por partida). */
  onFim?: ((resultado: ResultadoPartida) => void) | undefined;
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

export function DominoGameView({ onBack, forca, onFim }: DominoGameViewProps) {
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

  // Reporta o fim à campanha (uma única vez por partida).
  useFimDeJogo(acabou, vencedor, onFim);

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
        const mcts = new MCTS(
          engine,
          forca ?? { maxIterations: 2000, timeBudgetMs: 1000 },
        );
        const escolha = mcts.computeMove(estado, 1);
        const jogada = escolha.move ?? opcoes[0] ?? null;
        setGameState(jogada ? engine.applyMove(estado, jogada) : estado);
        setIaPensando(false);
      }, 500);
    },
    [engine, forca],
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
    <ArenaJogo
      titulo="Dominó"
      onBack={onBack}
      turno={acabou ? undefined : minhaVez ? "Você" : "IA"}
      iaPensando={iaPensando}
      status={
        <span className="arena-turno">
          <span className="arena-turno-rot">Pontas:</span>
          <strong>
            {pontas.left === -1 ? "mesa vazia" : `${pontas.left} · ${pontas.right}`}
          </strong>
        </span>
      }
      versus={{ eu: "Você", oponente: "IA" }}
      pontos={{ eu: minhaMao.length, oponente: maoOponente.length }}
      acabou={acabou}
      resultado={
        acabou ? (vencedor === null ? "empate" : vencedor === 0 ? "vitoria" : "derrota") : null
      }
      mensagemFim={acabou ? (vencedor === null ? "Empate!" : "Bateu!") : null}
      acoes={
        precisaDistribuir ? null : (
          <>
            {movimentos.some((m) => m.type === "draw") && (
              <button
                onClick={comprar}
                disabled={!minhaVez || iaPensando}
                className="arena-btn"
              >
                Comprar do monte
              </button>
            )}
            {movimentos.some((m) => m.type === "pass") && (
              <button onClick={passar} disabled={!minhaVez || iaPensando} className="arena-btn">
                Passar a vez
              </button>
            )}
          </>
        )
      }
      onNovoJogo={novaPartida}
    >
      {/* Mesa */}
      <div className="arena-placa">
        <p className="arena-placa-titulo">Mesa</p>
        <div className="flex min-h-24 flex-wrap items-center justify-center gap-2">
          {mesa.length === 0 && (
            <p className="text-sm text-slate-400">Nenhuma peça na mesa ainda.</p>
          )}
          {mesa.map((peca) => (
            <Peca key={peca.id} peca={peca} />
          ))}
        </div>
      </div>

      {/* Sua mão */}
      <div className="arena-placa">
        <p className="arena-placa-titulo">
          Sua mão ({minhaMao.length} peças) · IA com {maoOponente.length} (
          {pontosDaMao(maoOponente)} pts)
        </p>

        {precisaDistribuir ? (
          <button onClick={distribuir} className="arena-btn arena-btn--primario">
            Distribuir as peças e começar
          </button>
        ) : (
          <>
            <div className="flex flex-wrap justify-center gap-3">
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
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button onClick={() => jogarNaPonta("left")} className="arena-btn">
                  Jogar na ponta esquerda
                </button>
                <button onClick={() => jogarNaPonta("right")} className="arena-btn">
                  Jogar na ponta direita
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </ArenaJogo>
  );
}
