/**
 * Resultado final do GUERRA DE BRIO.
 *
 * Separa explicitamente as DUAS métricas (§5.5 do documento):
 *   • PONTUAÇÃO DA PARTIDA — quem ganhou o duelo;
 *   • ÍNDICE DE CONHECIMENTO — estimativa de habilidade (TRI), por disciplina.
 * O índice nunca é apresentado como QI oficial.
 */
import { useEffect, useMemo, useState } from "react";
import {
  nomeArea,
  recalcularHabilidade,
  type HabilidadeLinha,
  type RespostaServidor,
} from "@/lib/brio/api";
import { AREAS } from "@/lib/brio/categorias";
import { rotuloIndice } from "@/lib/brio/tri";
import { aproveitamento, vencedorDoPlacar } from "@/lib/brio/duelo";
import { registrarEventoMissao } from "@/lib/cidadela/pracinhaCore";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

interface ResultadoProps {
  visao: {
    partida_id: string;
    jogador_1_id: string;
    jogador_2_id: string | null;
    rodadas: Array<{ pergunta_id: string; area_slug: string; revelada: boolean; letra_correta: string | null }>;
    respostas: RespostaServidor[] | Array<{ rodada: number; jogador_id: string; letra: string | null; acerto?: boolean | null; acertou?: boolean | null; pontos: number }>;
    placar_1: number;
    placar_2: number;
    acertos_1: number;
    acertos_2: number;
    empate: boolean;
    vencedor_id: string | null;
    total_perguntas: number;
    desempate: boolean;
  };
  meuId: string;
  nomeEu: string;
  modoLocal: boolean;
  habilidades: HabilidadeLinha[];
  onRevanche: () => void;
  onSair: () => void;
}

