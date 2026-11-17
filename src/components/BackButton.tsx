import { ArrowLeft } from "lucide-react";

type BackButtonProps = {
  /** Label opcional ao lado do ícone. */
  label?: string;
  className?: string;
  /**
   * Ação de voltar. Quando existe, tem PRECEDÊNCIA sobre o histórico: os jogos
   * que vivem dentro de /cidadela precisam voltar ao hub da Cidadela, e
   * `history.back()` levaria o jogador para fora da página.
   */
  onClick?: (() => void) | undefined;
};

/**
 * Botão de voltar simples e confiável.
 * Com `onClick`, executa a ação recebida. Sem ele, usa window.history.back()
 * (página anterior real) e, sem histórico, volta para /.
 */
export function BackButton({ label, className, onClick }: BackButtonProps) {
  const handleBack = () => {
    if (onClick) {
      onClick();
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  return (
    <button
      onClick={handleBack}
      className={
        className ??
        "fixed left-3 top-3 z-[80] inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3.5 py-2 text-sm font-semibold text-foreground shadow-lg backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-primary/10 hover:shadow-xl active:scale-95"
      }
      aria-label="Voltar"
    >
      <ArrowLeft className="size-4 shrink-0" />
      <span className="hidden sm:inline">{label ?? "Voltar"}</span>
    </button>
  );
}
