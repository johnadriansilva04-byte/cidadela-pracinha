import { useEffect, useRef, useState } from "react";
import { Trophy, Coins, Target, RotateCcw, ArrowRight, Flame, Loader2 } from "lucide-react";
import { resumoCampanha, type ProgressoJogo } from "@/lib/universal/campanhaJogos";
import {
  registrarFimDePartida,
  type ResultadoRegistrado,
} from "@/lib/universal/progressoJogos";
import type { ResultadoPartida } from "@/lib/universal/campanhaJogos";

type Props = {
  jogoId: string;
  resultado: ResultadoPartida;
  userId: string | null;
  nomeExibicao?: string | null | undefined;
  progressoAtual: ProgressoJogo;
  onRegistrado: (r: ResultadoRegistrado) => void;
  onJogarDeNovo: () => void;
  onPainel: () => void;
};

const TITULO: Record<ResultadoPartida, string> = {
  vitoria: "Vitória!",
  derrota: "Derrota",
  empate: "Empate",
};

/**
 * Fim de partida com a consequência real: grava o resultado, paga a recompensa
 * da fase (uma vez), avança a missão diária e mostra a história do patrono.
 *
 * A gravação roda UMA vez por partida (guard por `registradoRef`): o jogador
 * pode clicar à vontade que a recompensa não duplica.
 */
export function FimDePartida({
  jogoId,
  resultado,
  userId,
  nomeExibicao,
  progressoAtual,
  onRegistrado,
  onJogarDeNovo,
  onPainel,
}: Props) {
  const [registro, setRegistro] = useState<ResultadoRegistrado | null>(null);
  const registradoRef = useRef(false);

  useEffect(() => {
    if (registradoRef.current) return;
    registradoRef.current = true;
    void registrarFimDePartida(userId, jogoId, resultado, {
      nomeExibicao: nomeExibicao ?? null,
    }).then((r) => {
      setRegistro(r);
      onRegistrado(r);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumo = resumoCampanha(registro?.progresso ?? progressoAtual);
  const venceu = resultado === "vitoria";

  return (
    <div className={`jfim-wrap jfim-${resultado}`}>
      <div className="jfim-emoji" aria-hidden>
        {venceu ? "🏆" : resultado === "empate" ? "🤝" : "💀"}
      </div>
      <h1 className="jfim-titulo">{TITULO[resultado]}</h1>

      {!registro ? (
        <p className="jfim-carregando">
          <Loader2 size={16} className="animate-spin" /> Registrando o resultado…
        </p>
      ) : (
        <>
          {/* História: o patrono comenta o desfecho */}
          <section className="jfim-historia">
            <span className="jfim-avatar" aria-hidden>
              {resumo?.patronoAvatar ?? "🤖"}
            </span>
            <div>
              <p className="jfim-patrono">{resumo?.patrono ?? "Cidadela"}</p>
              <p className="jfim-fala">{registro.mensagem}</p>
            </div>
          </section>

          {/* Recompensas e progresso desta partida */}
          <div className="jfim-premios">
            {registro.sovPago > 0 && (
              <span className="jfim-premio jfim-premio-sov">
                <Coins size={16} /> +{registro.sovPago} SOV
              </span>
            )}
            {registro.avancou && !registro.concluiu && (
              <span className="jfim-premio jfim-premio-fase">
                <Target size={16} /> Fase {registro.progresso.fase} liberada
              </span>
            )}
            {registro.concluiu && (
              <span className="jfim-premio jfim-premio-campeao">
                <Trophy size={16} /> Campanha concluída
              </span>
            )}
            {registro.recorde && registro.recorde.sequencia_atual >= 2 && (
              <span className="jfim-premio jfim-premio-seq">
                <Flame size={16} /> {registro.recorde.sequencia_atual} seguidas
              </span>
            )}
          </div>

          {/* Próximo objetivo — só quando ainda há campanha */}
          {resumo && !resumo.concluida && (
            <section className="jfim-proximo">
              <p className="jfim-proximo-rot">Próximo desafio</p>
              <p className="jfim-proximo-titulo">
                Fase {resumo.fase} · {resumo.tituloFase}
              </p>
              <p className="jfim-proximo-obj">
                {resumo.objetivo} · IA {resumo.forcaLabel}
              </p>
            </section>
          )}

          {registro.recorde && (
            <p className="jfim-recorde">
              Recorde em {resumo?.nome ?? jogoId}: {registro.recorde.vitorias}V ·{" "}
              {registro.recorde.derrotas}D · {registro.recorde.empates}E
              {registro.recorde.melhor_sequencia > 0 &&
                ` · melhor sequência ${registro.recorde.melhor_sequencia}`}
            </p>
          )}
        </>
      )}

      <div className="jfim-botoes">
        <button type="button" className="jfim-btn jfim-btn-primario" onClick={onJogarDeNovo}>
          <RotateCcw size={16} /> Jogar de novo
        </button>
        <button type="button" className="jfim-btn" onClick={onPainel}>
          <ArrowRight size={16} /> Painel da campanha
        </button>
      </div>
    </div>
  );
}
