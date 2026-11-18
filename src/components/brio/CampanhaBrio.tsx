/**
 * MODO HISTÓRIA do Guerra de Brio — a campanha narrativa.
 *
 * RPG DE TEXTO: o jogador lê em primeira pessoa, escolhe, vê a consequência e
 * enfrenta uma prova (o duelo contra o adversário virtual, com o MESMO motor do
 * modo livre).
 *
 * Este componente cuida do roteiro e do progresso. A PROVA não é reimplementada
 * aqui: quem a conduz é o `GuerraDeBrio`, que devolve o resultado via
 * `onDueloConcluido`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DigitarAoVivo } from "./DigitarAoVivo";
import { ajustarAmbiencia, pararAmbiencia, tocarImpacto } from "@/lib/brio/campanha/som";
import {
  atoAtualDe,
  avancarCena,
  campanhaConcluida,
  cenaAtualDe,
  dueloDoAto,
  escolhaFeita,
  escolher,
  percentualCampanha,
  progressoDosAtos,
  referenciaDaCena,
  ROTULO_TRACO,
  tracoDominante,
} from "@/lib/brio/campanha/motor";
import {
  CLASSIFICACAO_LABEL,
  CLIMA_AMBIENCIA,
  CLIMA_LABEL,
  type ClimaCena,
  type EstadoCampanha,
  type EscolhaCena,
} from "@/lib/brio/campanha/tipos";
import type { DueloDoAto } from "@/lib/brio/campanha/tipos";

interface CampanhaProps {
  estado: EstadoCampanha;
  onEstado: (e: EstadoCampanha) => void;
  /** Abre a prova do ato (o jogo conduz o duelo e volta com o resultado). */
  onAbrirDuelo: (duelo: DueloDoAto) => void;
  /** Sai da campanha (volta ao lobby do Guerra de Brio). */
  onSair: () => void;
  /** Resultado da última prova, quando voltou de uma. */
  ultimoDuelo: { acertos: number; total: number; venceu: boolean; minimo: number } | null;
  onLimparUltimoDuelo: () => void;
}

function agora(): string {
  return new Date().toISOString();
}

