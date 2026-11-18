/**
 * Lobby do GUERRA DE BRIO — escolha da modalidade, do assunto e do adversário.
 *
 * Reaproveita a identidade visual da Cidadela (painel, chips, botões) e o
 * catálogo real do banco. Nenhuma lista de categorias é inventada aqui: vem
 * de `carregarCatalogo()` (banco quando a migration está aplicada, código
 * como fallback).
 */
import { useEffect, useMemo, useState } from "react";
import { carregarCatalogo, backendBrioAtivo, AVISO_MODO_LOCAL, type AreaCatalogo } from "@/lib/brio/api";
import { MODALIDADES, type Modalidade } from "@/lib/brio/categorias";
import { DUELO } from "@/lib/brio/types";
import { NIVEIS_ADVERSARIO } from "@/lib/brio/duelo";

export interface EscolhaDuelo {
  modalidade: Modalidade;
  areaSlug: string | null;
  subcategoriaSlug: string | null;
  nivelAdversario: number;
  /** Sala de convite entre dois humanos (espera o assento 2). */
  convite: boolean;
}

interface LobbyProps {
  nomeJogador: string;
  onIniciar: (escolha: EscolhaDuelo) => void;
  /** Abre o MODO HISTÓRIA (campanha narrativa). */
  onCampanha: () => void;
  /** Já existe progresso de campanha neste aparelho. */
  temCampanha: boolean;
  carregando: boolean;
  erro: string | null;
  /** O duelo por convite só existe com conta (mesma sessão da Cidadela). */
  podeConvidar: boolean;
}

