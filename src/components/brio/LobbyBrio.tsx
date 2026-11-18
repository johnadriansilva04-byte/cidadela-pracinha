/**
 * Configuração do DUELO LIVRE do Guerra de Brio — assistente por etapas.
 *
 * Antes esta tela despejava tudo de uma vez: modo de jogo, 5 modalidades,
 * 10 áreas, dezenas de subcategorias, 4 níveis de adversário e o texto legal.
 * O jogador caía num formulário sem saber o que estava escolhendo.
 *
 * Agora é UMA pergunta por tela, com a recomendação já marcada — quem não quer
 * pensar só clica em avançar. A última configuração fica guardada no aparelho
 * e o resumo aparece antes de começar, para o jogador saber o que vai jogar.
 *
 * O catálogo de áreas vem do banco (com fallback do código): nenhuma lista é
 * inventada aqui.
 */
import { useEffect, useMemo, useState } from "react";
import { carregarCatalogo, backendBrioAtivo, AVISO_MODO_LOCAL, type AreaCatalogo } from "@/lib/brio/api";
import { MODALIDADES, type Modalidade } from "@/lib/brio/categorias";
import { NIVEIS_ADVERSARIO } from "@/lib/brio/duelo";
import { DUELO } from "@/lib/brio/types";

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
  carregando: boolean;
  erro: string | null;
  /** O duelo por convite só existe com conta (mesma sessão da Cidadela). */
  podeConvidar: boolean;
  /** Volta para a página inicial do jogo. */
  onVoltar: () => void;
}

const CHAVE_CONFIG = "brio:duelo:config";

/** Configuração lembrada do aparelho (autoconfiguração). */
function configSalva(): Partial<EscolhaDuelo> | null {
  if (typeof window === "undefined") return null;
  try {
    const cru = window.localStorage.getItem(CHAVE_CONFIG);
    if (!cru) return null;
    const dados = JSON.parse(cru) as Partial<EscolhaDuelo>;
    return typeof dados === "object" && dados ? dados : null;
  } catch {
    return null;
  }
}

