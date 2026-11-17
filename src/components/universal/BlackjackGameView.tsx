import { useCallback, useMemo, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { UniversalGameFactory } from "@/lib/universal/UniversalGameFactory";
import type { GameMove, UniversalGameState } from "@/lib/universal/UniversalGameEngine";
import {
  cartaVermelha,
  lerMao,
  lerMaoDealer,
  simboloDaCarta,
  valorDaMao,
} from "@/lib/universal/estadoTabuleiro";

interface BlackjackGameViewProps {
  onBack: () => void;
}

const JOGO = "card_blackjack";

/**
 * UM jogador: contra o dealer. Com dois assentos o adversário virtual nunca
 * aposta e a partida ficaria presa na fase de apostas (o engine não faz a IA
 * apostar) — por isso o duelo aqui é contra a casa.
 */
const JOGADORES = 1;

function Carta({ texto, vermelha }: { texto: string; vermelha: boolean }) {
  return (
    <div
      className={[
        "flex h-24 w-16 flex-col items-center justify-center rounded-lg border-2 border-slate-300 bg-white shadow-lg",
        vermelha ? "text-red-600" : "text-slate-900",
      ].join(" ")}
    >
      <span className="text-2xl font-bold">{texto}</span>
    </div>
  );
}

export function BlackjackGameView({ onBack }: BlackjackGameViewProps) {
  const [gameState, setGameState] = useState<UniversalGameState | null>(() =>
    UniversalGameFactory.createGame(JOGO, JOGADORES),
  );

  const engine = useMemo(() => UniversalGameFactory.createEngine(JOGO), []);

  const movimentos = useMemo(
    () => (engine && gameState ? engine.getValidMoves(gameState) : []),
    [engine, gameState],
  );
  const acabou = engine && gameState ? engine.isGameOver(gameState) : false;
  const fase = gameState?.phase ?? "betting";

  // Mãos: do jogador em `players[].hand`; do dealer em `customState.dealerHand`.
  const minhaMao = useMemo(() => lerMao(gameState, 0), [gameState]);
  const maoDealer = useMemo(() => lerMaoDealer(gameState), [gameState]);
  const meuValor = useMemo(() => valorDaMao(minhaMao), [minhaMao]);
  const valorDealer = useMemo(() => valorDaMao(maoDealer), [maoDealer]);

  const recursos = (gameState?.resources?.[0] ?? {}) as { chips?: number; currentBet?: number };
  const fichas = recursos.chips ?? 1000;
  const aposta = recursos.currentBet ?? 0;
  const resultado = gameState?.scores?.[0];

  const aplicar = useCallback(
    (movimento: GameMove) => {
      if (!engine || !gameState) return;
      setGameState(engine.applyMove(gameState, movimento));
    },
    [engine, gameState],
  );

  const apostar = (valor: number) => {
    const movimento = movimentos.find(
      (m) => m.type === "bet" && Number(m.data?.["amount"]) === valor,
    );
    if (movimento) aplicar(movimento);
  };

  const pedirCarta = () => {
    const movimento = movimentos.find((m) => m.type === "draw");
    if (movimento) aplicar(movimento);
  };

  const parar = () => {
    const movimento = movimentos.find((m) => m.type === "pass");
    if (movimento) aplicar(movimento);
  };

  const novaPartida = () => {
    setGameState(UniversalGameFactory.createGame(JOGO, JOGADORES));
  };

  const apostas = movimentos
    .filter((m) => m.type === "bet")
    .map((m) => Number(m.data?.["amount"] ?? 0));

  const mensagemFinal =
    resultado === undefined
      ? null
      : resultado > 0
        ? "Você venceu!"
        : resultado < 0
          ? "A casa venceu."
          : "Empate — aposta devolvida.";

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-slate-900 p-4">
      <BackButton onClick={onBack} />
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">Blackjack</h1>

        <div className="mb-4 rounded-lg bg-slate-800 p-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-300">
              Fichas: <span className="font-bold text-white">{fichas}</span>
            </p>
            <p className="text-sm text-slate-300">
              Aposta: <span className="font-bold text-white">{aposta || "—"}</span>
            </p>
            <p className="text-sm text-slate-300">
              Fase: <span className="font-bold text-white">{fase === "betting" ? "Apostas" : "Jogo"}</span>
            </p>
          </div>
          {acabou && mensagemFinal && (
            <p className="mt-2 text-lg font-bold text-green-400">{mensagemFinal}</p>
          )}
        </div>

        {/* Dealer */}
        <div className="mb-6 rounded-lg bg-slate-800 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">Banca</h3>
            {maoDealer.length > 0 && (
              <span className="text-sm text-slate-300">
                Total: <span className="font-bold text-white">{valorDealer}</span>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {maoDealer.length === 0 && <p className="text-sm text-slate-400">Aguardando as apostas.</p>}
            {maoDealer.map((carta, i) => (
              // A segunda carta da banca só aparece depois que a mão fecha.
              <Carta
                key={carta.id}
                texto={!acabou && i === 1 ? "?" : simboloDaCarta(carta)}
                vermelha={!acabou && i === 1 ? false : cartaVermelha(carta)}
              />
            ))}
          </div>
        </div>

        {/* Jogador */}
        <div className="mb-6 rounded-lg bg-slate-800 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">Sua mão</h3>
            {minhaMao.length > 0 && (
              <span className="text-sm text-slate-300">
                Total:{" "}
                <span className={meuValor > 21 ? "font-bold text-red-400" : "font-bold text-white"}>
                  {meuValor}
                  {meuValor > 21 ? " (estourou)" : ""}
                </span>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {minhaMao.length === 0 && <p className="text-sm text-slate-400">Nenhuma carta ainda.</p>}
            {minhaMao.map((carta) => (
              <Carta key={carta.id} texto={simboloDaCarta(carta)} vermelha={cartaVermelha(carta)} />
            ))}
          </div>
        </div>

        {/* Ações */}
        {fase === "betting" && !acabou && (
          <div className="rounded-lg bg-slate-800 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-300">Escolha a aposta</h3>
            <div className="flex flex-wrap gap-3">
              {apostas.map((valor) => (
                <button
                  key={valor}
                  onClick={() => apostar(valor)}
                  className="rounded-lg bg-amber-600 px-6 py-3 font-bold text-white transition hover:bg-amber-700"
                >
                  {valor}
                </button>
              ))}
            </div>
          </div>
        )}

        {fase === "playing" && !acabou && (
          <div className="flex flex-wrap gap-3 rounded-lg bg-slate-800 p-4">
            <button
              onClick={pedirCarta}
              disabled={meuValor >= 21}
              className="rounded-lg bg-emerald-600 px-6 py-3 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              Pedir carta
            </button>
            <button
              onClick={parar}
              className="rounded-lg bg-sky-600 px-6 py-3 font-bold text-white transition hover:bg-sky-700"
            >
              Parar
            </button>
          </div>
        )}

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
