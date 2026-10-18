/**
 * Mesa de DOMINÓ.
 *
 * Mostra a mão do jogador, a mesa em corrente e as extremidades abertas.
 * A peça só é jogada se encaixar numa ponta — a UI filtra pela extremidade e
 * indica visualmente onde a peça vai entrar.
 */
import { useCallback, useMemo, useState } from "react";
import { DominoAdapter, type DominoState, type DominoTile } from "@/lib/universal/adapters/DominoAdapter";
import { jogadaComImperfeicao, type AiLevel } from "@/lib/universal/aiUniversal";
import { GameShell, ResultBanner, TablePanel } from "./GameShell";

interface DominoGameViewProps {
  onBack: () => void;
}

/** Desenha uma peça com as duas metades de pontos. */
function Tile({
  tile,
  onClick,
  disabled = false,
  selected = false,
  horizontal = true,
  small = false,
}: {
  tile: DominoTile;
  onClick?: (() => void) | undefined;
  disabled?: boolean | undefined;
  selected?: boolean | undefined;
  horizontal?: boolean | undefined;
  small?: boolean | undefined;
}) {
  const w = small ? "w-9 sm:w-11" : "w-11 sm:w-14";
  const h = small ? "h-[4.5rem] sm:h-20" : "h-[5.5rem] sm:h-24";

  return (
    <button
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`${w} ${h} flex shrink-0 flex-col overflow-hidden rounded-lg border-2 border-slate-300 bg-white shadow-md transition-all ${
        selected ? "ring-2 ring-emerald-400" : ""
      } ${onClick && !disabled ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg active:scale-95" : "cursor-default"} ${
        disabled ? "opacity-40" : ""
      } ${horizontal ? "" : "rotate-90"}`}
      aria-label={`${tile.left}-${tile.right}`}
    >
      <span className="flex flex-1 items-center justify-center border-b-2 border-slate-300 text-base font-black text-slate-900">
        {tile.left}
      </span>
      <span className="flex flex-1 items-center justify-center text-base font-black text-slate-900">
        {tile.right}
      </span>
    </button>
  );
}