export function CampanhaBrio({
  estado,
  onEstado,
  onAbrirDuelo,
  onSair,
  ultimoDuelo,
  onLimparUltimoDuelo,
}: CampanhaProps) {
  const [consequencia, setConsequencia] = useState<EscolhaCena | null>(null);
  const [painelAberto, setPainelAberto] = useState(false);
  const [textoPronto, setTextoPronto] = useState(false);
  // Parágrafo que está sendo digitado AGORA. Digitar todos em paralelo vira
  // metralhadora e destrói o ritmo — a tensão vem da SEQUÊNCIA.
  const [paragrafoAtivo, setParagrafoAtivo] = useState(0);
  // Som LIGADO por padrão (é a experiência), mas o jogador desliga num toque —
  // e a escolha fica guardada no aparelho.
  const [somLigado, setSomLigado] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const salvo = window.localStorage.getItem("brio:campanha:som");
    if (salvo === "off") setSomLigado(false);
  }, []);

  const alternarSom = useCallback(() => {
    setSomLigado((v) => {
      const novo = !v;
      try {
        window.localStorage.setItem("brio:campanha:som", novo ? "on" : "off");
      } catch {
        /* storage bloqueado: só não persiste */
      }
      if (!novo) pararAmbiencia();
      return novo;
    });
  }, []);

  const ato = useMemo(() => atoAtualDe(estado), [estado]);
  const cena = useMemo(() => cenaAtualDe(estado), [estado]);
  const referencia = useMemo(() => referenciaDaCena(cena), [cena]);
  const progresso = useMemo(() => progressoDosAtos(estado), [estado]);
  const percentual = useMemo(() => percentualCampanha(estado), [estado]);
  const terminou = useMemo(() => campanhaConcluida(estado), [estado]);
  const duelo = useMemo(() => (ato ? dueloDoAto(ato) : null), [ato]);

  // Clima: a cena manda; sem clima próprio, herda o do ato.
  const clima: ClimaCena = cena?.clima ?? ato?.clima ?? "deslocamento";
  const ehFinal = terminou && !cena;
  const climaEfetivo: ClimaCena = ehFinal ? "veredito" : clima;

  // A ambiência acompanha o clima e o texto: enquanto escreve, a sala respira.
  useEffect(() => {
    if (!somLigado) {
      pararAmbiencia();
      return;
    }
    const base = CLIMA_AMBIENCIA[climaEfetivo] ?? 0.3;
    ajustarAmbiencia(textoPronto ? base : Math.min(1, base + 0.15));
    return () => pararAmbiencia();
  }, [climaEfetivo, textoPronto, somLigado]);

  // Sai da campanha sempre cala o áudio (não deixa drone tocando no lobby).
  useEffect(() => () => pararAmbiencia(), []);

  // Cada cena nova reinicia a digitação (do primeiro parágrafo).
  // ATENÇÃO: as deps são SÓ a cena. Incluir `consequencia` fazia o texto
  // recomeçar do zero no instante em que o jogador escolhia — a cena inteira
  // se redigitava em cima da consequência.
  useEffect(() => {
    setTextoPronto(false);
    setParagrafoAtivo(0);
  }, [cena?.id]);


  // Velocidade calibrada no tamanho REAL das cenas (~479 caracteres):
  // a 13ms/char uma cena leva ~6-8s com as pausas de pontuação, e o jogador
  // pode tocar para revelar tudo. Mais lento que isto cansa.
  const velocidadeDigitar =
    climaEfetivo === "porao" ? 17 : climaEfetivo === "laboratorio" ? 16 : climaEfetivo === "tribunal" ? 14 : 13;

  const impactoRef = useRef("");
  useEffect(() => {
    if (ehFinal && impactoRef.current !== "fim") {
      impactoRef.current = "fim";
      if (somLigado) tocarImpacto();
    }
  }, [ehFinal, somLigado]);

  // A escolha já feita (restaurada após F5) — a consequência continua legível.
  const escolhaAnterior = useMemo(() => (cena ? escolhaFeita(estado, cena) : null), [estado, cena]);

  // Cena já respondida (volta de F5 ou retorno da prova): não obriga o jogador
  // a esperar a digitação de novo — a escolha dele já está registrada.
  useEffect(() => {
    if (escolhaAnterior) setTextoPronto(true);
  }, [escolhaAnterior]);

  const escolherOpcao = useCallback(
    (id: string) => {
      if (!cena || consequencia) return;
      const { estado: novo, escolha } = escolher(estado, cena, id, agora());
      if (!escolha) return;
      setConsequencia(escolha);
      onEstado(novo);
    },
    [cena, consequencia, estado, onEstado],
  );

  const continuar = useCallback(() => {
    setConsequencia(null);
    const { estado: novo, abrirDuelo, fimDaCampanha } = avancarCena(estado, agora());
    onEstado(novo);
    if (abrirDuelo && duelo) {
      onAbrirDuelo(duelo);
      return;
    }
    if (fimDaCampanha) setPainelAberto(true);
  }, [estado, duelo, onEstado, onAbrirDuelo]);

  // ---------------------------------------------------------------- final
  if (terminou && !cena) {
    const dominante = tracoDominante(estado.tracos);
    return (
      <div className="brio-app">
        <div className="brio-campanha-clima" data-clima="veredito">
          <span className="brio-badge">Modo história · concluído</span>
          <h1 className="brio-titulo">Fim do Relatório</h1>
          <section className="brio-painel">
            <DigitarAoVivo
              texto={
                "Você atravessou os seis atos. Não há medalha no fim — há um relatório assinado, e a " +
                "pergunta que você levou o tempo todo: quem decide, agora, quais vidas valem mais?"
              }
              som={somLigado}
              velocidade={30}
            />
            <div className="brio-traco">
              <span className="brio-traco-rotulo">Seu perfil de decisão</span>
              <strong>{ROTULO_TRACO[dominante]}</strong>
            </div>
            <div className="brio-tracos-linha">
              <span>Rigor {estado.tracos.rigor}</span>
              <span>Empatia {estado.tracos.empatia}</span>
              <span>Coragem {estado.tracos.coragem}</span>
            </div>
          </section>
          <button type="button" className="brio-btn" onClick={onSair}>
            Voltar ao duelo livre
          </button>
        </div>
      </div>
    );
  }

  if (!ato || !cena) {
    return (
      <div className="brio-app">
        <span className="brio-badge">Modo história</span>
        <h1 className="brio-titulo">Guerra de Brio</h1>
        <div className="brio-espera">
          <span className="brio-espera-dot" />
          Retomando o relatório…
        </div>
        <button type="button" className="brio-btn" onClick={onSair}>
          Voltar
        </button>
      </div>
    );
  }

  const ultimaCena = estado.cenaAtual >= ato.cenas.length - 1;

  return (
    <div className="brio-app">
      <div className="brio-campanha-clima" data-clima={climaEfetivo}>
        {/* ------------------------------------------------------ cabeçalho */}
        <div className="brio-camp-topo">
          <span className="brio-badge">
            {ato.icone} Ato {ato.numero} de {progresso.length}
          </span>
          <span className="brio-clima-selo">{CLIMA_LABEL[climaEfetivo]}</span>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button
              type="button"
              className="brio-link"
              onClick={alternarSom}
              aria-pressed={somLigado}
              title={somLigado ? "Desligar o som" : "Ligar o som"}
            >
              {somLigado ? "🔊 Som" : "🔇 Mudo"}
            </button>
            <button
              type="button"
              className="brio-link"
              onClick={() => setPainelAberto((v) => !v)}
              aria-expanded={painelAberto}
            >
              {painelAberto ? "Fechar progresso" : `Progresso · ${percentual}%`}
            </button>
          </div>
        </div>

      <h1 className="brio-titulo">{ato.titulo}</h1>
      <p className="brio-sub">{ato.subtema}</p>

      {/* --------------------------------------------------- painel de atos */}
      {painelAberto && (
        <section className="brio-painel" style={{ marginBottom: "0.9rem" }}>
          <h2 className="brio-secao-titulo">Sua campanha</h2>
          <div className="brio-atos">
            {progresso.map((p) => (
              <div
                key={p.ato.id}
                className={`brio-ato ${p.situacao === "concluido" ? "brio-ato--feito" : ""} ${
                  p.situacao === "atual" ? "brio-ato--atual" : ""
                }`}
              >
                <span className="brio-ato-icone">{p.ato.icone}</span>
                <span className="brio-ato-texto">
                  <span className="brio-ato-nome">
                    Ato {p.ato.numero} — {p.ato.titulo}
                  </span>
                  <br />
                  <span className="brio-ato-sub">{p.ato.subtema}</span>
                </span>
                <span className="brio-ato-marca">
                  {p.situacao === "concluido" ? `✓ ${p.acertos} acertos` : p.situacao === "atual" ? "aqui" : "—"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------- resultado da prova */}
      {ultimoDuelo && (
        <section className={`brio-resultado-ato ${ultimoDuelo.venceu ? "brio-ok" : "brio-nao"}`}>
          <strong>
            {ultimoDuelo.venceu
              ? `Prova vencida — ${ultimoDuelo.acertos} de ${ultimoDuelo.total} acertos.`
              : `Prova não vencida — ${ultimoDuelo.acertos} de ${ultimoDuelo.total} acertos (o mínimo era ${ultimoDuelo.minimo}).`}
          </strong>
          <p>
            {ultimoDuelo.venceu
              ? "O relatório avança. A próxima etapa já está aberta."
              : "Você pode repetir a prova quantas vezes quiser. Nada aqui trava por desempenho."}
          </p>
          <div className="brio-resultado-botoes">
            {!ultimoDuelo.venceu && duelo && (
              <button type="button" className="brio-btn" onClick={() => onAbrirDuelo(duelo)}>
                Repetir a prova
              </button>
            )}
            <button type="button" className="brio-btn brio-btn--ghost" onClick={onLimparUltimoDuelo}>
              Continuar a leitura
            </button>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------- narrativa */}
      <section className="brio-painel">
        <h2 className="brio-secao-titulo">{cena.titulo}</h2>
        {/* Digitação ao vivo: o texto se escreve na frente do jogador, com som
            de teclado. A escolha só aparece quando a cena termina de escrever —
            a tensão é não saber o que vem depois. */}
        {cena.texto.map((paragrafo, i) => {
          // Parágrafos anteriores já terminaram; os futuros ainda não começaram
          // (ficam fora do DOM para não competir com a leitura).
          if (i > paragrafoAtivo) return null;
          return (
            <DigitarAoVivo
              key={`${cena.id}-${i}`}
              texto={paragrafo}
              som={somLigado}
              atraso={i === 0 ? 140 : 260}
              velocidade={velocidadeDigitar}
              tenso={climaEfetivo === "porao" || climaEfetivo === "laboratorio"}
              onCompleto={() => {
                if (i < cena.texto.length - 1) setParagrafoAtivo(i + 1);
                else setTextoPronto(true);
              }}
            />
          );
        })}

        {referencia && (
          <div className={`brio-fonte brio-fonte--${referencia.classificacao.toLowerCase()}`}>
            <span className="brio-fonte-selo">{CLASSIFICACAO_LABEL[referencia.classificacao]}</span>
            <strong>{referencia.titulo}</strong>
            <p>{referencia.resumo}</p>
            <span className="brio-fonte-origem">{referencia.fonte}</span>
          </div>
        )}
      </section>

      {/* --------------------------------------------------------- escolhas */}
      {!textoPronto ? (
        <p className="brio-sub" style={{ textAlign: "center" }}>
          O relatório está sendo escrito…
        </p>
      ) : (consequencia ?? escolhaAnterior) ? (
        <section className="brio-painel">
          <h2 className="brio-secao-titulo">Consequência</h2>
          <p className="brio-narrativa">{consequencia?.resposta ?? escolhaAnterior?.resposta}</p>
          {(consequencia?.revelaFonte ?? escolhaAnterior?.revelaFonte) && referencia && (
            <p className="brio-nota-fonte">
              Você conferiu a procedência: {CLASSIFICACAO_LABEL[referencia.classificacao]} —{" "}
              {referencia.fonte}.
            </p>
          )}
          <button type="button" className="brio-btn" onClick={continuar}>
            {ultimaCena && duelo ? "Encarar a prova" : "Continuar"}
          </button>
        </section>
      ) : (
        <section className="brio-painel">
          <h2 className="brio-secao-titulo">O que você faz?</h2>
          <div className="brio-escolhas">
            {cena.escolhas.map((e) => (
              <button
                key={e.id}
                type="button"
                className="brio-escolha"
                onClick={() => escolherOpcao(e.id)}
                data-brio-escolha={e.id}
              >
                {e.texto}
              </button>
            ))}
          </div>
        </section>
      )}

        <button type="button" className="brio-btn brio-btn--ghost" onClick={onSair}>
          Voltar ao duelo livre
        </button>
        <p className="brio-sub" style={{ marginTop: "0.7rem", marginBottom: 0 }}>
          Competindo como <strong>{estado.protagonista.nome}</strong> — {estado.protagonista.posto}.
          A campanha mistura <em>fato histórico documentado</em>, <em>hipótese</em> e{" "}
          <em>ficção do jogo</em>; cada trecho diz qual é qual.
        </p>
      </div>
    </div>
  );
}
