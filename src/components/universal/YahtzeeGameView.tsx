import { useCallback, useMemo, useState } from "react";
import { ArenaJogo } from "@/components/universal/ArenaJogo";
import { UniversalGameFactory } from "@/lib/universal/UniversalGameFactory";
import type { GameMove, UniversalGameState } from "@/lib/universal/UniversalGameEngine";
import {
  lerCategoriasMarcadas,
  lerDadosYahtzee,
  lerPlacarYahtzee,
  lerRolagensRestantes,
} from "@/lib/universal/estadoTabuleiro";
import { useFimDeJogo } from "@/lib/universal/useFimDeJogo";
import type { ResultadoPartida } from "@/lib/universal/campanhaJogos";

interface YahtzeeGameViewProps {
  onBack: () => void;
  /** Força da IA da fase da campanha (ausente = partida avulsa). */
  forca?: { maxIterations: number; timeBudgetMs: number } | undefined;
  /** Avisa a campanha do resultado da partida (uma vez por partida). */
  onFim?: ((resultado: ResultadoPartida) => void) | undefined;
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

export function YahtzeeGameView({ onBack, forca, onFim }: YahtzeeGameViewProps) {
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

  // Reporta o fim à campanha (uma única vez por partida).
  useFimDeJogo(acabou, vencedor, onFim);
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
        //
        // As 3 rolagens são REGRA DO JOGO, não força: o motor só aceita marcar
        // categoria quando `phase === "scoring"`, e a fase só vira "scoring"
        // quando `rollsLeft` chega a 0. A versão anterior limitava a IA fraca a
        // 2 rolagens — ela parava com `rollsLeft = 1` e nunca conseguia marcar,
        // travando a partida para sempre (nenhum dos dois lados terminava o
        // turno). A força decide a QUALIDADE da escolha, não quantas vezes rola:
        //  • fraca: mantém os dados que mais repetem e marca a primeira categoria;
        //  • forte: mantém os dados que servem à categoria de MAIOR pontuação
        //    real (tabela do adapter) e marca essa categoria.
        const jogaBem = forca !== undefined && forca.maxIterations >= 1500;
        const adapter = engine as unknown as {
          calcularPontuacaoCategoria?: (d: number[], c: string) => number;
        };

        for (let passo = 0; passo < 12; passo += 1) {
          if (engine.isGameOver(atual) || atual.currentPlayer !== 1) break;
          const opcoes = engine.getValidMoves(atual);
          if (opcoes.length === 0) break;

          const rolagem = opcoes.find((m) => m.type === "roll");
          const marcar = opcoes.find((m) => m.type === "custom");

          // Sem rolagem disponível = hora de marcar (fase "scoring").
          if (!rolagem) {
            const opcoesMarcar = opcoes.filter((m) => m.type === "custom");
            if (opcoesMarcar.length === 0) break;
            const dados = lerDadosYahtzee(atual);
            // IA fraca: marca a primeira categoria livre (jogo simples).
            // IA forte: marca a categoria de maior pontuação REAL.
            let melhor = marcar ?? opcoesMarcar[0]!;
            if (jogaBem && adapter.calcularPontuacaoCategoria) {
              let melhorPontos = -1;
              for (const m of opcoesMarcar) {
                const categoria = String(
                  (m.data as Record<string, unknown> | undefined)?.["category"] ?? "",
                );
                const pontos = adapter.calcularPontuacaoCategoria(dados, categoria);
                if (pontos > melhorPontos) {
                  melhorPontos = pontos;
                  melhor = m;
                }
              }
            }
            if (!melhor) break;
            atual = engine.applyMove(atual, melhor);
            continue;
          }

          // Ainda pode rolar: mantém os dados que já formam maioria.
          const dados = lerDadosYahtzee(atual);
          const contagem = new Map<number, number>();
          for (const d of dados) contagem.set(d, (contagem.get(d) ?? 0) + 1);
          const maisComum = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
          const manter = dados
            .map((d, i) => (d === maisComum ? i : -1))
            .filter((i) => i >= 0);
          const rolagemComMantidos =
            opcoes.find(
              (m) =>
                m.type === "roll" &&
                Array.isArray((m.data as Record<string, unknown> | undefined)?.["keep"]) &&
                ((m.data as Record<string, unknown>)["keep"] as number[]).length === manter.length,
            ) ?? rolagem;
          atual = engine.applyMove(atual, rolagemComMantidos);
        }
        setGameState(atual);
        setMantidos([]);
        setIaPensando(false);
      }, 600);
    },
    [engine, forca],
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
    <ArenaJogo
      titulo="Yahtzee"
      onBack={onBack}
      turno={acabou ? undefined : jogadorAtual === 0 ? "Você" : "IA"}
      iaPensando={iaPensando}
      status={
        <span className="arena-turno">
          <span className="arena-turno-rot">Rolagens restantes:</span>
          <strong>{rolagensRestantes}</strong>
        </span>
      }
      versus={{ eu: "Você", oponente: "IA" }}
      pontos={{ eu: totalDe(meuPlacar), oponente: totalDe(placarIa) }}
      acabou={acabou}
      resultado={
        acabou ? (vencedor === null ? "empate" : vencedor === 0 ? "vitoria" : "derrota") : null
      }
      mensagemFim={acabou ? (vencedor === null ? "Empate!" : "Cartela fechada!") : null}
      acoes={
        minhaVez && rolagensRestantes > 0 ? (
          <button onClick={rolar} className="arena-btn arena-btn--primario">
            Rolar Dados
          </button>
        ) : null
      }
      onNovoJogo={novaPartida}
    >
      <div className="arena-placa">
        <p className="arena-placa-titulo">Dados</p>
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
      </div>

      <div className="arena-placa">
        <p className="arena-placa-titulo">Cartela de Pontuação · você × IA</p>
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
                  "flex w-full items-center justify-between rounded-lg border border-slate-600/60 p-3 text-left transition",
                  livre ? "cursor-pointer bg-slate-800 hover:bg-slate-700" : "bg-slate-800/50",
                ].join(" ")}
              >
                <span className="font-medium text-white">
                  {ROTULOS[categoria]}
                  {jaUsei && <span className="ml-2 text-xs text-slate-400">(marcado)</span>}
                </span>
                <div className="flex gap-4">
                  <span className="font-bold text-cyan-300">{meu !== undefined ? meu : "-"}</span>
                  <span className="text-slate-500">{dele !== undefined ? dele : "-"}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </ArenaJogo>
  );
}
