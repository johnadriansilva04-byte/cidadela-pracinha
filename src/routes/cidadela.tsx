import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Target, Trophy, Crown, Grid3X3, IdCard } from "lucide-react";
import { TrilhaGame } from "@/components/trilha/TrilhaGame";
import { TrilhaLoadingScreen } from "@/components/trilha/TrilhaLoadingScreen";
import { TrilhaOnlineLobby } from "@/components/trilha/TrilhaOnlineLobby";
import { BotaoGame } from "@/components/botao/BotaoGame";
import { ConviteMesaScreen } from "@/components/botao/online/ConviteMesaScreen";
import { CarBrawlGame } from "@/components/carbrawl/CarBrawlGame";
import { CarBrawlLoadingScreen } from "@/components/carbrawl/CarBrawlLoadingScreen";
import { OnboardingGate } from "@/components/cidadela/OnboardingGate";
import { TourContextual, type PassoTour } from "@/components/cidadela/TourContextual";
import { CidadelaEmblem } from "@/components/CidadelaBranding";
import { CelularFixo } from "@/components/CelularFixo";
import { ProfissaoSelect } from "@/components/cidadela/ProfissaoSelect";
import { CampusHub } from "@/components/campus/CampusHub";
import { EmpresarioHub } from "@/components/comercial/EmpresarioHub";
import { LaboratorioHub } from "@/components/laboratorio/LaboratorioHub";
import { FootballLoadingScreen } from "@/components/botao/FootballLoadingScreen";
import { useBotaoAuth } from "@/components/botao/online/useBotaoAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import { InfoModal } from "@/components/InfoModal";
import { SEO_CONTENT } from "@/data/seoContent";
import {
  carregarPerfilCidadela,
  escolherProfissao,
  profissaoById,
  type CidadelaPerfil,
  type ProfissaoId,
} from "@/lib/cidadela/profissoes";
import { useCelularCarreira } from "@/hooks/useCelularCarreira";
import { loadProgressFromSupabase } from "@/components/botao/storage";
import { loadCareerFromSupabase } from "@/components/botao/career/careerRemote";
import { missoesTrilha } from "@/components/botao/career/trilhaIntegracao";
import { BolsaResumoCard } from "@/components/financial/BolsaResumoCard";
import { BackButton } from "@/components/BackButton";
import { ChessGameView } from "@/components/universal/ChessGameView";
import { CheckersGameView } from "@/components/universal/CheckersGameView";
import { BlackjackGameView } from "@/components/universal/BlackjackGameView";
import { DominoGameView } from "@/components/universal/DominoGameView";
import { YahtzeeGameView } from "@/components/universal/YahtzeeGameView";
import { ConnectFourGameView } from "@/components/universal/ConnectFourGameView";
import { TicTacToeGameView } from "@/components/universal/TicTacToeGameView";
import { ReversiGameView } from "@/components/universal/ReversiGameView";
import { MancalaGameView } from "@/components/universal/MancalaGameView";

export const Route = createFileRoute("/cidadela")({
  head: () => ({
    meta: [
      { title: "Cidadela de Jogos | Cidadela do Pracinha" },
      {
        name: "description",
        content:
          "Conheça nossa cidadela de jogos clássicos. Trilha, dado, forca, jogo da velha e muito mais.",
      },
      { property: "og:title", content: "Cidadela de Jogos | Cidadela do Pracinha" },
      {
        property: "og:description",
        content:
          "Conheça nossa cidadela de jogos clássicos. Trilha, dado, forca, jogo da velha e muito mais.",
      },
      { property: "og:url", content: "https://pracinha.online/cidadela" },
      { property: "og:image", content: "https://pracinha.online/artes/cidadela-icon-og.jpeg" },
    ],
  }),
  component: Cidadela,
});

// #BRIO: Adicionar biblioteca e forja ao tipo Game
type Game =
  | "trilha"
  | "dado"
  | "forca"
  | "jogodavelha"
  | "botao"
  | "online"
  | "campeonato"
  | "campus"
  | "comercial"
  | "laboratorio"
  | "carbrawl"
  | "xadrez"
  | "dama"
  | "blackjack"
  | "domino"
  | "yahtzee"
  | "liga4"
  | "velha"
  | "reversi"
  | "mancala"
  | null;

