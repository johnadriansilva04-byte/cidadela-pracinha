/**
 * Grade de jogos da Cidadela — visual de fliperama.
 *
 * Cada jogo tem identidade própria (cor de acento, brilho e "chamada"), com
 * cards que respondem ao ponteiro: elevação, halo neon e a imagem de fundo
 * inclinando de leve. O objetivo é dar vontade de clicar, não parecer uma
 * lista de formulário.
 *
 * Acessibilidade: tudo é <button> de verdade — foco visível, Enter/Espaço e
 * navegação por teclado continuam funcionando. O movimento respeita
 * `prefers-reduced-motion`.
 */
import type { LucideIcon } from "lucide-react";

export type JogoDaGrade = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  status: string;
  /** Acento neon do card. */
  cor: string;
  /** Segunda cor do gradiente (opcional). */
  cor2?: string;
  /** Etiqueta curta de gênero, exibida no rodapé do card. */
  genero: string;
  /** Chamada curta e instigante. */
  chamada: string;
  /** Selo opcional no canto (ex.: "NOVO", "1v1"). */
  selo?: string | undefined;
};

type Props = {
  jogos: JogoDaGrade[];
  onSelecionar: (id: string) => void;
  titulo?: string;
};

export function GradeJogos({ jogos, onSelecionar, titulo = "Jogos do Campus" }: Props) {
  return (
    <section className="cg-grade" aria-label={titulo}>
      <header className="cg-grade-topo">
        <h2 className="cg-grade-titulo">
          <span className="cg-grade-pulso" aria-hidden />
          {titulo}
        </h2>
        <p className="cg-grade-sub">{jogos.length} jogos · escolha o seu campo de batalha</p>
      </header>

      <div className="cg-grade-grid">
        {jogos.map((jogo, indice) => {
          const Icon = jogo.icon;
          const disponivel = jogo.status === "disponível";
          return (
            <button
              key={jogo.id}
              type="button"
              disabled={!disponivel}
              onClick={() => disponivel && onSelecionar(jogo.id)}
              aria-label={`${jogo.label} — ${jogo.description}`}
              className="cg-card"
              style={
                {
                  "--cg-cor": jogo.cor,
                  "--cg-cor2": jogo.cor2 ?? jogo.cor,
                  "--cg-atraso": `${indice * 60}ms`,
                } as React.CSSProperties
              }
            >
              <span className="cg-card-brilho" aria-hidden />
              <span className="cg-card-borda" aria-hidden />

              <span className="cg-card-topo">
                <span className="cg-card-icone" aria-hidden>
                  <Icon />
                </span>
                {jogo.selo && <span className="cg-selo">{jogo.selo}</span>}
              </span>

              <span className="cg-card-nome">{jogo.label}</span>
              <span className="cg-card-chamada">{jogo.chamada}</span>

              <span className="cg-card-rodape">
                <span className="cg-genero">{jogo.genero}</span>
                <span className="cg-jogar">
                  Jogar
                  <span className="cg-seta" aria-hidden>
                    ›
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
