/**
 * GUERRA DE BRIO — componente raiz do jogo (duelo intelectual 1×1).
 *
 * Integrado à Cidadela dos Clássicos como mais um jogo: usa a MESMA sessão
 * (`userId` vem do perfil da Cidadela), o MESMO client do Supabase e a MESMA
 * identidade visual. Não cria plataforma, autenticação nem área de jogos.
 *
 * Dois caminhos:
 *   • SERVIDOR (migration aplicada): a partida é criada, cronometrada,
 *     revelada e pontuada por RPC. O cliente só espelha.
 *   • LOCAL (migration ausente): o motor `local.ts` roda as MESMAS regras e a
 *     UI avisa que o resultado não persiste.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { LobbyBrio, type EscolhaDuelo } from "./LobbyBrio";
import { CampanhaBrio } from "./CampanhaBrio";
import { LandingJogo } from "@/components/cidadela/LandingJogo";
import { LANDING_JOGOS } from "@/data/landingJogos";
import { ArenaBrio, type RespostaArena, type RodadaArena } from "./ArenaBrio";
import { ResultadoBrio } from "./ResultadoBrio";
import { RevelacaoBrio } from "./RevelacaoBrio";
import {
  backendBrioAtivo,
  criarPartida,
  entrarPartida,
  estadoPartida,
  fecharRodada,
  recalcularHabilidade,
  responder as responderRpc,
  type EstadoPartidaServidor,
  type HabilidadeLinha,
} from "@/lib/brio/api";
import {
  criarPartidaLocal,
  fecharRodadaLocal,
  partidaLocalParaUi,
  responderLocal,
  resolverDesempateLocal,
  type PartidaLocal,
} from "@/lib/brio/local";
import { NIVEIS_ADVERSARIO } from "@/lib/brio/duelo";
import {
  aplicarResultadoDuelo,
  campanhaInicial,
  campanhaIniciada,
  dueloDoAto,
  registrarPerguntas,
} from "@/lib/brio/campanha/motor";
import { carregarCampanha, salvarCampanha } from "@/lib/brio/campanha/armazenamento";
import type { DueloDoAto, EstadoCampanha } from "@/lib/brio/campanha/tipos";
import type { Letra } from "@/lib/brio/types";

interface GuerraDeBrioProps {
  /** Id do jogador autenticado (mesma sessão dos outros jogos). */
  userId: string | null;
  /** Nome exibido (treinador/perfil). */
  nomeJogador: string;
  /** Sala de convite vinda do link direto (?brio=<id>). */
  conviteInicial?: string | null;
  onBack: () => void;
}

type EstadoUi = "inicio" | "lobby" | "campanha" | "arena" | "resultado";