export function ResultadoBrio({
  visao,
  meuId,
  nomeEu,
  modoLocal,
  habilidades,
  onRevanche,
  onSair,
}: ResultadoProps) {
  const souJogador1 = visao.jogador_1_id === meuId;
  const meusAcertos = souJogador1 ? visao.acertos_1 : visao.acertos_2;
  const acertosOponente = souJogador1 ? visao.acertos_2 : visao.acertos_1;
  const meuPlacar = souJogador1 ? visao.placar_1 : visao.placar_2;
  const placarOponente = souJogador1 ? visao.placar_2 : visao.placar_1;

  // O veredito vem do SERVIDOR quando disponível; localmente re-derivamos do
  // placar (mesma regra) para não depender de um campo que pode faltar.
  const veredito = useMemo(() => {
    if (visao.vencedor_id) {
      return visao.vencedor_id === meuId ? "vitoria" : "derrota";
    }
    if (visao.empate) return "empate";
    const jogadores = [visao.jogador_1_id, visao.jogador_2_id].filter(
      (x): x is string => x != null,
    );
    const v = vencedorDoPlacar(jogadores, {
      [visao.jogador_1_id]: visao.placar_1,
      ...(visao.jogador_2_id ? { [visao.jogador_2_id]: visao.placar_2 } : {}),
    });
    if (v.empate) return "empate";
    return v.vencedorId === meuId ? "vitoria" : "derrota";
  }, [visao, meuId]);

  const [locais, setLocais] = useState<HabilidadeLinha[]>([]);

  // Missão diária + ranking do duelo. Roda UMA vez por resultado (o efeito
  // depende do id da partida, não do render).
  useEffect(() => {
    void registrarEventoMissao("brio_duelo" as never).catch(() => null);
    if (veredito === "vitoria") {
      void registrarEventoMissao("brio_vitoria" as never).catch(() => null);
    }
    // Sem servidor configurado, `supabase.rpc` lança de forma SÍNCRONA — um
    // `.catch()` no Promise não pegaria e derrubaria a tela de resultado
    // inteira. O ranking é acessório: sem Supabase, o duelo segue local.
    if (isSupabaseConfigured()) {
      void Promise.resolve(
        supabase.rpc("cidadela_registrar_resultado_jogo", {
          p_jogo_id: "brio",
          p_resultado: veredito,
          p_nome_exibicao: nomeEu ?? null,
        }),
      ).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Em modo servidor, o resultado pede o recálculo da TRI (a autoridade é o
  // servidor). Em modo local não há histórico no banco: mostramos só o geral.
  useEffect(() => {
    if (modoLocal) return;
    let vivo = true;
    void recalcularHabilidade().then((h) => {
      if (vivo && h.length > 0) setLocais(h);
    });
    return () => {
      vivo = false;
    };
  }, [modoLocal]);

  const lista = locais.length > 0 ? locais : habilidades;
  const geral = lista.find((h) => h.area_slug == null) ?? null;
  const porArea = lista
    .filter((h) => h.area_slug != null && h.respostas > 0)
    .sort((a, b) => b.respostas - a.respostas)
    .slice(0, 8);

  const meuAproveitamento = aproveitamento(meusAcertos, visao.total_perguntas);

  // Desempenho por disciplina NESTA partida (leitura direta das respostas).
  const porAreaPartida = useMemo(() => {
    const mapa = new Map<string, { acertos: number; total: number }>();
    visao.rodadas.forEach((rodada, idx) => {
      const numero = idx + 1;
      const minha = visao.respostas.find((r) => r.rodada === numero && r.jogador_id === meuId);
      if (!minha) return;
      const acertou =
        "acertou" in minha ? minha.acertou : (minha as { acerto?: boolean | null }).acerto;
      const atual = mapa.get(rodada.area_slug) ?? { acertos: 0, total: 0 };
      atual.total += 1;
      if (acertou) atual.acertos += 1;
      mapa.set(rodada.area_slug, atual);
    });
    return [...mapa.entries()]
      .map(([slug, v]) => ({ slug, ...v, pct: aproveitamento(v.acertos, v.total) }))
      .sort((a, b) => b.total - a.total);
  }, [visao, meuId]);

  const classesVeredito =
    veredito === "vitoria"
      ? "brio-final-veredito--vitoria"
      : veredito === "derrota"
        ? "brio-final-veredito--derrota"
        : "brio-final-veredito--empate";

  return (
    <>
      <span className="brio-badge">Duelo encerrado</span>

      <div className="brio-final" style={{ marginTop: "0.85rem" }}>
        <div className={`brio-final-veredito ${classesVeredito}`}>
          {veredito === "vitoria" ? "Vitória" : veredito === "derrota" ? "Derrota" : "Empate"}
        </div>
        <div className="brio-final-placar">
          {nomeEu} {meuPlacar} × {placarOponente} adversário
        </div>

        <div className="brio-metricas">
          <div className="brio-metrica">
            <div className="brio-metrica-valor">
              {meusAcertos}/{visao.total_perguntas}
            </div>
            <div className="brio-metrica-rotulo">Seus acertos</div>
          </div>
          <div className="brio-metrica">
            <div className="brio-metrica-valor">{meuAproveitamento}%</div>
            <div className="brio-metrica-rotulo">Aproveitamento</div>
          </div>
          <div className="brio-metrica">
            <div className="brio-metrica-valor">{acertosOponente}</div>
            <div className="brio-metrica-rotulo">Acertos do adversário</div>
          </div>
          <div className="brio-metrica">
            <div className="brio-metrica-valor">{meuPlacar}</div>
            <div className="brio-metrica-rotulo">Sua pontuação</div>
          </div>
        </div>

        {visao.desempate && (
          <p className="brio-sub" style={{ marginBottom: "0.75rem" }}>
            O duelo foi decidido na morte súbita.
          </p>
        )}

        <div className="brio-acoes">
          <button type="button" className="brio-btn" onClick={onRevanche}>
            Revanche
          </button>
          <button type="button" className="brio-btn brio-btn--secundario" onClick={onSair}>
            Novo duelo
          </button>
        </div>
      </div>

      {/* ---------- Índice de conhecimento (TRI) ---------- */}
      <section className="brio-disciplinas">
        <h2 className="brio-secao-titulo">Índice de conhecimento</h2>
        {geral ? (
          <>
            <div className="brio-disciplina-linha">
              <span className="brio-disciplina-nome">Geral (multidisciplinar)</span>
              <span className="brio-disciplina-barra">
                <span
                  className="brio-disciplina-preenchida"
                  style={{ width: `${Math.max(3, geral.indice)}%` }}
                />
              </span>
              <span className="brio-disciplina-valor">{geral.indice}</span>
            </div>
            <p className="brio-sub" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
              {rotuloIndice(geral.indice)} · estimado a partir de {geral.respostas} respostas
              {geral.confiabilidade < 0.5 && " (amostra ainda pequena — o índice ganha precisão a cada duelo)"}.
            </p>
          </>
        ) : (
          <p className="brio-sub" style={{ marginBottom: 0 }}>
            {modoLocal
              ? "Em modo offline o índice não é atualizado — ele depende do histórico no servidor."
              : "Dispute mais duelos para o índice ganhar precisão."}
          </p>
        )}

        {porArea.length > 0 && (
          <>
            <h2 className="brio-secao-titulo" style={{ marginTop: "0.9rem" }}>
              Por disciplina
            </h2>
            {porArea.map((h) => (
              <div key={h.area_slug ?? "geral"} className="brio-disciplina-linha">
                <span className="brio-disciplina-nome" title={nomeArea(h.area_slug)}>
                  {nomeArea(h.area_slug)}
                </span>
                <span className="brio-disciplina-barra">
                  <span
                    className="brio-disciplina-preenchida"
                    style={{ width: `${Math.max(3, h.indice)}%` }}
                  />
                </span>
                <span className="brio-disciplina-valor">{h.indice}</span>
              </div>
            ))}
          </>
        )}
      </section>

      {/* ---------- Desempenho por área NESTE duelo ---------- */}
      {porAreaPartida.length > 0 && (
        <section className="brio-disciplinas">
          <h2 className="brio-secao-titulo">Seu desempenho neste duelo</h2>
          {porAreaPartida.map((a) => (
            <div key={a.slug} className="brio-disciplina-linha">
              <span className="brio-disciplina-nome" title={nomeArea(a.slug)}>
                {nomeArea(a.slug)}
              </span>
              <span className="brio-disciplina-barra">
                <span className="brio-disciplina-preenchida" style={{ width: `${Math.max(3, a.pct)}%` }} />
              </span>
              <span className="brio-disciplina-valor">
                {a.acertos}/{a.total}
              </span>
            </div>
          ))}
        </section>
      )}

      <p className="brio-sub" style={{ marginTop: "1rem" }}>
        O índice de conhecimento é uma estimativa estatística da Cidadela dos Clássicos — não é um
        QI oficial nem um diagnóstico.
      </p>
    </>
  );
}

/** Áreas conhecidas — usado pelos testes para validar os slugs exibidos. */
export const AREAS_CONHECIDAS = AREAS.map((a) => a.slug);
