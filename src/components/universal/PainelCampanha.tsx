import { useEffect, useState } from "react";
import { Swords, Trophy, Coins, Target, ChevronRight, Star, Loader2 } from "lucide-react";
import {
  FORCA_LABEL,
  resumoCampanha,
  type ProgressoJogo,
} from "@/lib/universal/campanhaJogos";
import { carregarRanking, type LinhaRanking } from "@/lib/universal/progressoJogos";

type Props = {
  jogoId: string;
  progresso: ProgressoJogo;
  /** Inicia a próxima partida da campanha (força da IA da fase atual). */
  onJogar: () => void;
  onVoltar: () => void;
};

/**
 * Painel de campanha: mostra a fase, o objetivo, a fala do patrono, o recorde
 * e o ranking do jogo. É a porta de entrada de cada jogo — em vez de cair
 * direto numa partida solta, o jogador vê onde está na história.
 */
export function PainelCampanha({ jogoId, progresso, onJogar, onVoltar }: Props) {
  const resumo = resumoCampanha(progresso);
  const [ranking, setRanking] = useState<LinhaRanking[]>([]);
  const [carregandoRanking, setCarregandoRanking] = useState(true);

  useEffect(() => {
    let ativo = true;
    setCarregandoRanking(true);
    void carregarRanking(jogoId, 10).then((linhas) => {
      if (!ativo) return;
      setRanking(linhas);
      setCarregandoRanking(false);
    });
    return () => {
      ativo = false;
    };
  }, [jogoId]);

  if (!resumo) return null;

  const percentualFase = (resumo.fase / resumo.totalFases) * 100;

  return (
    <div className="jcamp-wrap">
      <div className="jcamp-topo">
        <button type="button" className="jcamp-voltar" onClick={onVoltar}>
          ← Voltar
        </button>
        <h1 className="jcamp-titulo">{resumo.nome}</h1>
        <span className="jcamp-fase-chip">
          Fase {resumo.fase}/{resumo.totalFases}
        </span>
      </div>

      {/* Barra de progresso da campanha */}
      <div className="jcamp-barra" aria-hidden>
        <span className="jcamp-barra-fill" style={{ width: `${percentualFase}%` }} />
      </div>

      {/* Cartão da fase atual, com a história do patrono */}
      <section className="jcamp-fase">
        <header className="jcamp-fase-topo">
          <span className="jcamp-avatar" aria-hidden>
            {resumo.patronoAvatar}
          </span>
          <div>
            <p className="jcamp-patrono">{resumo.patrono}</p>
            <p className="jcamp-fase-titulo">{resumo.tituloFase}</p>
          </div>
          {resumo.concluida && (
            <span className="jcamp-selo-concluida">
              <Trophy size={14} /> Concluída
            </span>
          )}
        </header>

        <p className="jcamp-historia">“{resumo.historia}”</p>

        <div className="jcamp-metas">
          <span className="jcamp-meta">
            <Target size={14} /> {resumo.objetivo}
          </span>
          <span className="jcamp-meta">
            <Swords size={14} /> IA: {resumo.forcaLabel}
          </span>
          <span className="jcamp-meta">
            <Coins size={14} /> {resumo.sovGanha} SOV ganhos
          </span>
        </div>
      </section>

      <button type="button" className="jcamp-jogar" onClick={onJogar}>
        {resumo.concluida ? (
          <>
            <Star size={18} /> Jogar pela glória
          </>
        ) : (
          <>
            <Swords size={18} /> Enfrentar {resumo.forcaLabel}
          </>
        )}
        <ChevronRight size={18} />
      </button>

      {/* Recorde do jogador */}
      <section className="jcamp-placar">
        <h2 className="jcamp-secao">Seu recorde</h2>
        <div className="jcamp-placar-grid">
          <div className="jcamp-tile">
            <span className="jcamp-tile-num">{resumo.vitorias}</span>
            <span className="jcamp-tile-rot">Vitórias</span>
          </div>
          <div className="jcamp-tile">
            <span className="jcamp-tile-num">{resumo.empates}</span>
            <span className="jcamp-tile-rot">Empates</span>
          </div>
          <div className="jcamp-tile">
            <span className="jcamp-tile-num">{resumo.derrotas}</span>
            <span className="jcamp-tile-rot">Derrotas</span>
          </div>
        </div>
      </section>

      {/* Ranking do jogo */}
      <section className="jcamp-ranking">
        <h2 className="jcamp-secao">Ranking — {resumo.nome}</h2>
        {carregandoRanking ? (
          <p className="jcamp-ranking-vazio">
            <Loader2 size={14} className="animate-spin" /> Carregando…
          </p>
        ) : ranking.length === 0 ? (
          <p className="jcamp-ranking-vazio">
            Ninguém pontuou ainda. A primeira vitória é sua.
          </p>
        ) : (
          <ol className="jcamp-ranking-lista">
            {ranking.map((l) => (
              <li key={`${l.posicao}-${l.nome}`} className={l.souEu ? "jcamp-rank-eu" : ""}>
                <span className="jcamp-rank-pos">{l.posicao}º</span>
                <span className="jcamp-rank-nome">{l.nome}</span>
                <span className="jcamp-rank-vit">{l.vitorias}V</span>
                <span className="jcamp-rank-seq">seq {l.melhorSequencia}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="jcamp-rodape">
        {FORCA_LABEL[resumo.forca]} · a IA fica mais forte a cada fase vencida
      </p>
    </div>
  );
}
