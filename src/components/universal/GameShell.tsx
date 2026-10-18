/**
 * Casca visual compartilhada das mesas do sistema universal.
 *
 * Mantém o mesmo padrão de cabeçalho, seletor de dificuldade, faixa de status
 * e moldura em todos os jogos — assim cada view só se preocupa com o tabuleiro.
 */
import type { ReactNode } from "react";
import { ArrowLeft, Brain, RotateCcw, Sparkles } from "lucide-react";
import type { AiLevel } from "@/lib/universal/aiUniversal";

export const AI_LEVEL_LABEL: Record<AiLevel, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
};

interface GameShellProps {
  title: string;
  /** Subtítulo curto (regra do jogo ou placar). */
  subtitle?: string | undefined;
  onBack: () => void;
  onRestart: () => void;
  /** Seletor de dificuldade da IA. */
  level?: AiLevel | undefined;
  onLevelChange?: ((level: AiLevel) => void) | undefined;
  /** Mensagem de status (turno, resultado…). */
  status?: ReactNode | undefined;
  /** A IA está calculando? */
  thinking?: boolean | undefined;
  /** Mostra o selo de IA Monte Carlo. */
  usesMCTS?: boolean | undefined;
  children: ReactNode;
  /** Rodapé opcional (legenda, ações). */
  footer?: ReactNode | undefined;
}

export function GameShell({
  title,
  subtitle,
  onBack,
  onRestart,
  level,
  onLevelChange,
  status,
  thinking = false,
  usesMCTS = false,
  children,
  footer,
}: GameShellProps) {
  return (
    <div className="flex min-h-screen flex-col items-center gap-3 p-3 md:p-5">
      <header className="flex w-full max-w-4xl items-center gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-sm font-semibold shadow-sm transition-all hover:border-primary/50 hover:bg-primary/10 active:scale-95"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold leading-tight md:text-xl">{title}</h1>
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>

        {usesMCTS ? (
          <span
            className="hidden items-center gap-1 rounded-lg border border-violet-400/40 bg-violet-500/10 px-2 py-1 text-[11px] font-semibold text-violet-300 sm:inline-flex"
            title="A máquina decide por busca Monte Carlo"
          >
            <Sparkles className="h-3 w-3" />
            IA Monte Carlo
          </span>
        ) : null}

        <button
          onClick={onRestart}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-sm font-semibold shadow-sm transition-all hover:border-primary/50 hover:bg-primary/10 active:scale-95"
          aria-label="Reiniciar"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">Reiniciar</span>
        </button>
      </header>

      {level && onLevelChange ? (
        <div className="flex w-full max-w-4xl flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Brain className="h-3.5 w-3.5" />
            Dificuldade
          </span>
          <div className="flex gap-1.5">
            {(["facil", "medio", "dificil"] as AiLevel[]).map((option) => (
              <button
                key={option}
                onClick={() => onLevelChange(option)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all active:scale-95 ${
                  level === option
                    ? "border-primary/60 bg-primary/15 text-foreground"
                    : "border-border/60 bg-background/60 text-muted-foreground hover:border-primary/40"
                }`}
              >
                {AI_LEVEL_LABEL[option]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {status ? (
        <div className="flex w-full max-w-4xl items-center gap-2 rounded-2xl border border-border/50 bg-background/70 px-4 py-2.5 text-sm shadow-sm">
          {status}
          {thinking ? (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-violet-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
              calculando…
            </span>
          ) : null}
        </div>
      ) : null}

      <main className="w-full max-w-4xl">{children}</main>

      {footer ? (
        <footer className="w-full max-w-4xl text-center text-xs text-muted-foreground">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}

/** Painel escuro padrão das mesas. */
export function TablePanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-border/50 bg-gradient-to-b from-slate-900/80 to-slate-950/90 p-3 shadow-2xl md:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

/** Faixa de fim de partida com o resultado. */
export function ResultBanner({
  winner,
  playerName = "Você",
  opponentName = "Máquina",
  reason,
  onRestart,
}: {
  winner: number | null;
  playerName?: string;
  opponentName?: string;
  reason?: string | null;
  onRestart: () => void;
}) {
  const texto =
    winner === null ? "Empate!" : winner === 0 ? `${playerName} venceu!` : `${opponentName} venceu`;
  const tom =
    winner === 0
      ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
      : winner === null
        ? "border-amber-400/50 bg-amber-500/15 text-amber-200"
        : "border-rose-400/50 bg-rose-500/15 text-rose-200";

  return (
    <div className={`mt-3 flex flex-wrap items-center justify-center gap-3 rounded-2xl border px-4 py-3 text-center ${tom}`}>
      <span className="text-base font-bold">{texto}</span>
      {reason ? <span className="text-xs opacity-80">({reason})</span> : null}
      <button
        onClick={onRestart}
        className="rounded-lg border border-white/25 px-3 py-1 text-xs font-semibold transition-all hover:bg-white/10 active:scale-95"
      >
        Jogar de novo
      </button>
    </div>
  );
}
