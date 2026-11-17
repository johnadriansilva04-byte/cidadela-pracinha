import { useCallback, useEffect, useState } from "react";
import { PainelCampanha } from "./PainelCampanha";
import { FimDePartida } from "./FimDePartida";
import { FORCA_IA, campanhaDe, progressoInicial, type ProgressoJogo } from "@/lib/universal/campanhaJogos";
import { carregarJogos, type ResultadoRegistrado } from "@/lib/universal/progressoJogos";
import type { ResultadoPartida } from "@/lib/universal/campanhaJogos";

type Props = {
  jogoId: string;
  userId: string | null;
  nomeExibicao?: string | null;
  /** Renderiza a partida. Recebe a força da IA da fase e o callback de fim. */
  children: (config: {
    forca: (typeof FORCA_IA)[keyof typeof FORCA_IA];
    onFim: (resultado: ResultadoPartida) => void;
    keyPartida: number;
  }) => React.ReactNode;
  onSair: () => void;
};

type Tela = "painel" | "jogo" | "fim";

/**
 * Envolve um jogo com campanha: painel de fase → partida → fim de partida.
 *
 * Fica FORA dos componentes de jogo de propósito — os 5 jogos já existem e
 * funcionam; reescrevê-los para caber campanha seria risco sem ganho. Aqui a
 * partida recebe a força da IA da fase e devolve só o resultado.
 */
export function JogoComCampanha({ jogoId, userId, nomeExibicao, children, onSair }: Props) {
  const [tela, setTela] = useState<Tela>("painel");
  const [progresso, setProgresso] = useState<ProgressoJogo>(() => progressoInicial(jogoId));
  const [carregando, setCarregando] = useState(true);
  const [resultado, setResultado] = useState<ResultadoPartida>("vitoria");
  const [keyPartida, setKeyPartida] = useState(0);

  useEffect(() => {
    let ativo = true;
    void carregarJogos(userId).then((estado) => {
      if (!ativo) return;
      setProgresso(estado[jogoId] ?? progressoInicial(jogoId));
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [userId, jogoId]);

  const iniciarPartida = useCallback(() => {
    setKeyPartida((k) => k + 1);
    setTela("jogo");
  }, []);

  const aoFim = useCallback((r: ResultadoPartida) => {
    setResultado(r);
    setTela("fim");
  }, []);

  const aoRegistrar = useCallback((r: ResultadoRegistrado) => {
    setProgresso(r.progresso);
  }, []);

  const campanha = campanhaDe(jogoId);
  if (!campanha) return null;

  if (carregando) {
    return (
      <div className="jcamp-wrap">
        <p className="jcamp-ranking-vazio">Carregando campanha…</p>
      </div>
    );
  }

  if (tela === "painel") {
    return (
      <PainelCampanha
        jogoId={jogoId}
        progresso={progresso}
        onJogar={iniciarPartida}
        onVoltar={onSair}
      />
    );
  }

  if (tela === "fim") {
    return (
      <FimDePartida
        jogoId={jogoId}
        resultado={resultado}
        userId={userId}
        nomeExibicao={nomeExibicao}
        progressoAtual={progresso}
        onRegistrado={aoRegistrar}
        onJogarDeNovo={iniciarPartida}
        onPainel={() => setTela("painel")}
      />
    );
  }

  // Força da IA = a da fase que o jogador está enfrentando.
  const fase =
    campanha.fases.find((f) => f.numero === progresso.fase) ??
    campanha.fases[campanha.fases.length - 1]!;

  return (
    <>
      {children({
        forca: FORCA_IA[fase.forca],
        onFim: aoFim,
        keyPartida,
      })}
    </>
  );
}
