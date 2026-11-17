/**
 * Arena do GUERRA DE BRIO — o confronto em si.
 *
 * A tela é um ESPELHO do estado da partida: quem decide a revelação e a
 * pontuação é o servidor (`brio_fechar_rodada`). Aqui só:
 *   • desenhamos o placar com o X central e a rodada;
 *   • mostramos a pergunta e capturamos a escolha (que é imutável);
 *   • exibimos a revelação quando o servidor a entrega;
 *   • disparamos o fechamento quando ambos responderam ou o tempo acabou.
 *
 * O cronômetro local NUNCA decide nada por conta própria em modo servidor:
 * ele conta a partir do `rodada_liberada_em` do servidor e apenas pede o
 * fechamento — a decisão continua no servidor.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LETRAS, type Letra } from "@/lib/brio/types";
import { nomeArea } from "@/lib/brio/api";
import { nomeDaSubcategoria, type Dificuldade } from "@/lib/brio/categorias";

export interface RodadaArena {
  numero: number;
  pergunta_id: string;
  enunciado: string;
  area_slug: string;
  subcategoria_slug: string;
  dificuldade: string;
  alternativas: Array<{ letra: Letra; texto: string }>;
  revelada: boolean;
  letra_correta: Letra | null;
  explicacao: string | null;
  referencia: string | null;
}

export interface RespostaArena {
  rodada: number;
  jogador_id: string;
  letra: Letra | null;
  tempo_ms: number;
  acertou: boolean | null;
  pontos: number;
}

interface ArenaProps {
  rodada: RodadaArena;
  rodadaAtual: number;
  totalRodadas: number;
  segundosPorPergunta: number;
  /** ISO do momento em que o SERVIDOR liberou a rodada. */
  liberadaEm: string;
  meuId: string;
  nomeEu: string;
  nomeOponente: string;
  oponenteBot: boolean;
  placarEu: number;
  placarOponente: number;
  respostas: RespostaArena[];
  minhaResposta: Letra | null;
  desempate: boolean;
  onResponder: (letra: Letra) => void;
  onFechar: () => void;
  aguardando: boolean;
}

const NOMES_DIFICULDADE: Record<Dificuldade, string> = {
  facil: "Fácil",
  intermediaria: "Intermediária",
  dificil: "Difícil",
  avancada: "Avançada",
  especialista: "Especialista",
};