const GAMES = [
  {
    id: "botao" as Game,
    label: "Futebol",
    description: "Estádio do Campus",
    icon: Trophy,
    status: "disponível",
  },
  {
    id: "trilha" as Game,
    label: "Trilha",
    description: "Estratégia",
    icon: Target,
    status: "disponível",
  },
  {
    id: "xadrez" as Game,
    label: "Xadrez",
    description: "Tática clássica",
    icon: Crown,
    status: "disponível",
  },
  {
    id: "carbrawl" as Game,
    label: "Car Brawl",
    description: "Sumo de carros",
    icon: Trophy,
    status: "disponível",
  },
  {
    id: "dama" as Game,
    label: "Dama",
    description: "Capturas",
    icon: Grid3X3,
    status: "disponível",
  },
  {
    id: "blackjack" as Game,
    label: "Blackjack",
    description: "21 pontos",
    icon: IdCard,
    status: "disponível",
  },
  {
    id: "domino" as Game,
    label: "Dominó",
    description: "Encaixe",
    icon: Grid3X3,
    status: "disponível",
  },
  {
    id: "yahtzee" as Game,
    label: "Yahtzee",
    description: "Dados e sorte",
    icon: Target,
    status: "disponível",
  },
  {
    id: "liga4" as Game,
    label: "Liga 4",
    description: "Alinhe quatro",
    icon: Grid3X3,
    status: "disponível",
  },
  {
    id: "velha" as Game,
    label: "Jogo da Velha",
    description: "Três em linha",
    icon: Grid3X3,
    status: "disponível",
  },
  {
    id: "reversi" as Game,
    label: "Reversi",
    description: "Vire peças",
    icon: Target,
    status: "disponível",
  },
  {
    id: "mancala" as Game,
    label: "Mancala",
    description: "Semeie e capture",
    icon: Target,
    status: "disponível",
  },
];