export function LobbyBrio({
  nomeJogador,
  onIniciar,
  onCampanha,
  temCampanha,
  carregando,
  erro,
  podeConvidar,
}: LobbyProps) {
  const [modalidade, setModalidade] = useState<Modalidade>("multidisciplinar");
  const [convite, setConvite] = useState(false);
  const [areaSlug, setAreaSlug] = useState<string | null>(null);
  const [subSlug, setSubSlug] = useState<string | null>(null);
  const [nivel, setNivel] = useState(2);
  const [areas, setAreas] = useState<AreaCatalogo[]>([]);
  const [modoLocal, setModoLocal] = useState(false);

  useEffect(() => {
    let vivo = true;
    void Promise.all([carregarCatalogo(), backendBrioAtivo()]).then(([cat, ativo]) => {
      if (!vivo) return;
      setAreas(cat);
      setModoLocal(!ativo);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const areaSelecionada = useMemo(
    () => areas.find((a) => a.slug === areaSlug) ?? null,
    [areas, areaSlug],
  );

  // Trocar de modalidade limpa o que não se aplica — evita estado incoerente
  // (ex.: subcategoria escolhida com modalidade "geral").
  function trocarModalidade(m: Modalidade) {
    setModalidade(m);
    if (m !== "categoria") setAreaSlug(null);
    if (m !== "subcategoria") setSubSlug(null);
  }

  // Sem backend não existe convite: evita iniciar uma sala que não sincroniza.
  const conviteEfetivo = convite && podeConvidar && !modoLocal;

  const podeIniciar =
    !carregando &&
    (modalidade === "categoria" ? areaSlug != null : true) &&
    (modalidade === "subcategoria" ? subSlug != null : true);

  return (
    <div className="brio-app">
      <span className="brio-badge">Duelo intelectual 1×1</span>
      <h1 className="brio-titulo">Guerra de Brio</h1>
      <p className="brio-sub">
        Dois competidores, a mesma pergunta ao mesmo tempo, {DUELO.SEGUNDOS_POR_PERGUNTA} segundos
        para decidir. Quem domina o assunto leva a rodada.
      </p>

      {/* ---------- Modo de jogo: duelo livre x modo história ---------- */}
      <section className="brio-painel" style={{ marginBottom: "0.75rem" }}>
        <h2 className="brio-secao-titulo">Modo de jogo</h2>
        <div className="brio-grid-2">
          <button
            type="button"
            className="brio-opcao brio-opcao--ativo"
            aria-pressed="true"
            data-brio-jogo="duelo"
          >
            <span className="brio-opcao-icone">⚔️</span>
            <span>
              <span className="brio-opcao-nome">Duelo livre</span>
              <br />
              <span className="brio-opcao-desc">Partidas soltas, contra bot ou amigo</span>
            </span>
          </button>
          <button
            type="button"
            className="brio-opcao"
            onClick={onCampanha}
            aria-pressed="false"
            data-brio-jogo="campanha"
          >
            <span className="brio-opcao-icone">📜</span>
            <span>
              <span className="brio-opcao-nome">Modo história</span>
              <br />
              <span className="brio-opcao-desc">
                {temCampanha ? "Continue sua campanha de 6 atos" : "Campanha de 6 atos: FEB, escravidão, eugenia"}
              </span>
            </span>
          </button>
        </div>
      </section>

      {modoLocal && (
        <div className="brio-aviso">
          <span className="brio-aviso-dot" />
          {AVISO_MODO_LOCAL}
        </div>
      )}

      {/* ---------- Modalidade ---------- */}
      <section className="brio-painel" style={{ marginBottom: "0.75rem" }}>
        <h2 className="brio-secao-titulo">Modalidade</h2>
        <div className="brio-grid-2">
          {MODALIDADES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`brio-opcao ${modalidade === m.id ? "brio-opcao--ativo" : ""}`}
              onClick={() => trocarModalidade(m.id)}
              aria-pressed={modalidade === m.id}
            >
              <span className="brio-opcao-icone">{m.icone}</span>
              <span>
                <span className="brio-opcao-nome">{m.nome}</span>
                <br />
                <span className="brio-opcao-desc">{m.descricao}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ---------- Categoria / subcategoria ---------- */}
      {(modalidade === "categoria" || modalidade === "subcategoria") && (
        <section className="brio-painel" style={{ marginBottom: "0.75rem" }}>
          <h2 className="brio-secao-titulo">
            {modalidade === "categoria" ? "Escolha a área" : "Escolha a área e o assunto"}
          </h2>
          <div className="brio-chip-lista">
            {areas.map((a) => (
              <button
                key={a.slug}
                type="button"
                className={`brio-chip ${areaSlug === a.slug ? "brio-chip--ativo" : ""}`}
                onClick={() => {
                  setAreaSlug(a.slug);
                  setSubSlug(null);
                }}
              >
                {a.icone} {a.nome}
                <span className="brio-chip-contagem">{a.perguntas}</span>
              </button>
            ))}
          </div>

          {modalidade === "subcategoria" && areaSelecionada && (
            <>
              <h2 className="brio-secao-titulo" style={{ marginTop: "0.9rem" }}>
                Assunto
              </h2>
              <div className="brio-chip-lista">
                {areaSelecionada.subcategorias.map((s) => (
                  <button
                    key={s.slug}
                    type="button"
                    className={`brio-chip ${subSlug === s.slug ? "brio-chip--ativo" : ""}`}
                    onClick={() => setSubSlug(s.slug)}
                  >
                    {s.nome}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* ---------- Adversário ---------- */}
      <section className="brio-painel" style={{ marginBottom: "0.9rem" }}>
        <h2 className="brio-secao-titulo">Adversário</h2>

        {/* Convite exige o backend: sem ele o duelo cairia no adversário
            virtual, prometendo algo que não acontece. */}
        {podeConvidar && !modoLocal && (
          <div className="brio-grid-2" style={{ marginBottom: "0.6rem" }}>
            <button
              type="button"
              className={`brio-opcao ${!convite ? "brio-opcao--ativo" : ""}`}
              onClick={() => setConvite(false)}
              aria-pressed={!convite}
              data-brio-modo="virtual"
            >
              <span className="brio-opcao-icone">🤖</span>
              <span>
                <span className="brio-opcao-nome">Adversário virtual</span>
                <br />
                <span className="brio-opcao-desc">Jogue agora, sozinho</span>
              </span>
            </button>
            <button
              type="button"
              className={`brio-opcao ${convite ? "brio-opcao--ativo" : ""}`}
              onClick={() => setConvite(true)}
              aria-pressed={convite}
              data-brio-modo="convite"
            >
              <span className="brio-opcao-icone">⚔️</span>
              <span>
                <span className="brio-opcao-nome">Convidar um amigo</span>
                <br />
                <span className="brio-opcao-desc">Dois humanos, sala sincronizada</span>
              </span>
            </button>
          </div>
        )}

        {conviteEfetivo ? (
          <p className="brio-sub" style={{ marginTop: 0 }}>
            Você cria a sala e recebe um link. O duelo começa quando o convidado entrar — as
            perguntas são as mesmas para os dois, com o relógio do servidor.
          </p>
        ) : (
          <div className="brio-grid-2">
            {NIVEIS_ADVERSARIO.map((n) => (
              <button
                key={n.nivel}
                type="button"
                className={`brio-opcao ${nivel === n.nivel ? "brio-opcao--ativo" : ""}`}
                onClick={() => setNivel(n.nivel)}
                aria-pressed={nivel === n.nivel}
              >
                <span className="brio-opcao-icone">
                  {"★".repeat(n.nivel)}
                  {"☆".repeat(4 - n.nivel)}
                </span>
                <span>
                  <span className="brio-opcao-nome">{n.nome}</span>
                  <br />
                  <span className="brio-opcao-desc">{n.descricao}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <button
        type="button"
        className="brio-btn"
        disabled={!podeIniciar}
        onClick={() =>
          onIniciar({
            modalidade,
            areaSlug: modalidade === "categoria" || modalidade === "subcategoria" ? areaSlug : null,
            subcategoriaSlug: modalidade === "subcategoria" ? subSlug : null,
            nivelAdversario: nivel,
            convite: conviteEfetivo,
          })
        }
      >
        {carregando
          ? "Preparando a arena…"
          : conviteEfetivo
            ? "Criar sala e convidar"
            : `Iniciar duelo · ${DUELO.PERGUNTAS_POR_PARTIDA} rodadas`}
      </button>

      {erro && <div className="brio-erro">{erro}</div>}
      <p className="brio-sub" style={{ marginTop: "0.9rem", marginBottom: 0 }}>
        Competindo como <strong>{nomeJogador}</strong>. O índice de conhecimento é uma estimativa
        estatística da própria Cidadela — não é um QI oficial.
      </p>
    </div>
  );
}
