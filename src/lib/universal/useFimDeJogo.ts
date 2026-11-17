import { useEffect, useRef } from "react";
import type { ResultadoPartida } from "./campanhaJogos";

/**
 * Reporta o fim da partida UMA única vez.
 *
 * Os 5 jogos universais recalculam `acabou` a cada render; sem esta guarda o
 * fim seria reportado várias vezes e a recompensa/missão dispararia repetido.
 * Também ignora o fim "já no primeiro render" (partida que abre encerrada por
 * estado corrompido) — isso não é vitória de ninguém.
 */
export function useFimDeJogo(
  acabou: boolean,
  vencedor: number | null,
  onFim: ((resultado: ResultadoPartida) => void) | undefined,
  meuLado = 0,
): void {
  const reportadoRef = useRef(false);
  const jaEstavaAcabadoRef = useRef(acabou);

  useEffect(() => {
    if (!onFim) return;
    if (reportadoRef.current) return;
    if (!acabou) return;
    // Partida que já abriu encerrada: não conta como resultado.
    if (jaEstavaAcabadoRef.current) return;
    reportadoRef.current = true;

    const resultado: ResultadoPartida =
      vencedor === null ? "empate" : vencedor === meuLado ? "vitoria" : "derrota";
    onFim(resultado);
  }, [acabou, vencedor, onFim, meuLado]);
}