export function DominoGameView({ onBack }: DominoGameViewProps) {
  const engine = useMemo(() => new DominoAdapter(), []);
  const [level, setLevel] = useState<AiLevel>("medio");
  const [state, setState] = useState<DominoState>(() => engine.initializeGame("domino_block", 2));
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [restartKey, setRestartKey] = useState(0);

  const cs = state.customState;
  const gameOver = state.gameOver;
  const myHand = cs.hands[0] ?? [];
  const humanTurn = state.currentPlayer === 0 && !gameOver;
  const table = cs.table;

  const legalMoves = useMemo(
    () => (gameOver ? [] : engine.getValidMoves(state)),
    [engine, state, gameOver],
  );

  const canDraw = legalMoves.some((m) => m.type === "draw");
  const canPass = legalMoves.some((m) => m.type === "pass");

  /** Para cada peça da mão, em quais pontas ela encaixa. */
  const playable = useMemo(() => {
    const map = new Map<number, Array<"left" | "right">>();
    for (const move of legalMoves) {
      if (move.type !== "play") continue;
      const index = Number(move.data["tileIndex"]);
      const side = String(move.data["side"]) as "left" | "right";
      const list = map.get(index) ?? [];
      if (!list.includes(side)) list.push(side);
      map.set(index, list);
    }
    return map;
  }, [legalMoves]);

  const restart = useCallback(() => {
    setState(engine.initializeGame("domino_block", 2));
    setSelectedIndex(null);
    setThinking(false);
    setRestartKey((k) => k + 1);
  }, [engine]);

  /** A máquina joga até devolver a vez ao humano. */
  const vezDaMaquina = useCallback(
    (base: DominoState) => {
      setThinking(true);
      window.setTimeout(() => {
        let atual = base;
        let guard = 0;
        // Compra/passa podem devolver a vez ao mesmo jogador: repete até mudar.
        while (!atual.gameOver && atual.currentPlayer === 1 && guard < 30) {
          const decision = jogadaComImperfeicao(engine, atual, 1, level);
          if (!decision.move) break;
          const next = engine.applyMove(atual, decision.move) as DominoState;
          atual = next;
          guard++;
          if (decision.move.type === "play") break;
        }
        setState(atual);
        setThinking(false);
      }, 80);
    },
    [engine, level],
  );

  const jogar = useCallback(
    (move: Parameters<DominoAdapter["applyMove"]>[1]) => {
      const after = engine.applyMove(state, move) as DominoState;
      setState(after);
      setSelectedIndex(null);
      if (!after.gameOver && after.currentPlayer === 1) vezDaMaquina(after);
    },
    [engine, state, vezDaMaquina],
  );

  const handleTileClick = useCallback(
    (index: number) => {
      if (!humanTurn || thinking) return;
      const sides = playable.get(index);
      if (!sides || sides.length === 0) return;

      // Encaixa nas duas pontas: a primeira jogada vai para a direita por padrão.
      const side = sides.includes("right") ? "right" : "left";
      const move = legalMoves.find(
        (m) => m.type === "play" && Number(m.data["tileIndex"]) === index && String(m.data["side"]) === side,
      );
      if (move) jogar(move);
    },
    [humanTurn, thinking, playable, legalMoves, jogar],
  );

  const statusText = gameOver
    ? state.winner === 0
      ? "Você bateu!"
      : state.winner === 1
        ? "A máquina bateu"
        : "Mesa bloqueada"
    : humanTurn
      ? myHand.length === 0
        ? "Você bateu!"
        : canDraw
          ? "Sem jogada — compre uma peça"
          : canPass
            ? "Sem jogada e sem monte — passe a vez"
            : "Sua vez — escolha uma peça que encaixe"
      : "Vez da máquina";

  return (
    <GameShell
      key={restartKey}
      title="Dominó"
      subtitle="Encaixe peças nas pontas — quem bate primeiro vence"
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
            <span>mão: {myHand.length}</span>
            <span>monte: {cs.boneyard.length}</span>
          </span>
        </>
      }
      footer="Peças que não encaixam ficam apagadas. Quando não há jogada, compre do monte."
    >
      <TablePanel className="bg-gradient-to-b from-emerald-900/80 to-emerald-950/90">
        {/* Mesa */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-emerald-200/80">
            <span>Mesa</span>
            {table.length > 0 ? (
              <span className="normal-case">
                pontas: <span className="font-black text-white">{cs.leftEnd}</span>
                {" · "}
                <span className="font-black text-white">{cs.rightEnd}</span>
              </span>
            ) : null}
          </div>

          <div className="flex min-h-[6rem] items-center gap-1 overflow-x-auto rounded-2xl border border-emerald-400/20 bg-emerald-950/40 p-3 sm:min-h-[7rem]">
            {table.length === 0 ? (
              <span className="mx-auto text-xs text-emerald-200/50">
                Mesa vazia — você abre o jogo com qualquer peça
              </span>
            ) : (
              table.map((tile, i) => (
                <Tile key={`t-${i}`} tile={tile} small horizontal={false} />
              ))
            )}
          </div>
        </div>

        {/* Mão do jogador */}
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-200/80">
            Sua mão
          </div>
          <div className="flex flex-wrap gap-2">
            {myHand.length === 0 ? (
              <span className="text-xs text-emerald-200/50">sem peças</span>
            ) : (
              myHand.map((tile, index) => {
                const sides = playable.get(index);
                const jogavel = Boolean(sides && sides.length > 0);
                return (
                  <div key={`h-${index}`} className="relative">
                    <Tile
                      tile={tile}
                      selected={selectedIndex === index}
                      disabled={humanTurn && !jogavel}
                      onClick={humanTurn && !thinking ? () => handleTileClick(index) : undefined}
                    />
                    {humanTurn && jogavel ? (
                      <span className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-1.5 text-[9px] font-black text-white shadow">
                        {sides?.includes("left") && sides?.includes("right")
                          ? "◀▶"
                          : sides?.includes("left")
                            ? "◀"
                            : "▶"}
                      </span>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Ações de compra/passe */}
        {humanTurn && !thinking && (canDraw || canPass) ? (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => {
                const move = legalMoves.find((m) => m.type === "draw" || m.type === "pass");
                if (move) jogar(move);
              }}
              className="rounded-xl border border-amber-400/60 bg-amber-500/15 px-5 py-2.5 text-sm font-bold text-amber-100 transition-all hover:bg-amber-500/25 active:scale-95"
            >
              {canDraw ? "Comprar do monte" : "Passar a vez"}
            </button>
          </div>
        ) : null}

        {gameOver ? (
          <ResultBanner
            winner={state.winner}
            reason={state.reason === "blocked" ? "mesa bloqueada — menor mão vence" : state.reason}
            opponentName="A máquina"
            onRestart={restart}
          />
        ) : null}
      </TablePanel>
    </GameShell>
  );
}
