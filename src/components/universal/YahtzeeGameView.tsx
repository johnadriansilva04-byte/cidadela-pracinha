import { useCallback, useMemo, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { UniversalGameFactory } from "@/lib/universal/UniversalGameFactory";
import type { GameMove, UniversalGameState } from "@/lib/universal/UniversalGameEngine";
import {
  lerCategoriasMarcadas,
  lerDadosYahtzee,
  lerPlacarYahtzee,
  lerRolagensRestantes,
} from "@/lib/universal/estadoTabuleiro";

interface YahtzeeGameViewProps {
  onBack: () => void;
}

const JOGO = "dice_yahtzee";

const ROTULOS: Record<string, string> = {
  ones: "1s",
  twos: "2s",
  threes: "3s",
  fours: "4s",
  fives: "5s",
  sixes: "6s",
  three_of_kind: "Trinca",
  four_of_kind: "Quadra",
  full_house: "Full House",
  small_straight: "Seq. Pequena",
  large_straight: "Seq. Grande",
  yahtzee: "Yahtzee",
  chance: "Chance",
};

const CATEGORIAS = Object.keys(ROTULOS);

function Dado({
  valor,
  mantido,
  onClick,
}: {
  valor: number;
  mantido: boolean;
  onClick?: (() => void) | undefined;
}) {
  const pontos: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={`Dado ${valor}${mantido ? " (mantido)" : ""}`}
      className={[
        "grid h-16 w-16 grid-cols-3 gap-1 rounded-lg border-2 bg-white p-2 shadow-lg",
        mantido ? "border-green-500 bg-green-50" : "border-slate-300",
        onClick ? "cursor-pointer transition-transform hover:scale-105" : "",
      ].join(" ")}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full ${pontos[valor]?.includes(i) ? "bg-slate-900" : "bg-transparent"}`}
        />
      ))}
    </button>
  );
}

export function YahtzeeGameView({ onBack }: YahtzeeGameViewProps) {
  const [gameState, setGameState] = useState<UniversalGameState | null>(() =>
    UniversalGameFactory.createGame(JOGO, 2),
  );
  const [iaPensando, setIaPensando] = useState(false);

  const engine = useMemo(() => UniversalGameFactory.createEngine(JOGO), []);

  // Os dados, as rolagens e o placar vivem em `customState` — não no topo.
  const dados = useMemo(() => lerDadosYahtzee(gameState), [gameState]);
  const rolagensRestantes = useMemo(() => lerRolagensRestantes(gameState), [gameState]);
  const acabou = engine && gameState ? engine.isGameOver(gameState) : false;
  const vencedor = acabou && engine && gameState ? engine.getWinner(gameState) : null;
  const jogadorAtual = gameState?.currentPlayer ?? 0;

  const movimentos = useMemo(
    () => (engine && gameState ? engine.getValidMoves(gameState) : []),
    [engine, gameState],
  );

  /**
   * Dados mantidos. O engine não guarda isso: `keep` é a lista de índices
   * enviada na rolagem. Como o engine preenche os mantidos com o valor
   * anterior, manter no cliente é o suficiente e mantém a rolagem coerente.
   */
  const [mantidos, setMantidos] = useState<number[]>([]);

  const meuPlacar = useMemo(() => lerPlacarYahtzee(gameState, 0), [gameState]);
  const placarIa = useMemo(() => lerPlacarYahtzee(gameState, 1), [gameState]);
  const minhasMarcadas = useMemo(() => lerCategoriasMarcadas(gameState, 0), [gameState]);

  const minhaVez = jogadorAtual === 0 && !acabou;

  const jogarIa = useCallback(
    (estado: UniversalGameState) => {
      if (!engine || engine.isGameOver(estado)) return;
      setIaPensando(true);
      window.setTimeout(() => {
        let atual = estado;
        // A IA joga o turno inteiro: rola até 3 vezes e então marca uma categoria.
        for (let passo = 0; passo < 6; passo += 1) {
          if (engine.isGameOver(atual) || atual.currentPlayer !== 1) break;
          const opcoes = engine.getValidMoves(atual);
          if (opcoes.length === 0) break;
          const rolagem = opcoes.find((m) => m.type === "roll");
          const marcar = opcoes.find((m) => m.type === "custom");
          // Enquanto puder rolar, rola; na fase de pontuação, marca a 1ª livre.
          const escolha: GameMove | undefined = rolagem ?? marcar;
          if (!escolha) break;
          atual = engine.applyMove(atual, escolha);
        }
        setGameState(atual);
        setMantidos([]);
        setIaPensando(false);
      }, 600);
    },
    [engine],
  );

  const aplicar = useCallback(
    (movimento: GameMove) => {
      if (!engine || !gameState) return;
      const novo = engine.applyMove(gameState, movimento);
      setGameState(novo);
      if (novo.currentPlayer !== 0 || novo.phase === "scoring") setMantidos([]);
      if (novo.currentPlayer === 1) jogarIa(novo);
    },
    [engine, gameState, jogarIa],
  );

  const rolar = () => {
    const movimento = movimentos.find((m) => m.type === "roll");
    if (movimento) aplicar({ ...movimento, data: { ...movimento.data, keep: mantidos } });
  };

  const alternarMantido = (indice: number) => {
    if (!minhaVez || rolagensRestantes <= 0) return;
    setMantidos((atual) =>
      atual.includes(indice) ? atual.filter((i) => i !== indice) : [...atual, indice],
    );
  };

  const marcar = (categoria: string) => {
    const movimento = movimentos.find(
      (m) => m.type === "custom" && m.data?.["action"] === "score" && m.data?.["category"] === categoria,
    );
    if (movimento) aplicar(movimento);
  };

  const novaPartida = () => {
    setGameState(UniversalGameFactory.createGame(JOGO, 2));
    setMantidos([]);
  };

  const totalDe = (placar: Record<string, number>) =>
    Object.values(placar).reduce((soma, v) => soma + (v || 0), 0);

  const podeMarcar = (categoria: string) =>
    minhaVez &&
    !iaPensando &&
    movimentos.some(
      (m) => m.type === "custom" && m.data?.["action"] === "score" && m.data?.["category"] === categoria,
    );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4">
      <BackButton onClick={onBack} />
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">Yahtzee</h1>

        <div className="mb-4 rounded-lg bg-slate-800 p-4 text-white">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-300">
              Jogador: <span className="font-bold text-white">{jogadorAtual === 0 ? "Você" : "IA"}</span>
            </p>
            <p className="text-sm text-slate-300">
              Rolagens restantes:{" "}
              <span className="font-bold text-white">{rolagensRestantes}</span>
            </p>
          </div>
          {acabou && (
            <p className="mt-2 text-lg font-bold text-green-400">
              {vencedor === null ? "Empate!" : vencedor === 0 ? "Você venceu!" : "IA venceu!"}
            </p>
          )}
        </div>

        <div className="mb-6 rounded-lg bg-slate-800 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Dados</h3>
          <div className="flex flex-wrap justify-center gap-4">
            {dados.map((valor, indice) => (
              <Dado
                key={indice}
                valor={valor}
                mantido={mantidos.includes(indice)}
                onClick={minhaVez && rolagensRestantes > 0 && !iaPensando ? () => alternarMantido(indice) : undefined}
              />
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">
            Toque num dado para mantê-lo entre as rolagens.
          </p>
          {minhaVez && rolagensRestantes > 0 && (
            <div className="mt-4 text-center">
              <button
                onClick={rolar}
                className="rounded-lg bg-blue-600 px-8 py-3 font-bold text-white transition hover:bg-blue-700"
              >
                Rolar Dados
              </button>
            </div>
          )}
        </div>

        <div className="mb-6 rounded-lg bg-slate-800 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Cartela de Pontuação</h3>
          <div className="space-y-2">
            {CATEGORIAS.map((categoria) => {
              const meu = meuPlacar[categoria];
              const dele = placarIa[categoria];
              const livre = podeMarcar(categoria);
              const jaUsei = minhasMarcadas.includes(categoria);
              return (
                <button
                  key={categoria}
                  type="button"
                  onClick={() => livre && marcar(categoria)}
                  disabled={!livre}
                  className={[
                    "flex w-full items-center justify-between rounded-lg p-3 text-left transition",
                    livre ? "cursor-pointer bg-slate-700 hover:bg-slate-600" : "bg-slate-700/50",
                  ].join(" ")}
                >
                  <span className="font-medium text-white">
                    {ROTULOS[categoria]}
                    {jaUsei && <span className="ml-2 text-xs text-slate-400">(marcado)</span>}
                  </span>
                  <div className="flex gap-4">
                    <span className="text-slate-300">{meu !== undefined ? meu : "-"}</span>
                    <span className="text-slate-500">{dele !== undefined ? dele : "-"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-6 rounded-lg bg-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400">Seu Total</p>
              <p className="text-2xl font-bold text-white">{totalDe(meuPlacar)}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400">Total da IA</p>
              <p className="text-2xl font-bold text-white">{totalDe(placarIa)}</p>
            </div>
          </div>
        </div>

        {acabou && (
          <div className="text-center">
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