export function ArenaBrio({
  rodada,
  rodadaAtual,
  totalRodadas,
  segundosPorPergunta,
  liberadaEm,
  meuId,
  nomeEu,
  nomeOponente,
  oponenteBot,
  placarEu,
  placarOponente,
  respostas,
  minhaResposta,
  desempate,
  onResponder,
  onFechar,
  aguardando,
}: ArenaProps) {
  const [restanteMs, setRestanteMs] = useState(segundosPorPergunta * 1000);
  const fechouRef = useRef(false);

  // Reinicia o relógio a cada rodada liberada pelo servidor.
  useEffect(() => {
    fechouRef.current = false;
  }, [rodada.numero, liberadaEm]);

  const fechar = useCallback(() => {
    if (fechouRef.current) return;
    fechouRef.current = true;
    onFechar();
  }, [onFechar]);

  // Cronômetro espelhado: conta a partir do carimbo do servidor.
  useEffect(() => {
    const inicio = new Date(liberadaEm).getTime();
    const limite = segundosPorPergunta * 1000;

    const tick = () => {
      const decorrido = Number.isNaN(inicio) ? 0 : Date.now() - inicio;
      const resta = Math.max(0, limite - decorrido);
      setRestanteMs(resta);
      // O tempo acabou e o servidor ainda não revelou: pede o fechamento.
      if (resta <= 0 && !rodada.revelada) fechar();
    };

    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [liberadaEm, segundosPorPergunta, rodada.revelada, fechar]);

  // Quando ambos responderam, o fechamento é imediato (sem esperar o relógio).
  const respostaOponente = useMemo(
    () =>
      respostas.find((r) => r.rodada === rodada.numero && r.jogador_id !== meuId) ?? null,
    [respostas, rodada.numero, meuId],
  );
  const ambosResponderam = minhaResposta != null && respostaOponente?.letra != null;

  useEffect(() => {
    if (ambosResponderam && !rodada.revelada) fechar();
  }, [ambosResponderam, rodada.revelada, fechar]);

  const totalMs = segundosPorPergunta * 1000;
  const percentual = Math.max(0, Math.min(100, (restanteMs / totalMs) * 100));
  const critico = restanteMs <= totalMs * 0.34;
  const segundosVisiveis = Math.ceil(restanteMs / 1000);

  const oponenteRespondeu = respostaOponente?.letra != null;
  const revelada = rodada.revelada;

  return (
    <div className="brio-arena">
      {/* ---------- Placar com o X central ---------- */}
      <div className="brio-placar">
        <div className="brio-competidor brio-competidor--esq">
          <span className="brio-competidor-nome" title={nomeEu}>
            {nomeEu}
          </span>
          <span className="brio-competidor-tag">Você</span>
          <span className="brio-pontos">{placarEu}</span>
        </div>

        <div className={`brio-x ${aguardando ? "brio-x--pulso" : ""}`}>
          <span className="brio-x-numero">
            {rodadaAtual}/{totalRodadas}
          </span>
        </div>

        <div className="brio-competidor brio-competidor--dir">
          <span className="brio-competidor-nome" title={nomeOponente}>
            {nomeOponente}
          </span>
          <span className="brio-competidor-tag">{oponenteBot ? "Virtual" : "Adversário"}</span>
          <span className="brio-pontos">{placarOponente}</span>
        </div>
      </div>

      {/* ---------- Cronômetro ---------- */}
      <div className="brio-tempo" aria-hidden="true">
        <div
          className={`brio-tempo-barra ${critico ? "brio-tempo-barra--critico" : ""}`}
          style={{ width: `${percentual}%` }}
        />
      </div>

      {/* ---------- Pergunta ---------- */}
      <div className="brio-pergunta-card">
        <div className="brio-pergunta-meta">
          {desempate && <span className="brio-tag brio-tag--dificuldade">Desempate</span>}
          <span className="brio-tag brio-tag--dificuldade">
            {NOMES_DIFICULDADE[rodada.dificuldade as Dificuldade] ?? rodada.dificuldade}
          </span>
          <span className="brio-tag">{nomeArea(rodada.area_slug)}</span>
          <span className="brio-tag">{nomeDaSubcategoria(rodada.subcategoria_slug)}</span>
          {!revelada && (
            <span className="brio-tag" style={{ marginLeft: "auto" }}>
              {segundosVisiveis}s
            </span>
          )}
        </div>

        <p className="brio-enunciado">{rodada.enunciado}</p>

        <div className="brio-alternativas">
          {rodada.alternativas.map((alt) => {
            const escolhiEsta = minhaResposta === alt.letra;
            const correta = revelada && rodada.letra_correta === alt.letra;
            const erradaEscolhida = revelada && escolhiEsta && !correta;

            const classes = [
              "brio-alt",
              escolhiEsta ? "brio-alt--escolhida" : "",
              correta ? "brio-alt--correta" : "",
              erradaEscolhida ? "brio-alt--errada" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <button
                key={alt.letra}
                type="button"
                className={classes}
                disabled={minhaResposta != null || revelada}
                onClick={() => onResponder(alt.letra)}
                data-brio-option={alt.letra}
              >
                <span className="brio-alt-letra">{alt.letra}</span>
                <span>{alt.texto}</span>
                {correta && <span className="brio-alt-marca">correta</span>}
                {erradaEscolhida && <span className="brio-alt-marca">sua escolha</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------- Estados de espera / revelação ---------- */}
      {!revelada && minhaResposta != null && (
        <div className="brio-espera">
          <span className="brio-espera-dot" />
          {oponenteRespondeu
            ? "Revelando o resultado da rodada…"
            : `${nomeOponente} ainda está decidindo…`}
        </div>
      )}

      {!revelada && minhaResposta == null && aguardando && (
        <div className="brio-espera">
          <span className="brio-espera-dot" />
          Conectando ao adversário…
        </div>
      )}

      {revelada && (
        <div className="brio-revelacao">
          <div className="brio-revelacao-titulo">Resultado da rodada</div>
          <div className="brio-revelacao-linha">
            Resposta correta: <strong>{rodada.letra_correta}</strong>
            {minhaResposta != null && (
              <>
                {" · "}Você marcou <strong>{minhaResposta}</strong>{" "}
                {minhaResposta === rodada.letra_correta ? "— acertou!" : "— errou."}
              </>
            )}
            {minhaResposta == null && " — você não respondeu a tempo."}
          </div>
          {oponenteRespondeu && (
            <div className="brio-revelacao-linha" style={{ color: "var(--brio-muted)" }}>
              {nomeOponente} marcou {respostaOponente?.letra}
              {respostaOponente?.acertou ? " — acertou." : " — errou."}
            </div>
          )}
          {rodada.explicacao && <p className="brio-explicacao">{rodada.explicacao}</p>}
          {rodada.referencia && <p className="brio-referencia">Fonte: {rodada.referencia}</p>}
        </div>
      )}
    </div>
  );
}

/** Letras disponíveis — exportado para os testes conferirem o contrato A–F. */
export { LETRAS };
