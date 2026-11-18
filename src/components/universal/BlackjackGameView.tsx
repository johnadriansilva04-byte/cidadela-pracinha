import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArenaJogo } from "@/components/universal/ArenaJogo";
import { UniversalGameFactory } from "@/lib/universal/UniversalGameFactory";
import type { ResultadoPartida } from "@/lib/universal/campanhaJogos";
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
  /** Força da IA da fase da campanha (ausente = partida avulsa). */
  forca?: { maxIterations: number; timeBudgetMs: number } | undefined;
  /** Avisa a campanha do resultado da partida (uma vez por partida). */
  onFim?: ((resultado: ResultadoPartida) => void) | undefined;
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

export function BlackjackGameView({ onBack, forca, onFim }: BlackjackGameViewProps) {
  // Nas fases altas a mesa aplica a regra profissional "dealer hits soft 17" —
  // regra real de cassino, que aumenta a vantagem da casa. A fase inicial usa
  // a mesa amadora (stand on soft 17).
  const regraDura = forca !== undefined && forca.maxIterations >= 1500;
  const [gameState, setGameState] = useState<UniversalGameState | null>(() => {
    const inicial = UniversalGameFactory.createGame(JOGO, JOGADORES);
    if (inicial && regraDura) inicial.activeRules = [...inicial.activeRules, "dealer_hit_soft_17"];
    return inicial;
  });

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
    const inicial = UniversalGameFactory.createGame(JOGO, JOGADORES);
    if (inicial && regraDura) inicial.activeRules = [...inicial.activeRules, "dealer_hit_soft_17"];
    setGameState(inicial);
  };

  /**
   * O Blackjack é uma SESSÃO, não uma partida única: o jogador aposta e joga
   * várias mãos seguidas. Por isso a campanha não julga cada mão — ela vê o
   * resultado LÍQUIDO da sessão, reportado quando o jogador sai da mesa (ou
   * quando a banca quebra, que é o fim natural da sessão).
   */
  const [saldoSessao, setSaldoSessao] = useState(0);
  const maoSomadaRef = useRef<string | null>(null);

  useEffect(() => {
    const id = gameState?.gameId ?? null;
    if (!acabou || !id || resultado === undefined) return;
    if (maoSomadaRef.current === id) return;
    maoSomadaRef.current = id;
    setSaldoSessao((s) => s + resultado);
  }, [acabou, resultado, gameState?.gameId]);

  const encerrarSessao = useCallback(() => {
    if (!onFim) return;
    if (saldoSessao > 0) onFim("vitoria");
    else if (saldoSessao < 0) onFim("derrota");
    else onFim("empate");
  }, [onFim, saldoSessao]);

  // Sair da mesa = fechar a sessão. Com campanha, o resultado vai para a tela
  // de fim de partida (é lá que a recompensa é paga); sem campanha, sai direto.
  const sairDaMesa = useCallback(() => {
    if (onFim) {
      encerrarSessao();
      return;
    }
    onBack();
  }, [encerrarSessao, onFim, onBack]);

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
    <ArenaJogo
      titulo="Blackjack"
      onBack={sairDaMesa}
      turno={acabou ? undefined : fase === "betting" ? "Apostas" : "Sua vez"}
      status={
        <>
          <span className="arena-turno">
            <span className="arena-turno-rot">Fichas:</span>
            <strong>{fichas}</strong>
          </span>
          <span className="arena-turno">
            <span className="arena-turno-rot">Aposta:</span>
            <strong>{aposta || "—"}</strong>
          </span>
          <span className="arena-turno">
            <span className="arena-turno-rot">Fase:</span>
            <strong>{fase === "betting" ? "Apostas" : "Jogo"}</strong>
          </span>
        </>
      }
      versus={{ eu: "Você", oponente: "Banca" }}
      pontos={{
        eu: minhaMao.length > 0 ? meuValor : "—",
        oponente: maoDealer.length > 0 ? valorDealer : "—",
      }}
      acabou={acabou}
      resultado={
        acabou
          ? /venceu|blackjack|21/i.test(mensagemFinal ?? "")
            ? "vitoria"
            : /empate/i.test(mensagemFinal ?? "")
              ? "empate"
              : "derrota"
          : null
      }
      mensagemFim={mensagemFinal}
      acoes={
        fase === "betting" && !acabou ? (
          <>
            {apostas.map((valor) => (
              <button key={valor} onClick={() => apostar(valor)} className="arena-btn">
                {valor}
              </button>
            ))}
          </>
        ) : fase === "playing" && !acabou ? (
          <>
            <button onClick={pedirCarta} disabled={meuValor >= 21} className="arena-btn arena-btn--primario">
              Pedir carta
            </button>
            <button onClick={parar} className="arena-btn">
              Parar
            </button>
          </>
        ) : null
      }
      onNovoJogo={novaPartida}
    >
      {/* Banca */}
      <div className="arena-placa">
        <div className="mb-3 flex items-center justify-between">
          <p className="arena-placa-titulo mb-0">Banca</p>
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
      <div className="arena-placa">
        <div className="mb-3 flex items-center justify-between">
          <p className="arena-placa-titulo mb-0">Sua mão</p>
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
    </ArenaJogo>
  );
}
