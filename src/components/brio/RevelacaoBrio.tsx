/**
 * Tela de REVELAÇÃO do GUERRA DE BRIO.
 *
 * Aparece entre a resposta e a próxima rodada: mostra a resposta correta, o que
 * cada competidor marcou e a explicação. É a ETAPA 4/5 do documento — sem ela
 * o jogador nunca saberia por que acertou ou errou.
 */
import { nomeArea } from "@/lib/brio/api";
import { nomeDaSubcategoria, type Dificuldade } from "@/lib/brio/categorias";
import type { Letra } from "@/lib/brio/types";
import type { RespostaArena, RodadaArena } from "./ArenaBrio";

interface RevelacaoProps {
  rodada: RodadaArena;
  numero: number;
  totalRodadas: number;
  meuId: string;
  nomeEu: string;
  nomeOponente: string;
  placarEu: number;
  placarOponente: number;
  respostas: RespostaArena[];
  minhaResposta: Letra | null;
  onContinuar: () => void;
}

const NOMES_DIFICULDADE: Record<Dificuldade, string> = {
  facil: "Fácil",
  intermediaria: "Intermediária",
  dificil: "Difícil",
  avancada: "Avançada",
  especialista: "Especialista",
};

export function RevelacaoBrio({
  rodada,
  numero,
  totalRodadas,
  meuId,
  nomeEu,
  nomeOponente,
  placarEu,
  placarOponente,
  respostas,
  minhaResposta,
  onContinuar,
}: RevelacaoProps) {
  const respostaOponente =
    respostas.find((r) => r.rodada === numero && r.jogador_id !== meuId) ?? null;

  const correta = rodada.letra_correta;
  const acertei = minhaResposta != null && minhaResposta === correta;
  const oponenteAcertou = respostaOponente?.letra === correta;
  const naoRespondi = minhaResposta == null;

  const veredito = naoRespondi ? "Tempo esgotado" : acertei ? "Você acertou" : "Você errou";
  const classeVeredito = naoRespondi
    ? "brio-final-veredito--empate"
    : acertei
      ? "brio-final-veredito--vitoria"
      : "brio-final-veredito--derrota";

  return (
    <div className="brio-arena">
      <div className="brio-placar">
        <div className="brio-competidor brio-competidor--esq">
          <span className="brio-competidor-nome">{nomeEu}</span>
          <span className="brio-competidor-tag">Você</span>
          <span className="brio-pontos">{placarEu}</span>
        </div>
        <div className="brio-x">
          <span className="brio-x-numero">
            {numero}/{totalRodadas}
          </span>
        </div>
        <div className="brio-competidor brio-competidor--dir">
          <span className="brio-competidor-nome">{nomeOponente}</span>
          <span className="brio-competidor-tag">Adversário</span>
          <span className="brio-pontos">{placarOponente}</span>
        </div>
      </div>

      <div className="brio-final" style={{ marginTop: "0.85rem" }}>
        <div className={`brio-final-veredito ${classeVeredito}`}>{veredito}</div>

        <div className="brio-metricas" style={{ marginTop: "0.85rem" }}>
          <div className="brio-metrica">
            <div className="brio-metrica-valor">{correta ?? "—"}</div>
            <div className="brio-metrica-rotulo">Resposta correta</div>
          </div>
          <div className="brio-metrica">
            <div className="brio-metrica-valor">{minhaResposta ?? "—"}</div>
            <div className="brio-metrica-rotulo">Sua marcação</div>
          </div>
          <div className="brio-metrica">
            <div className="brio-metrica-valor">
              {respostaOponente?.letra ?? "—"}
              {respostaOponente?.letra != null && (oponenteAcertou ? " ✓" : " ✗")}
            </div>
            <div className="brio-metrica-rotulo">Adversário</div>
          </div>
        </div>

        <div className="brio-pergunta-meta" style={{ justifyContent: "center" }}>
          <span className="brio-tag brio-tag--dificuldade">
            {NOMES_DIFICULDADE[rodada.dificuldade as Dificuldade] ?? rodada.dificuldade}
          </span>
          <span className="brio-tag">{nomeArea(rodada.area_slug)}</span>
          <span className="brio-tag">{nomeDaSubcategoria(rodada.subcategoria_slug)}</span>
        </div>

        <p className="brio-enunciado" style={{ textAlign: "left", marginTop: "0.6rem" }}>
          {rodada.enunciado}
        </p>

        {rodada.explicacao && (
          <div className="brio-revelacao" style={{ textAlign: "left" }}>
            <div className="brio-revelacao-titulo">Por quê</div>
            <p className="brio-explicacao">{rodada.explicacao}</p>
            {rodada.referencia && <p className="brio-referencia">Fonte: {rodada.referencia}</p>}
          </div>
        )}

        <div className="brio-acoes" style={{ marginTop: "1rem" }}>
          <button type="button" className="brio-btn" onClick={onContinuar} data-brio-continuar>
            {numero >= totalRodadas ? "Ver resultado" : "Próxima pergunta"}
          </button>
        </div>
      </div>
    </div>
  );
}