function CidadelaCompView() {
  const [hydrated, setHydrated] = useState(false);
  const [activeGame, setActiveGame] = useState<Game>(null);
  // §11-§13: convite de mesa via link direto (?mesa=mesa_xxx) — abre o fluxo
  // do convidado (3 propostas de clube + cadastro rápido), nunca cai no hub.
  // §link-camp: convite de campeonato (?camp=CAMP-...) — mesma lógica.
  // §link-trilha: convite de mesa de trilha (?mesaTrilha=trilha_xxx) — entra direto no jogo.
  const [conviteMesaId, setConviteMesaId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("mesa");
  });
  const [conviteCampCodigo, setConviteCampCodigo] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("camp");
  });
  const [conviteMesaTrilhaId, setConviteMesaTrilhaId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("mesaTrilha");
  });
  const passosTour: PassoTour[] =
    activeGame === "botao" ? PASSOS_TOUR_FUTEBOL : activeGame === "trilha" ? PASSOS_TOUR_TRILHA : [];
  const [loadingGame, setLoadingGame] = useState<"botao" | "trilha" | "carbrawl" | null>(null);
  const [activeModal, setActiveModal] = useState<"sobre" | "como" | "soberania" | null>(null);
  const [perfilCidadela, setPerfilCidadela] = useState<CidadelaPerfil | null>(null);
  const [mostrarProfissoes, setMostrarProfissoes] = useState(false);
  // Login da Cidadela: se não houver sessão, pede conta no hub (o Futebol
  // continua jogável como visitante). "Loguei" → aplicarPerfil do hook.
  const [continuarComoVisitante, setContinuarComoVisitante] = useState(false);
  const { perfil, carregando: carregandoAuth } = useBotaoAuth();
  // Celular central: carreira + handlers vêm do hook único (mesma fiação do
  // Modo Carreira — responder/escolher/excluir persistem no Supabase).
  const {
    career,
    saldoSov,
    onEnviarMensagem: handleEnviarMensagemCelular,
    onEscolhaRpg: handleEscolhaRpgCelular,
    onExcluirConversa: handleExcluirConversaCelular,
    onRegistrarPosicao: handleRegistrarPosicaoCelular,
  } = useCelularCarreira(perfil?.user_id ?? null, perfil);

  // Identidade na Cidadela: carrega a profissão do jogador autenticado.
  useEffect(() => {
    const uid = perfil?.user_id;
    if (!uid) {
      setPerfilCidadela(null);
      return;
    }
    let vivo = true;
    void carregarPerfilCidadela(uid).then((p) => {
      if (vivo) setPerfilCidadela(p);
    });
    return () => {
      vivo = false;
    };
  }, [perfil?.user_id]);

  // Sessão ativa da ABA: o jogo aberto (Estádio/Trilha) sobrevive a F5 via
  // sessionStorage (por aba) — uma aba/login novo sempre entra com estado
  // limpo. Chave antiga em localStorage é removida de vez.
  // Quando ?hub=1 está na URL (volta do BackButton), força o hub — limpa
  // o sessionStorage e não restaura nenhum jogo ativo.
  const JOGO_ATIVO_KEY = "cidadela:jogo-ativo:v1";
  useEffect(() => {
    window.localStorage.removeItem("cidadela_active_game");
    try {
      // Se voltou pelo BackButton (?hub=1), limpa estado e mostra hub
      const params = new URLSearchParams(window.location.search);
      if (params.get("hub") === "1") {
        window.sessionStorage.removeItem(JOGO_ATIVO_KEY);
        // Limpa o param da URL sem reload
        window.history.replaceState({}, "", "/cidadela");
        return;
      }
      const salvo = window.sessionStorage.getItem(JOGO_ATIVO_KEY);
      if (salvo === "botao" || salvo === "trilha") setActiveGame(salvo);
    } catch {
      /* storage indisponível */
    }
  }, []);

  useEffect(() => {
    try {
      if (activeGame) window.sessionStorage.setItem(JOGO_ATIVO_KEY, activeGame);
      else window.sessionStorage.removeItem(JOGO_ATIVO_KEY);
    } catch {
      /* storage indisponível */
    }
    // Notifica o BackButton global sobre mudança de jogo
    window.dispatchEvent(new CustomEvent("cidadela:game-changed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGame]);

  const handleEscolherProfissao = async (profissao: ProfissaoId) => {
    const uid = perfil?.user_id;
    if (!uid) return;
    const atualizado = await escolherProfissao(uid, profissao);
    setPerfilCidadela(atualizado);
    setMostrarProfissoes(false);
  };

  // Promessa de hidratação disparada ao clicar em Futebol — o FootballLoadingScreen
  // aguarda junto com a animação, para que o BotaoGame monte com dados já prontos
  // (sem flash do LoadingScreen interno).
  const [hidratacaoFutebol, setHidratacaoFutebol] = useState<Promise<unknown> | null>(null);

  // Login único global: ao entrar sem conta, abre o AuthModal UMA vez
  // por aba (guard no AuthProvider). O visitante pode fechar e seguir local.
  const { pedirLogin, aoContinuarSemConta } = useAuth();
  const jaPediuRef = useRef(false);
  useEffect(() => {
    if (
      !carregandoAuth &&
      !perfil &&
      !continuarComoVisitante &&
      !conviteMesaId &&
      !conviteCampCodigo &&
      !conviteMesaTrilhaId &&
      !activeGame &&
      !jaPediuRef.current
    ) {
      jaPediuRef.current = true;
      pedirLogin("cidadela");
    }
  }, [carregandoAuth, perfil, continuarComoVisitante, conviteMesaId, conviteCampCodigo, conviteMesaTrilhaId, activeGame, pedirLogin]);

  // Quando o visitante escolhe "Continuar sem conta" no AuthModal global
  useEffect(() => {
    return aoContinuarSemConta(() => setContinuarComoVisitante(true));
  }, [aoContinuarSemConta]);

  const openModal = (type: "sobre" | "como" | "soberania") => setActiveModal(type);
  const closeModal = () => setActiveModal(null);

  const handleGameSelect = (game: Game) => {
    // Futebol: mostra tela de loading temática ANTES de abrir o BotaoGame.
    // Dispara hidratação em paralelo — o FootballLoadingScreen aguarda
    // a promise para que o BotaoGame monte com dados já prontos.
    if (game === "botao") {
      if (perfil?.user_id) {
        setHidratacaoFutebol(
          Promise.all([
            loadProgressFromSupabase(perfil.user_id),
            loadCareerFromSupabase(perfil.user_id),
          ]).catch(() => {}),
        );
      }
      setLoadingGame(game);
      return;
    }
    if (game === "trilha") {
      setLoadingGame(game);
      return;
    }
    if (game === "carbrawl") {
      setLoadingGame(game);
      return;
    }
    if (game === "campus" || game === "comercial" || game === "laboratorio") {
      setActiveGame(game);
      return;
    }
    // Jogos do sistema universal
    if (
      game === "xadrez" ||
      game === "dama" ||
      game === "blackjack" ||
      game === "domino" ||
      game === "yahtzee" ||
      game === "liga4" ||
      game === "velha" ||
      game === "reversi" ||
      game === "mancala"
    ) {
      setActiveGame(game);
      return;
    }
    // Jogos em breve não fazem nada
    console.log("Jogo em breve:", game);
  };

  // REMOVIDO: Loading inicial da Cidadela (F5)
  // Só mostra loading ao entrar em jogos específicos
  if (!hydrated) {
    setHydrated(true);
  }

  // §11-§13: link de convite de mesa — o convidado escolhe o clube e entra.
  // Jogador JÁ autenticado pula o convite: vai direto para a mesa.
  if (conviteMesaId) {
    if (perfil?.user_id) {
      const mesaAlvo = conviteMesaId;
      return (
        <BotaoGame
          mesaConviteInicial={mesaAlvo}
          onBack={() => setConviteMesaId(null)}
        />
      );
    }
    return (
      <ConviteMesaScreen
        mesaId={conviteMesaId}
        onPronto={() => {
          // Conta criada + associada: entra DIRETO na mesa (link específico),
          // nunca no hub genérico.
          setActiveGame("botao");
        }}
        onCancelar={() => setConviteMesaId(null)}
      />
    );
  }

  // §link-camp: link direto do campeonato — o convidado cai direto na sala.
  if (conviteCampCodigo) {
    if (perfil?.user_id) {
      return (
        <BotaoGame
          campCodigoInicial={conviteCampCodigo}
          onBack={() => setConviteCampCodigo(null)}
        />
      );
    }
    return (
      <ConviteMesaScreen
        codigoCampeonato={conviteCampCodigo}
        modo="campeonato"
        onPronto={() => {
          setActiveGame("botao");
        }}
        onCancelar={() => setConviteCampCodigo(null)}
      />
    );
  }

  // §link-trilha: link direto de mesa de trilha — abre o lobby online direto na mesa.
  if (conviteMesaTrilhaId) {
    return (
      <TrilhaGame
        mesaInicial={conviteMesaTrilhaId}
        onBack={() => setConviteMesaTrilhaId(null)}
      />
    );
  }

  // Portão de identidade: jogador autenticado sem profissão escolhe quem é
  // na Cidadela antes de seguir. Pode ser reaberto pelo botão "Profissão".
  if (
    perfilCidadela &&
    perfil?.user_id &&
    (mostrarProfissoes || !perfilCidadela.profissao_atual)
  ) {
    return (
      <ProfissaoSelect
        perfil={perfilCidadela}
        nomeJogador={perfil?.nome}
        onEscolher={handleEscolherProfissao}
      />
    );
  }

  if (loadingGame === "trilha") {
    return (
      <TrilhaLoadingScreen
        categoria="DICAS"
        duracao={2600}
        onCompleto={() => {
          setLoadingGame(null);
          setActiveGame("trilha");
        }}
      />
    );
  }

  if (loadingGame === "carbrawl") {
    return (
      <CarBrawlLoadingScreen
        onCompleto={() => {
          setLoadingGame(null);
          setActiveGame("carbrawl");
        }}
      />
    );
  }

  if (loadingGame === "botao") {
    return (
      <FootballLoadingScreen
        waitFor={hidratacaoFutebol ?? undefined}
        onCompleto={() => {
          setHidratacaoFutebol(null);
          setLoadingGame(null);
          setActiveGame("botao");
        }}
      />
    );
  }

  if (activeGame === "trilha") {
    return <TrilhaGame onBack={() => setActiveGame(null)} />;
  }

  if (activeGame === "campus") {
    return (
      <CampusHub
        userId={perfil?.user_id ?? null}
        perfil={perfilCidadela}
        onPerfilAtualizado={setPerfilCidadela}
        onVoltar={() => setActiveGame(null)}
      />
    );
  }

  if (activeGame === "comercial") {
    return (
      <EmpresarioHub
        userId={perfil?.user_id ?? null}
        perfil={perfilCidadela}
        onPerfilAtualizado={setPerfilCidadela}
        onVoltar={() => setActiveGame(null)}
        extras={<BolsaResumoCard bolsa={career?.bolsa} />}
      />
    );
  }

  if (activeGame === "laboratorio") {
    return (
      <LaboratorioHub
        userId={perfil?.user_id ?? null}
        perfil={perfilCidadela}
        onPerfilAtualizado={setPerfilCidadela}
        onVoltar={() => setActiveGame(null)}
      />
    );
  }

  if (activeGame === "carbrawl") {
    return <CarBrawlGame onBack={() => setActiveGame(null)} />;
  }

  if (activeGame === "botao") {
    return <BotaoGame onBack={() => setActiveGame(null)} initialHydrated />;
  }

  if (activeGame === "xadrez") {
    return <ChessGameView onBack={() => setActiveGame(null)} />;
  }

  if (activeGame === "dama") {
    return <CheckersGameView onBack={() => setActiveGame(null)} />;
  }

  if (activeGame === "blackjack") {
    return <BlackjackGameView onBack={() => setActiveGame(null)} />;
  }

  if (activeGame === "domino") {
    return <DominoGameView onBack={() => setActiveGame(null)} />;
  }

  if (activeGame === "yahtzee") {
    return <YahtzeeGameView onBack={() => setActiveGame(null)} />;
  }

  if (activeGame === "liga4") {
    return <ConnectFourGameView onBack={() => setActiveGame(null)} />;
  }

  if (activeGame === "velha") {
    return <TicTacToeGameView onBack={() => setActiveGame(null)} />;
  }

  if (activeGame === "reversi") {
    return <ReversiGameView onBack={() => setActiveGame(null)} />;
  }

  if (activeGame === "mancala") {
    return <MancalaGameView onBack={() => setActiveGame(null)} />;
  }

  return (
    <>
      <BackButton />
      <div className="flex min-h-screen flex-col items-center gap-4 p-3 md:p-6">
        <main className="painel my-auto w-full max-w-3xl rounded-3xl p-5 shadow-2xl md:p-8">
          <header className="mb-6 flex flex-col items-center text-center">
            <CidadelaEmblem className="mb-3 h-16 w-16 drop-shadow-lg md:h-20 md:w-20" />
            <h1 className="texto-marca text-4xl font-black tracking-tight md:text-5xl">
              Cidadela dos Clássicos
            </h1>
            <p className="mt-2 text-sm font-medium text-muted-foreground md:text-base">
              Jogos do Campus
            </p>
            {perfilCidadela?.profissao_atual && (
              <div className="mt-3">
                <button
                  onClick={() => setMostrarProfissoes(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-bold text-amber-300 transition hover:bg-amber-400/20"
                >
                  <IdCard className="size-4" />
                  {profissaoById(perfilCidadela.profissao_atual)?.nome ?? "Profissão"} · Nv.{" "}
                  {perfilCidadela.nivel_cidadela}
                </button>
              </div>
            )}
          </header>

          {/* Acontecimentos/notificações chegam ao celular (§1) — Cidadela limpa. */}

          <div className="mb-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {GAMES.map((game) => {
                const Icon = game.icon;
                const isAvailable = game.status === "disponível";
                return (
                  <button
                    key={game.id}
                    onClick={() => isAvailable && handleGameSelect(game.id)}
                    disabled={!isAvailable}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 w-full text-left ${
                      isAvailable
                        ? "border-white/10 bg-gradient-to-r from-white/5 to-white/[0.02] hover:border-primary/50 hover:bg-primary/10 hover:shadow-lg hover:shadow-primary/10 cursor-pointer active:scale-[0.98] hover:-translate-y-0.5"
                        : "border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed grayscale"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${isAvailable ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground text-sm">{game.label}</h3>
                      <p className="text-xs text-muted-foreground">{game.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </main>

        {/* Footer com links obrigatórios */}
        <footer className="w-full max-w-3xl text-center">
          <div className="mb-3 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
            <button onClick={() => openModal("sobre")} className="hover:text-primary transition-colors">
              Sobre a Pracinha
            </button>
            <span>•</span>
            <button onClick={() => openModal("como")} className="hover:text-primary transition-colors">
              Como Jogar
            </button>
            <span>•</span>
            <button onClick={() => openModal("soberania")} className="hover:text-primary transition-colors">
              SOV
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
            <Link to="/privacidade" className="hover:text-primary transition-colors">
              Política de Privacidade
            </Link>
            <span>•</span>
            <Link to="/termos" className="hover:text-primary transition-colors">
              Termos de Uso
            </Link>
          </div>
        </footer>
      </div>
      {/* Modais de Informação */}
      <InfoModal
        isOpen={activeModal === "sobre"}
        onClose={closeModal}
        title="Sobre a Pracinha Online"
        content={SEO_CONTENT.sobrePracinha}
      />
      <InfoModal
        isOpen={activeModal === "como"}
        onClose={closeModal}
        title="Como Jogar"
        content={SEO_CONTENT.comoJogar}
      />
      <InfoModal
        isOpen={activeModal === "soberania"}
        onClose={closeModal}
        title="Economia SOV"
        content={SEO_CONTENT.soberania}
      />

      {/* Celular fixo no cantinho da tela — componente central, mesmos
          handlers do Modo Carreira (responder/escolher/excluir persistem). */}
      <CelularFixo
        userId={perfil?.user_id ?? null}
        nomeJogador={career?.coach.apelido || career?.coach.nome || perfil?.nome || null}
        perfilCidadela={perfilCidadela}
        conversas={career?.conversas ?? []}
        desafioPatrocinador={career?.desafioPatrocinador ?? null}
        feed={career?.feedCidadela ?? []}
        trilhaMissoes={career ? missoesTrilha(career) : []}
        onEnviarMensagem={handleEnviarMensagemCelular}
        onExcluirConversa={handleExcluirConversaCelular}
        onEscolhaRpg={handleEscolhaRpgCelular}
        onRegistrarPosicao={handleRegistrarPosicaoCelular}
        historia={career?.historia}
        naoLidas={career?.conversas?.filter((c) => c.naoLida).length ?? 0}
        saldoSov={saldoSov}
        clube={
          career
            ? {
                nome: perfil?.time_personalizado || "Clube",
                caixa: career.clubeCaixa ?? 0,
                extrato: career.clubeExtrato ?? [],
              }
            : undefined
        }
        bolsa={career?.bolsa}
        statsCarreira={
          career
            ? {
                decisoes:
                  (career.historia?.ledger.length ?? 0) +
                  (Array.isArray(career.ultimasEscolhas) ? career.ultimasEscolhas.length : 0),
                entrevistas: Array.isArray(career.entrevistas) ? career.entrevistas.length : 0,
              }
            : undefined
        }
      />

      {/* Tour contextual: bolhas ancoradas nos elementos reais do módulo
          escolhido (TRILHA/FUTEBOL). O hub NÃO tem tour — o usuário escolhe
          o módulo antes (§4-§7 do prompt mestre). */}
      <TourContextual userId={perfil?.user_id ?? null} passos={passosTour} />
    </>
  );
}

const PASSOS_TOUR_FUTEBOL: PassoTour[] = [
  { alvo: "perfil", titulo: "Meu Time", texto: "Personalize seu time: cores, tática e nomes dos botões — sem precisar de login." },
  { alvo: "carreira", titulo: "Carreira no Campus", texto: "Aqui fica a sua carreira: partidas do Brasileirão, Copa do Brasil, classificação e economia." },
  { alvo: "trofeus", titulo: "Sala de troféus", texto: "Seus títulos e conquistas ficam guardados aqui." },
  { alvo: "celular", titulo: "Seu celular", texto: "Mensagens do clube, recompensas em SOV, missões e notícias chegam aqui." },
];
const PASSOS_TOUR_TRILHA: PassoTour[] = [
  { alvo: "trilha-trofeus", titulo: "Troféus da Trilha", texto: "Suas conquistas na Trilha e o progresso do capítulo ficam aqui." },
  { alvo: "celular", titulo: "Seu celular", texto: "Mensagens, recompensas em SOV e missões chegam aqui — o mesmo celular de todo o jogo." },
];

// OnboardingGate: tour obrigatório do iniciante antes do hub (§2).
function Cidadela() {
  return (
    <OnboardingGate destinoInicial="cidadela">
      <CidadelaCompView />
    </OnboardingGate>
  );
}