export function LobbyBrio({ nomeJogador, onIniciar, carregando, erro, podeConvidar, onVoltar }: LobbyProps) {
  const lembrada = useMemo(() => configSalva(), []);

  const [passo, setPasso] = useState(0);
  const [modalidade, setModalidade] = useState<Modalidade>(lembrada?.modalidade ?? "multidisciplinar");
  const [areaSlug, setAreaSlug] = useState<string | null>(lembrada?.areaSlug ?? null);
  const [subSlug, setSubSlug] = useState<string | null>(lembrada?.subcategoriaSlug ?? null);
  const [nivel, setNivel] = useState(lembrada?.nivelAdversario ?? 2);
  const [convite, setConvite] = useState(false);
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

  const areaSelecionada = useMemo(() => areas.find((a) => a.slug === areaSlug) ?? null, [areas, areaSlug]);
  const subSelecionada = useMemo(
    () => areaSelecionada?.subcategorias.find((s) => s.slug === subSlug) ?? null,
    [areaSelecionada, subSlug],
  );

  // Sem backend não existe convite: evita iniciar uma sala que não sincroniza.
  const conviteDisponivel = podeConvidar && !modoLocal;
  const motivoSemConvite = !podeConvidar
    ? "Entre na Cidadela para jogar com um amigo"
    : "Duelo online indisponível agora — jogue contra o adversário virtual";
  const conviteEfetivo = convite && conviteDisponivel;

  // ------------------------------------------------------------- etapas
  // Só entram no fluxo as etapas que se aplicam à modalidade escolhida.
  const etapas = useMemo(() => {
    const lista: Array<"modalidade" | "assunto" | "adversario"> = ["modalidade"];
    if (modalidade === "categoria" || modalidade === "subcategoria") lista.push("assunto");
    lista.push("adversario");
    return lista;
  }, [modalidade]);

  const etapaAtual = etapas[Math.min(passo, etapas.length - 1)] ?? "modalidade";
  const ultimoPasso = passo >= etapas.length - 1;

  const podeAvancar =
    etapaAtual === "assunto"
      ? modalidade === "categoria"
        ? areaSlug != null
        : subSlug != null
      : true;

  function trocarModalidade(m: Modalidade) {
    setModalidade(m);
    if (m !== "categoria") setAreaSlug(m === "subcategoria" ? areaSlug : null);
    if (m !== "subcategoria") setSubSlug(null);
  }

  function iniciar() {
    const escolha: EscolhaDuelo = {
      modalidade,
      areaSlug: modalidade === "categoria" || modalidade === "subcategoria" ? areaSlug : null,
      subcategoriaSlug: modalidade === "subcategoria" ? subSlug : null,
      nivelAdversario: nivel,
      convite: conviteEfetivo,
    };
    try {
      window.localStorage.setItem(CHAVE_CONFIG, JSON.stringify(escolha));
    } catch {
      /* storage bloqueado: só não lembra */
    }
    onIniciar(escolha);
  }

  const nomeModalidade = MODALIDADES.find((m) => m.id === modalidade)?.nome ?? "Multidisciplinar";
  const nomeAdversario = NIVEIS_ADVERSARIO.find((n) => n.nivel === nivel)?.nome ?? "Pesquisador";
  const assuntoResumo =
    modalidade === "subcategoria"
      ? `${areaSelecionada?.nome ?? "—"} · ${subSelecionada?.nome ?? "—"}`
      : modalidade === "categoria"
        ? (areaSelecionada?.nome ?? "escolha a área")
        : nomeModalidade;

  return (
    <div className="brio-app">
      {/* --------------------------------------------------------- topo */}
      <div className="pj-topo">
        <button type="button" className="brio-link" onClick={passo === 0 ? onVoltar : () => setPasso((p) => p - 1)}>
          {passo === 0 ? "← Voltar" : "← Anterior"}
        </button>
        {/* Nome do jogo: o jogador precisa saber ONDE está configurando. */}
        <span className="brio-badge" style={{ marginLeft: "auto", marginRight: "auto" }}>
          ⚔️ Guerra de Brio
        </span>
        <div className="pj-bolinhas" aria-label={`Etapa ${passo + 1} de ${etapas.length}`}>
          {etapas.map((e, i) => (
            <span
              key={e}
              className={`pj-bolinha ${i < passo ? "pj-bolinha--feita" : ""} ${i === passo ? "pj-bolinha--atual" : ""}`}
            />
          ))}
        </div>
      </div>

      {modoLocal && (
        <div className="brio-aviso">
          <span className="brio-aviso-dot" />
          {AVISO_MODO_LOCAL}
        </div>
      )}

      {erro && <div className="brio-aviso">{erro}</div>}

      {/* ------------------------------------------- etapa: modalidade */}
      {etapaAtual === "modalidade" && (
        <>
          <h2 className="pj-titulo">Sobre o que vai ser o duelo?</h2>
          <p className="pj-sub">
            Escolha o recorte do conhecimento. Já vem marcado o modo mais equilibrado — pode jogar
            sem mexer em nada.
          </p>
          <div className="pj-opcoes pj-opcoes--duas">
            {MODALIDADES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`pj-opcao ${modalidade === m.id ? "pj-opcao--ativo" : ""}`}
                onClick={() => trocarModalidade(m.id)}
                aria-pressed={modalidade === m.id}
              >
                <span className="pj-opcao-icone" aria-hidden>
                  {m.icone}
                </span>
                <span className="pj-opcao-corpo">
                  <span className="pj-opcao-nome">{m.nome}</span>
                  <span className="pj-opcao-desc">{m.descricao}</span>
                </span>
                {m.id === "multidisciplinar" && <span className="pj-opcao-marca">RECOMENDADO</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ---------------------------------------------- etapa: assunto */}
      {etapaAtual === "assunto" && (
        <>
          <h2 className="pj-titulo">
            {modalidade === "categoria" ? "Qual área do conhecimento?" : "Qual assunto específico?"}
          </h2>
          <p className="pj-sub">
            {modalidade === "categoria"
              ? "Uma grande área — a partida mistura os assuntos dentro dela."
              : "Do nível técnico ao avançado. Escolha a área e depois o assunto."}
          </p>

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
              <h2 className="brio-secao-titulo" style={{ marginTop: "1rem" }}>
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
        </>
      )}

      {/* ------------------------------------------- etapa: adversário */}
      {etapaAtual === "adversario" && (
        <>
          <h2 className="pj-titulo">Contra quem?</h2>
          <p className="pj-sub">
            O adversário virtual responde de verdade: ele pensa entre 1 e 5 segundos antes de
            decidir, como um humano.
          </p>

          {/* O convite é SEMPRE visível — esconder fazia o jogador perguntar
              "cadê o online?". Quando não dá para convidar, o botão aparece
              desabilitado DIZENDO o motivo, em vez de sumir sem explicação. */}
          <div className="pj-opcoes pj-opcoes--duas" style={{ marginBottom: "0.7rem" }}>
              <button
                type="button"
                className={`pj-opcao ${!convite ? "pj-opcao--ativo" : ""}`}
                onClick={() => setConvite(false)}
                aria-pressed={!convite}
                data-brio-modo="virtual"
              >
                <span className="pj-opcao-icone" aria-hidden>
                  🤖
                </span>
                <span className="pj-opcao-corpo">
                  <span className="pj-opcao-nome">Adversário virtual</span>
                  <span className="pj-opcao-desc">Jogue agora, sozinho</span>
                </span>
              </button>
              <button
                type="button"
                className={`pj-opcao ${convite && conviteDisponivel ? "pj-opcao--ativo" : ""}`}
                onClick={() => conviteDisponivel && setConvite(true)}
                aria-pressed={convite && conviteDisponivel}
                disabled={!conviteDisponivel}
                title={conviteDisponivel ? undefined : motivoSemConvite}
                data-brio-modo="convite"
                data-brio-convite-indisponivel={conviteDisponivel ? undefined : "1"}
              >
                <span className="pj-opcao-icone" aria-hidden>
                  ⚔️
                </span>
                <span className="pj-opcao-corpo">
                  <span className="pj-opcao-nome">Convidar um amigo</span>
                  <span className="pj-opcao-desc">
                    {conviteDisponivel ? "Dois humanos, sala sincronizada" : motivoSemConvite}
                  </span>
                </span>
              </button>
            </div>

          {conviteEfetivo ? (
            <p className="brio-sub" style={{ marginTop: 0 }}>
              Você cria a sala e recebe um link. O duelo começa quando o convidado entrar — as
              perguntas são as mesmas para os dois, com o relógio do servidor.
            </p>
          ) : (
            <div className="pj-opcoes pj-opcoes--duas">
              {NIVEIS_ADVERSARIO.map((n) => (
                <button
                  key={n.nivel}
                  type="button"
                  className={`pj-opcao ${nivel === n.nivel ? "pj-opcao--ativo" : ""}`}
                  onClick={() => setNivel(n.nivel)}
                  aria-pressed={nivel === n.nivel}
                >
                  <span className="pj-opcao-icone" aria-hidden>
                    {"★".repeat(n.nivel)}
                    {"☆".repeat(4 - n.nivel)}
                  </span>
                  <span className="pj-opcao-corpo">
                    <span className="pj-opcao-nome">{n.nome}</span>
                    <span className="pj-opcao-desc">{n.descricao}</span>
                  </span>
                  {n.nivel === 2 && <span className="pj-opcao-marca">RECOMENDADO</span>}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ------------------------------------------------------ resumo */}
      {ultimoPasso && (
        <div className="pj-resumo">
          <div className="pj-resumo-linha">
            <span className="pj-resumo-rotulo">Assunto</span>
            <span className="pj-resumo-valor">{assuntoResumo}</span>
          </div>
          <div className="pj-resumo-linha">
            <span className="pj-resumo-rotulo">Adversário</span>
            <span className="pj-resumo-valor">
              {conviteEfetivo ? "Amigo convidado" : `${nomeAdversario} ${"★".repeat(nivel)}`}
            </span>
          </div>
          <div className="pj-resumo-linha">
            <span className="pj-resumo-rotulo">Formato</span>
            <span className="pj-resumo-valor">{DUELO.SEGUNDOS_POR_PERGUNTA} segundos por pergunta</span>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------- rodapé */}
      <div className="pj-rodape">
        {ultimoPasso ? (
          <button
            type="button"
            className="brio-btn"
            onClick={iniciar}
            disabled={carregando || !podeAvancar}
            data-brio-jogar
          >
            {carregando ? "Preparando…" : conviteEfetivo ? "Criar sala e convidar" : "Começar o duelo"}
          </button>
        ) : (
          <button
            type="button"
            className="brio-btn"
            onClick={() => setPasso((p) => p + 1)}
            disabled={!podeAvancar}
          >
            Continuar
          </button>
        )}
      </div>

      <p className="brio-sub" style={{ marginTop: "0.8rem", marginBottom: 0, textAlign: "center" }}>
        Competindo como <strong>{nomeJogador}</strong>. O índice de conhecimento é uma estimativa
        estatística da própria Cidadela — não é um QI oficial.
      </p>
    </div>
  );
}