export function GuerraDeBrio({ userId, nomeJogador, conviteInicial, onBack }: GuerraDeBrioProps) {
  // A entrada é a PÁGINA INICIAL do jogo (marketing + explicação). O lobby de
  // configuração só aparece depois que o jogador decide jogar — antes, tudo era
  // despejado de uma vez numa única tela.
  const [estado, setEstado] = useState<EstadoUi>("inicio");
  const [partida, setPartida] = useState<EstadoPartidaServidor | null>(null);
  const [local, setLocal] = useState<PartidaLocal | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modoLocal, setModoLocal] = useState(false);
  const [habilidades, setHabilidades] = useState<HabilidadeLinha[]>([]);
  const [minhaResposta, setMinhaResposta] = useState<Letra | null>(null);
  /**
   * Rodada recém-apurada, exibida antes de seguir para a próxima. Sem isto a
   * rodada avançaria no mesmo instante e o jogador nunca veria a revelação
   * (a correta, quem acertou e a explicação).
   */
  const [revelacao, setRevelacao] = useState<{ rodada: RodadaArena; numero: number } | null>(null);
  /** Sala de convite ainda esperando o assento 2 (mostra o link para copiar). */
  const [esperandoConvidado, setEsperandoConvidado] = useState(false);
  const escolhaRef = useRef<EscolhaDuelo | null>(null);
  const sincronizandoRef = useRef(false);

  // --------------------------------------------------------------- campanha
  /** Progresso do modo história (localStorage por usuário). */
  const [campanha, setCampanha] = useState<EstadoCampanha | null>(null);
  /** Prova do ato em andamento: ao terminar, o resultado volta para a campanha. */
  const [dueloCampanha, setDueloCampanha] = useState<DueloDoAto | null>(null);
  /** Resultado da última prova, exibido dentro da campanha. */
  const [ultimoDuelo, setUltimoDuelo] = useState<
    { acertos: number; total: number; venceu: boolean; minimo: number } | null
  >(null);

  /**
   * Entrada por LINK DIRETO (?brio=<id>): o convidado ocupa o assento 2 e cai
   * direto na arena. Roda uma vez por id — o polling cuida do resto.
   */
  const conviteConsumidoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!conviteInicial || !userId) return;
    if (conviteConsumidoRef.current === conviteInicial) return;
    conviteConsumidoRef.current = conviteInicial;
    let vivo = true;
    setCarregando(true);
    void entrarPartida(conviteInicial).then((p) => {
      if (!vivo) return;
      setCarregando(false);
      if (!p) {
        setErro("Esta sala de duelo não está mais disponível. Crie uma nova no lobby.");
        return;
      }
      setModoLocal(false);
      setPartida(p);
      setEsperandoConvidado(false);
      setEstado("arena");
    });
    return () => {
      vivo = false;
    };
  }, [conviteInicial, userId]);

  useEffect(() => {
    let vivo = true;
    void backendBrioAtivo().then((ativo) => {
      if (vivo) setModoLocal(!ativo);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // Carrega o progresso da campanha do aparelho (uma vez por usuário).
  useEffect(() => {
    setCampanha(carregarCampanha(userId));
  }, [userId]);

  /** Persiste a campanha sempre que ela muda (inclusive o nome do jogador). */
  const salvarCampanhaAtual = useCallback(
    (e: EstadoCampanha) => {
      setCampanha(e);
      salvarCampanha(userId, e);
    },
    [userId],
  );

  // ------------------------------------------------------------------ iniciar
  const iniciar = useCallback(
    async (escolha: EscolhaDuelo) => {
      escolhaRef.current = escolha;
      setErro(null);
      setCarregando(true);
      setMinhaResposta(null);

      // Visitante (sem conta) joga contra o adversário virtual em modo local.
      // O duelo online (por convite) exige conta — a mesma da Cidadela.
      const ativo = userId ? await backendBrioAtivo() : false;
      if (ativo && userId) {
        const p = await criarPartida({
          modalidade: escolha.modalidade,
          areaSlug: escolha.areaSlug,
          subcategoriaSlug: escolha.subcategoriaSlug,
          // Sala de convite não tem adversário virtual: o assento 2 é humano.
          botNivel: escolha.convite ? null : escolha.nivelAdversario,
          aberta: escolha.convite,
        });
        setCarregando(false);
        if (!p) {
          setErro("Não foi possível abrir a arena agora. Tente de novo em instantes.");
          return;
        }
        setModoLocal(false);
        setPartida(p);
        // Sala de convite: o assento 2 ainda está vazio — mostra o link.
        setEsperandoConvidado(escolha.convite && p.status === "aguardando");
        setEstado("arena");
        return;
      }

      // Fallback local — mesmas regras, sem persistência.
      const p = criarPartidaLocal({
        userId: userId ?? "visitante",
        modalidade: escolha.modalidade,
        areaSlug: escolha.areaSlug,
        subcategoriaSlug: escolha.subcategoriaSlug,
        botNivel: escolha.nivelAdversario,
        semente: `${userId ?? "visitante"}:${Date.now()}`,
      });
      setCarregando(false);
      setModoLocal(true);
      setLocal(p);
      setEstado("arena");
    },
    [userId],
  );

  // -------------------------------------------------------- prova da campanha
  /**
   * Abre a prova de um ato. Usa o MESMO motor do adversário virtual
   * (`criarPartidaLocal`), com o recorte de assunto e o nível que o ato define.
   * Não cria segundo motor nem segundo placar.
   */
  const abrirDueloCampanha = useCallback(
    (duelo: DueloDoAto) => {
      setErro(null);
      setMinhaResposta(null);
      setRevelacao(null);
      setUltimoDuelo(null);
      const p = criarPartidaLocal({
        userId: userId ?? "visitante",
        modalidade: duelo.modalidade,
        areaSlug: duelo.areaSlug,
        subcategoriaSlug: duelo.subcategoriaSlug,
        botNivel: duelo.nivelAdversario,
        total: duelo.total,
        historico: campanha?.historicoPerguntas ?? [],
        // Semente por ato+tentativa: repetir a prova traz perguntas novas.
        semente: `campanha:${userId ?? "visitante"}:${duelo.titulo}:${Date.now()}`,
      });
      setDueloCampanha(duelo);
      setModoLocal(true);
      setLocal(p);
      setEstado("arena");
    },
    [userId, campanha],
  );

  /**
   * Encerra a prova: apura o resultado no motor da campanha e volta para a
   * narrativa. O ato é concluído só se atingiu o mínimo — repetir é permitido.
   */
  const encerrarProvaCampanha = useCallback(
    (acertos: number, idsDasPerguntas: string[]) => {
      const cfg = dueloCampanha;
      if (!campanha || !cfg) return;
      const agora = new Date().toISOString();
      const comHistorico = registrarPerguntas(campanha, idsDasPerguntas, agora);
      const { estado: novo, venceu } = aplicarResultadoDuelo(comHistorico, acertos, agora);
      salvarCampanhaAtual(novo);
      setUltimoDuelo({
        acertos,
        total: cfg.total,
        venceu,
        minimo: cfg.acertosMinimos,
      });
      setDueloCampanha(null);
      setLocal(null);
      setPartida(null);
      setMinhaResposta(null);
      setRevelacao(null);
      setEstado("campanha");
    },
    [campanha, dueloCampanha, salvarCampanhaAtual],
  );

  // ------------------------------------------------------------------ responder
  const responder = useCallback(
    async (letra: Letra) => {
      if (minhaResposta != null) return; // imutável
      setMinhaResposta(letra);

      if (modoLocal && local) {
        // `responderLocal` registra a minha resposta E a do adversário virtual.
        // Com as duas na mesa, a arena dispara o fechamento (sem esperar o
        // cronômetro inteiro nem agendar um segundo fechamento).
        const tempo = Date.now() - local.rodada_liberada_em;
        setLocal(responderLocal(local, letra, tempo));
        return;
      }
      if (!partida) return;
      const atualizado = await responderRpc(partida.partida_id, partida.rodada_atual, letra);
      if (atualizado) setPartida(atualizado);
    },
    [minhaResposta, modoLocal, local, partida],
  );

  // ------------------------------------------------------------------ fechar
  /**
   * Fecha a rodada e GUARDA a revelação. O avanço acontece só depois, quando
   * `continuarAposRevelacao` é chamado — assim o jogador vê a correta, quem
   * acertou e a explicação antes da próxima pergunta.
   */
  const fechar = useCallback(async () => {
    if (modoLocal && local) {
      const numeroFechado = local.rodada_atual;
      const tempo = Date.now() - local.rodada_liberada_em;
      let novo = fecharRodadaLocal(local, tempo);
      if (novo.desempate && novo.status !== "finalizado") {
        novo = resolverDesempateLocal(novo);
      }
      const rodadaRevelada = novo.rodadas[numeroFechado - 1];
      setLocal(novo);
      setMinhaResposta(null);
      if (novo.status === "finalizado") {
        // Prova da campanha: o resultado volta para a narrativa, não para a
        // tela de resultado do duelo livre.
        if (dueloCampanha) {
          setRevelacao(null);
          encerrarProvaCampanha(
            novo.acertos_1,
            novo.rodadas.map((r) => r.pergunta_id),
          );
          return;
        }
        // A última rodada vai direto ao resultado: a tela de revelação
        // esconderia o veredito final do duelo.
        setRevelacao(null);
        setEstado("resultado");
        return;
      }
      if (rodadaRevelada) {
        setRevelacao({ rodada: rodadaRevelada as RodadaArena, numero: numeroFechado });
      }
      return;
    }
    if (!partida) return;
    if (sincronizandoRef.current) return;
    sincronizandoRef.current = true;
    const numeroFechado = partida.rodada_atual;
    const atualizado = await fecharRodada(partida.partida_id);
    sincronizandoRef.current = false;
    if (!atualizado) return;
    const rodadaRevelada = atualizado.rodadas[numeroFechado - 1];
    setPartida(atualizado);
    setMinhaResposta(null);
    if (atualizado.status === "finalizado") {
      // A última rodada vai direto ao resultado (a revelação esconderia o
      // veredito final do duelo).
      setRevelacao(null);
      setEstado("resultado");
      // Pede ao servidor para recalcular a TRI a partir do histórico real.
      void recalcularHabilidade().then((h) => setHabilidades(h));
      return;
    }
    if (rodadaRevelada) {
      revelacaoVistaRef.current = Math.max(revelacaoVistaRef.current, numeroFechado);
      setRevelacao({ rodada: rodadaRevelada as RodadaArena, numero: numeroFechado });
    }
  }, [modoLocal, local, partida, dueloCampanha, encerrarProvaCampanha]);

  /** Sai da tela de revelação e libera a próxima rodada. */
  const continuarAposRevelacao = useCallback(() => {
    setRevelacao(null);
  }, []);



  // ------------------------------------------------------------------ revanche
  const revanche = useCallback(() => {
    const escolha = escolhaRef.current;
    setPartida(null);
    setLocal(null);
    setMinhaResposta(null);
    setHabilidades([]);
    // Sem isto a revelação da última rodada voltaria a ser renderizada no
    // lugar da arena nova (o estado sobrevive ao reinício da partida).
    setRevelacao(null);
    setEstado("lobby");
    if (escolha) void iniciar(escolha);
  }, [iniciar]);

  // ----------------------------------------------------------------- campanha
  /**
   * Abre o modo história. Cria a campanha na primeira vez (com o nome do
   * jogador como protagonista) e retoma de onde parou nas seguintes.
   */
  const abrirCampanha = useCallback(() => {
    const existente = campanha ?? carregarCampanha(userId);
    const base = existente ?? campanhaInicial({ nome: nomeJogador });
    const agora = new Date().toISOString();
    const iniciada: EstadoCampanha = {
      ...base,
      iniciadaEm: base.iniciadaEm ?? agora,
      atualizadaEm: agora,
    };
    salvarCampanhaAtual(iniciada);
    setUltimoDuelo(null);
    setErro(null);
    setEstado("campanha");
  }, [campanha, userId, nomeJogador, salvarCampanhaAtual]);

  // ------------------------------------------------------------------ derivados
  const visao = useMemo(() => {
    if (modoLocal && local) {
      const ui = partidaLocalParaUi(local);
      return {
        ...ui,
        nomeOponente: NIVEIS_ADVERSARIO.find((n) => n.nivel === local.bot_nivel)?.nome ?? "Adversário",
        oponenteBot: true,
      };
    }
    if (partida) {
      return {
        ...partida,
        nomeOponente: partida.bot_nivel
          ? (NIVEIS_ADVERSARIO.find((n) => n.nivel === partida.bot_nivel)?.nome ?? "Adversário virtual")
          : "Adversário",
        oponenteBot: partida.bot_nivel != null,
      };
    }
    return null;
  }, [modoLocal, local, partida]);

  const rodadaAtual = useMemo<RodadaArena | null>(() => {
    if (!visao) return null;
    const r = visao.rodadas[visao.rodada_atual - 1];
    if (!r) return null;
    return r as RodadaArena;
  }, [visao]);

  // -------------------------------------------------------------- sincronia
  /**
   * Sincroniza o estado com o SERVIDOR (autoridade da partida):
   *
   *  - sala de convite: espera o assento 2 e começa quando o convidado entra;
   *  - durante a partida: traz a resposta do adversário e a revelação, para
   *    que quem respondeu primeiro aguarde o outro (o relógio é do servidor).
   */
  /**
   * Maior rodada cuja revelação JÁ foi mostrada. Sem isto o polling (1,5s)
   * reabriria a revelação logo depois de o jogador tocar em "próxima".
   */
  const revelacaoVistaRef = useRef(0);

  useEffect(() => {
    if (modoLocal || !partida) return;
    const id = window.setInterval(async () => {
      if (sincronizandoRef.current) return;
      sincronizandoRef.current = true;
      const atual = await estadoPartida(partida.partida_id);
      sincronizandoRef.current = false;
      if (!atual) return;
      // O convidado entrou: a sala saiu de 'aguardando'.
      if (atual.status !== "aguardando") setEsperandoConvidado(false);

      setPartida(atual);

      if (atual.status === "finalizado") {
        setRevelacao(null);
        setEstado("resultado");
        void recalcularHabilidade().then((h) => setHabilidades(h));
        return;
      }

      // O servidor AVANÇA `rodada_atual` ao apurar. Então a rodada recém
      // fechada é a anterior: se o número andou, ela foi revelada (pelo
      // adversário ou pelo relógio do servidor).
      const fechada = atual.rodada_atual - 1;
      if (fechada >= 1 && fechada > revelacaoVistaRef.current) {
        const rodada = atual.rodadas[fechada - 1];
        if (rodada?.revelada) {
          revelacaoVistaRef.current = fechada;
          setMinhaResposta(null);
          setRevelacao({ rodada: rodada as RodadaArena, numero: fechada });
        }
      }
    }, 1500);
    return () => window.clearInterval(id);
  }, [modoLocal, partida]);

  // -------------------------------------------------------------- revelação
  // A rodada apurada ganha uma tela própria: o jogador vê a correta, quem
  // acertou e a explicação. Depois de alguns segundos (ou no toque) segue.
  useEffect(() => {
    if (!revelacao) return;
    if (estado === "resultado") return; // o resultado final tem precedência
    const id = window.setTimeout(() => setRevelacao(null), 4200);
    return () => window.clearTimeout(id);
  }, [revelacao, estado]);

  // -------------------------------------------------------------- render
  // Visitante joga contra o adversário virtual em modo local; a conta (mesma
  // da Cidadela) é exigida apenas para o duelo online/ranqueado.
  const idEfetivo = userId ?? "visitante";

  // Sala de convite aberta: mostra o link para o amigo entrar.
  if (esperandoConvidado && partida) {
    return (
      <>
        <BackButton />
        <div className="brio-app">
          <span className="brio-badge">Duelo intelectual 1×1</span>
          <h1 className="brio-titulo">Sala aberta</h1>
          <p className="brio-sub">
            Envie o link para o seu adversário. O duelo começa sozinho assim que ele entrar — as
            perguntas são as mesmas para os dois.
          </p>
          <div className="brio-painel">
            <h2 className="brio-secao-titulo">Link do convite</h2>
            <p className="brio-referencia" data-brio-link style={{ wordBreak: "break-all" }}>
              {linkConvite(partida.partida_id)}
            </p>
            <div className="brio-acoes" style={{ marginTop: "0.8rem" }}>
              <button
                type="button"
                className="brio-btn"
                onClick={() => void copiarLink(linkConvite(partida.partida_id))}
              >
                Copiar link
              </button>
            </div>
          </div>
          <div className="brio-espera">
            <span className="brio-espera-dot" />
            Aguardando o adversário entrar…
          </div>
          <p className="brio-sub">
            Competindo como <strong>{nomeJogador}</strong>.
          </p>
        </div>
      </>
    );
  }

  // -------------------------------------------------------- página inicial
  if (estado === "inicio") {
    return (
      <>
        <BackButton />
        <LandingJogo
          conteudo={LANDING_JOGOS["brio"]!}
          rotuloJogar="Jogar agora"
          notaRodape={`Competindo como ${nomeJogador}.`}
          onVoltar={onBack}
          onJogar={() => setEstado("lobby")}
          extra={
            <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.9rem" }}>
              <button
                type="button"
                className="lj-ajuda-btn"
                style={{ width: "100%", justifyContent: "center", padding: "0.8rem" }}
                onClick={abrirCampanha}
                data-brio-historia
              >
                📜 {campanhaIniciada(campanha) ? "Continuar o modo história" : "Começar o modo história"}
              </button>
            </div>
          }
        />
      </>
    );
  }

  if (estado === "lobby") {
    return (
      <>
        <BackButton />
        <LobbyBrio
          nomeJogador={nomeJogador}
          onIniciar={iniciar}
          carregando={carregando}
          erro={erro}
          podeConvidar={Boolean(userId)}
          onVoltar={() => setEstado("inicio")}
        />
      </>
    );
  }

  // ------------------------------------------------------------- campanha
  if (estado === "campanha" && campanha) {
    return (
      <>
        <BackButton />
        <CampanhaBrio
          estado={campanha}
          onEstado={salvarCampanhaAtual}
          onAbrirDuelo={abrirDueloCampanha}
          onSair={() => setEstado("inicio")}
          ultimoDuelo={ultimoDuelo}
          onLimparUltimoDuelo={() => setUltimoDuelo(null)}
        />
      </>
    );
  }

  if (estado === "resultado" && visao) {
    return (
      <>
        <BackButton />
        <div className="brio-app">
          <ResultadoBrio
            visao={visao}
            meuId={idEfetivo}
            nomeEu={nomeJogador}
            modoLocal={modoLocal}
            habilidades={habilidades}
            onRevanche={revanche}
            onSair={() => {
              setPartida(null);
              setLocal(null);
              setEstado("lobby");
            }}
          />
        </div>
      </>
    );
  }

  if (!visao || !rodadaAtual) {
    return (
      <div className="brio-app">
        <BackButton />
        <span className="brio-badge">Duelo intelectual 1×1</span>
        <h1 className="brio-titulo">Guerra de Brio</h1>
        <div className="brio-espera" style={{ marginTop: "1rem" }}>
          <span className="brio-espera-dot" />
          Montando a arena…
        </div>
      </div>
    );
  }

  const meuPlacar = visao.jogador_1_id === idEfetivo ? visao.placar_1 : visao.placar_2;
  const placarOponente = visao.jogador_1_id === idEfetivo ? visao.placar_2 : visao.placar_1;

  // A rodada apurada tem tela própria — a próxima pergunta só entra depois.
  if (revelacao) {
    return (
      <>
        <BackButton />
        <div className="brio-app">
          <RevelacaoBrio
            rodada={revelacao.rodada}
            numero={revelacao.numero}
            totalRodadas={visao.total_perguntas}
            meuId={idEfetivo}
            nomeEu={nomeJogador}
            nomeOponente={visao.nomeOponente}
            placarEu={meuPlacar}
            placarOponente={placarOponente}
            respostas={visao.respostas as RespostaArena[]}
            minhaResposta={minhaRespostaDaRodada(visao.respostas as RespostaArena[], revelacao.numero, idEfetivo)}
            onContinuar={continuarAposRevelacao}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <BackButton />
      <div className="brio-app">
        <ArenaBrio
          rodada={rodadaAtual}
          rodadaAtual={visao.rodada_atual}
          totalRodadas={visao.total_perguntas}
          segundosPorPergunta={visao.segundos_por_pergunta}
          liberadaEm={visao.rodada_liberada_em ?? new Date().toISOString()}
          meuId={idEfetivo}
          nomeEu={nomeJogador}
          nomeOponente={visao.nomeOponente}
          oponenteBot={visao.oponenteBot}
          placarEu={meuPlacar}
          placarOponente={placarOponente}
          respostas={visao.respostas as RespostaArena[]}
          minhaResposta={minhaResposta}
          desempate={visao.desempate}
          onResponder={responder}
          onFechar={fechar}
          aguardando={false}
        />
      </div>
    </>
  );
}

/** Link direto do convite — o mesmo padrão de `?mesa=`/`?camp=` da Cidadela. */
function linkConvite(partidaId: string): string {
  if (typeof window === "undefined") return `?brio=${partidaId}`;
  return `${window.location.origin}/cidadela?brio=${partidaId}`;
}

/** Copia o link do convite (com fallback silencioso se o clipboard negar). */
async function copiarLink(link: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(link);
  } catch {
    /* clipboard bloqueado: o link continua visível na tela */
  }
}

/** A letra que EU marquei numa rodada (usada na tela de revelação). */
function minhaRespostaDaRodada(
  respostas: RespostaArena[],
  numero: number,
  meuId: string,
): Letra | null {
  return respostas.find((r) => r.rodada === numero && r.jogador_id === meuId)?.letra ?? null;
}
