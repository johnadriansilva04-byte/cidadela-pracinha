/**
 * PÁGINA INICIAL de um jogo da Cidadela.
 *
 * O problema que isto resolve: a entrada de um jogo despejava TODAS as opções
 * de uma vez — modalidade, subcategoria, nível de adversário, texto legal —
 * e o jogador caía num formulário sem entender o que estava escolhendo.
 *
 * Agora a primeira tela é uma página de apresentação: identidade, promessa,
 * pilares, e um botão grande para começar. O detalhe completo (regras, modos,
 * como pontua, avisos) fica ATRÁS DO "?" — quem quer saber, clica; quem quer
 * jogar, joga.
 *
 * É o MESMO padrão que a Cidadela já usa em `CidadelaIntro` (hero + InfoModal),
 * e vale para todos os jogos: o conteúdo vem de `landingJogos.ts`.
 */
import { useState } from "react";
import { ArrowRight, HelpCircle, Sparkles } from "lucide-react";
import { InfoModal } from "@/components/InfoModal";
import type { ConteudoLanding, SecaoAjuda } from "@/data/landingJogos";

interface LandingJogoProps {
  conteudo: ConteudoLanding;
  /** Começa o jogo (abre a configuração ou a partida direto). */
  onJogar: () => void;
  /** Volta para a grade de jogos. */
  onVoltar: () => void;
  /** Rótulo do botão principal (ex.: "Jogar agora"). */
  rotuloJogar?: string;
  /** Linha fina abaixo do botão (ex.: última configuração usada). */
  notaRodape?: string;
  /** Bloco extra abaixo dos pilares (ex.: "continuar campanha"). */
  extra?: React.ReactNode;
}

function Secoes({ secoes }: { secoes: SecaoAjuda[] }) {
  return (
    <>
      {secoes.map((sec) => (
        <section key={sec.titulo} className="mb-5">
          <h3 className="mb-2 text-sm font-bold text-foreground">{sec.titulo}</h3>
          {sec.paragrafos?.map((p, i) => (
            <p key={i} className="mb-2 text-sm leading-relaxed">
              {p}
            </p>
          ))}
          {sec.itens && (
            <ul className="ml-4 list-disc space-y-1.5 text-sm leading-relaxed">
              {sec.itens.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}

export function LandingJogo({
  conteudo,
  onJogar,
  onVoltar,
  rotuloJogar = "Jogar agora",
  notaRodape,
  extra,
}: LandingJogoProps) {
  const [modal, setModal] = useState<null | "como" | "modos" | "detalhes">(null);

  const temModos = Boolean(conteudo.modos?.length);
  const temDetalhes = Boolean(conteudo.detalhes?.length);

  return (
    <div className="brio-app">
      <button type="button" className="brio-link" onClick={onVoltar}>
        ← Todos os jogos
      </button>

      {/* --------------------------------------------------------- abertura */}
      <header className="lj-hero" style={{ ["--lj-cor" as string]: conteudo.cor, ["--lj-cor2" as string]: conteudo.cor2 }}>
        <span className="lj-selo">{conteudo.selo}</span>
        <h1 className="lj-nome">{conteudo.nome}</h1>
        <p className="lj-chamada">{conteudo.chamada}</p>
        <p className="lj-apresentacao">{conteudo.apresentacao}</p>
      </header>

      {/* ---------------------------------------------------------- pilares */}
      {conteudo.pilares.length > 0 && (
        <div className="lj-pilares">
          {conteudo.pilares.map((p) => (
            <div key={p.titulo} className="lj-pilar">
              <span className="lj-pilar-icone" aria-hidden>
                {p.icone}
              </span>
              <strong className="lj-pilar-titulo">{p.titulo}</strong>
              <p className="lj-pilar-texto">{p.texto}</p>
            </div>
          ))}
        </div>
      )}

      {/* --------------------------------------------------------- começar */}
      <button type="button" className="lj-jogar" onClick={onJogar} data-brio-jogar>
        <Sparkles className="size-5" aria-hidden />
        {rotuloJogar}
        <ArrowRight className="size-5" aria-hidden />
      </button>

      {notaRodape && <p className="lj-nota">{notaRodape}</p>}

      {extra}

      {/* --------------------------------------------- ajuda sob demanda */}
      <div className="lj-ajuda">
        <button type="button" className="lj-ajuda-btn" onClick={() => setModal("como")} data-brio-ajuda>
          <HelpCircle className="size-4" aria-hidden />
          Como jogar
        </button>
        {temModos && (
          <button type="button" className="lj-ajuda-btn" onClick={() => setModal("modos")}>
            <HelpCircle className="size-4" aria-hidden />
            Modos de jogo
          </button>
        )}
        {temDetalhes && (
          <button type="button" className="lj-ajuda-btn" onClick={() => setModal("detalhes")}>
            <HelpCircle className="size-4" aria-hidden />
            Regras e detalhes
          </button>
        )}
      </div>

      {conteudo.aviso && <p className="lj-aviso">{conteudo.aviso}</p>}

      <InfoModal
        isOpen={modal === "como"}
        onClose={() => setModal(null)}
        title={`Como jogar — ${conteudo.nome}`}
        content={<Secoes secoes={conteudo.comoJogar} />}
      />
      <InfoModal
        isOpen={modal === "modos"}
        onClose={() => setModal(null)}
        title={`Modos de jogo — ${conteudo.nome}`}
        content={<Secoes secoes={conteudo.modos ?? []} />}
      />
      <InfoModal
        isOpen={modal === "detalhes"}
        onClose={() => setModal(null)}
        title={`Regras e detalhes — ${conteudo.nome}`}
        content={<Secoes secoes={conteudo.detalhes ?? []} />}
      />
    </div>
  );
}
