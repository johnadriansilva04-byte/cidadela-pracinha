import type { ReactNode } from "react";
import { BackButton } from "@/components/BackButton";

export type ResultadoArena = "vitoria" | "derrota" | "empate";

interface ArenaJogoProps {
  titulo: string;
  /** Sai da partida e volta ao painel da campanha. */
  onBack: () => void;
  /** Selo do topo — normalmente a fase da campanha ("FASE 2 · SARGENTO"). */
  selo?: string | undefined;
  /** Quem joga agora, em texto já legível ("Você", "Brancas"). */
  turno?: string | undefined;
  /** Rótulo antes do turno. Padrão "Turno" (os testes leem "Turno:"). */
  turnoRotulo?: string | undefined;
  iaPensando?: boolean | undefined;
  /** Informação extra do HUD (pontas, fichas, rolagens). */
  status?: ReactNode;
  /** Placar/versus: rótulo de cada lado. Ausente = não desenha a barra. */
  versus?: { eu: string; oponente: string } | undefined;
  /** Placar opcional de cada lado (aparece ao lado do nome). */
  pontos?: { eu: number | string; oponente: number | string } | undefined;
  acabou?: boolean | undefined;
  resultado?: ResultadoArena | null | undefined;
  mensagemFim?: string | null | undefined;
  /** Controles da partida (rolar, comprar, pedir carta…). */
  acoes?: ReactNode;
  /** Botão "Novo Jogo" no rodapé quando a partida acabou. */
  onNovoJogo?: (() => void) | undefined;
  children: ReactNode;
}

const TITULO_FIM: Record<ResultadoArena, string> = {
  vitoria: "Vitória!",
  derrota: "Derrota",
  empate: "Empate!",
};

/**
 * Moldura de arena compartilhada pelos jogos da Cidadela.
 *
 * Existe para dar aos cinco jogos a mesma identidade de fliperama (HUD,
 * placar versus, faixa de resultado) sem duplicar markup em cada view e sem
 * tocar na lógica de cada motor. Os rótulos acessíveis das casas/peças/dados
 * continuam sendo criados pelos próprios jogos — os testes E2E dependem deles.
 */
export function ArenaJogo({
  titulo,
  onBack,
  selo,
  turno,
  turnoRotulo = "Turno",
  iaPensando,
  status,
  versus,
  pontos,
  acabou,
  resultado,
  mensagemFim,
  acoes,
  onNovoJogo,
  children,
}: ArenaJogoProps) {
  return (
    <div className="arena-wrap">
      <div className="arena-luz" aria-hidden />

      <div className="arena-topo">
        <BackButton onClick={onBack} />
        <div className="arena-titulo-bloco">
          <h1 className="arena-titulo">{titulo}</h1>
          {selo && <span className="arena-selo">{selo}</span>}
        </div>
      </div>

      <div className="arena-hud">
        {turno && (
          <span className="arena-turno">
            <span className="arena-turno-rot">{turnoRotulo}:</span>
            <strong className={iaPensando ? "arena-turno-ia" : ""}>{turno}</strong>
          </span>
        )}
        {iaPensando && (
          <span className="arena-pensando">
            <span className="arena-pulso" aria-hidden /> IA pensando…
          </span>
        )}
        {status}
      </div>

      {versus && (
        <div className="arena-versus">
          <div className="arena-lado arena-lado--eu">
            <span className="arena-lado-rot">{versus.eu}</span>
            {pontos && <span className="arena-lado-pontos">{pontos.eu}</span>}
          </div>
          <div className="arena-x" aria-hidden>
            <span>VS</span>
          </div>
          <div className="arena-lado arena-lado--ia">
            <span className="arena-lado-rot">{versus.oponente}</span>
            {pontos && <span className="arena-lado-pontos">{pontos.oponente}</span>}
          </div>
        </div>
      )}

      <div className="arena-palco">{children}</div>

      {acabou && resultado && (
        <div className={`arena-banner arena-banner--${resultado}`} role="status">
          <span className="arena-banner-titulo">
            {mensagemFim ?? TITULO_FIM[resultado]}
          </span>
        </div>
      )}

      {acoes && <div className="arena-acoes">{acoes}</div>}

      {acabou && onNovoJogo && (
        <div className="arena-rodape">
          <button type="button" className="arena-btn arena-btn--primario" onClick={onNovoJogo}>
            Novo Jogo
          </button>
        </div>
      )}
    </div>
  );
}
