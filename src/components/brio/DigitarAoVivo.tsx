/**
 * Texto que se escreve na frente do jogador — tecla por tecla, com som.
 *
 * Por que existe: ler um parágrafo pronto é passivo. Ver a frase sendo
 * digitada, com o clique do teclado, muda o jogador de leitor para testemunha
 * — alguém está escrevendo isto agora, e pode parar no meio.
 *
 * Regras de acessibilidade que NÃO podem regredir:
 * - `prefers-reduced-motion`: o texto aparece inteiro, sem animação e sem som.
 * - Clique/toque no bloco: revela tudo imediatamente (ninguém fica preso).
 * - O texto COMPLETO está sempre no DOM via `aria-label` do container, então
 *   leitor de tela não depende da animação para ler.
 */
import { useEffect, useRef, useState } from "react";
import { tocarTecla } from "@/lib/brio/campanha/som";

interface DigitarAoVivoProps {
  texto: string;
  /** Milissegundos por caractere. */
  velocidade?: number;
  /** Atraso antes de começar (dá tempo de o layout assentar). */
  atraso?: number;
  /** Toca o som de teclado. Desligado em provas/testes. */
  som?: boolean;
  /** Avisa o pai quando terminar de escrever. */
  onCompleto?: (() => void) | undefined;
  /** Marca o parágrafo como "de tensão" (mais lento, som mais grave). */
  tenso?: boolean;
  className?: string;
}

function semMovimento(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function DigitarAoVivo({
  texto,
  velocidade = 22,
  atraso = 0,
  som = true,
  onCompleto,
  tenso = false,
  className = "",
}: DigitarAoVivoProps) {
  const [visivel, setVisivel] = useState(0);
  const [pronto, setPronto] = useState(false);
  const completoRef = useRef(false);

  // O callback fica em ref: mudá-lo não reinicia a digitação (isso já causou
  // texto recomeçando do zero no meio da leitura).
  const onCompletoRef = useRef(onCompleto);
  onCompletoRef.current = onCompleto;

  useEffect(() => {
    if (semMovimento()) {
      setVisivel(texto.length);
      if (!completoRef.current) {
        completoRef.current = true;
        setPronto(true);
        onCompletoRef.current?.();
      }
      return;
    }

    completoRef.current = false;
    setVisivel(0);
    setPronto(false);

    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    let cancelado = false;

    const passo = () => {
      if (cancelado) return;
      i += 1;
      setVisivel(i);

      const caractere = texto[i - 1] ?? "";
      // Som só em caractere visível; espaço e pontuação soam diferente.
      if (som && i % (tenso ? 2 : 1) === 0 && caractere.trim()) {
        if (caractere === "." || caractere === "?" || caractere === "!") {
          tocarTecla("enter", tenso ? 0.8 : 1);
        } else {
          tocarTecla("normal", tenso ? 0.7 : 1);
        }
      }

      if (i >= texto.length) {
        completoRef.current = true;
        setPronto(true);
        onCompletoRef.current?.();
        return;
      }

      // Pontuação forte faz uma pausa: é o que dá ritmo de leitura.
      const forte = ".!?".includes(caractere);
      const leve = ",;:".includes(caractere);
      const jitter = tenso ? 1.45 : 1;
      const espera = (velocidade + (forte ? 180 : leve ? 80 : 0)) * jitter;
      timer = setTimeout(passo, espera);
    };

    timer = setTimeout(passo, atraso);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [texto, velocidade, atraso, som, tenso]);

  /** Revela tudo — clique, toque, ou qualquer tecla. */
  const revelar = () => {
    if (pronto) return;
    completoRef.current = true;
    setVisivel(texto.length);
    setPronto(true);
    onCompletoRef.current?.();
  };

  const escrito = texto.slice(0, visivel);

  return (
    <p
      className={`brio-narrativa brio-narrativa--viva ${tenso ? "brio-narrativa--tensa" : ""} ${className}`}
      // O texto completo sempre acessível, independente da animação.
      aria-label={texto}
      onClick={revelar}
      title={pronto ? undefined : "Toque para revelar o texto"}
    >
      <span aria-hidden>{escrito}</span>
      {!pronto && <span className="brio-cursor" aria-hidden />}
    </p>
  );
}
