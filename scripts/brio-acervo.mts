/**
 * Exporta o acervo curado do Guerra de Brio como JSON no stdout.
 *
 * Existe porque `jiti` executa TypeScript mas não tem `-e`: o importador
 * (`scripts/brio-importar.mjs --acervo`) roda este arquivo e lê o JSON.
 *
 * Uso: npx jiti scripts/brio-acervo.mts > lote.json
 */
import { ACERVO_BRIO_EQUILIBRADO } from "../src/lib/brio/acervo";

const lote = ACERVO_BRIO_EQUILIBRADO.map((p) => ({
  area_slug: p.areaSlug,
  subcategoria_slug: p.subcategoriaSlug,
  dificuldade: p.dificuldade,
  ordem: p.ordem,
  enunciado: p.enunciado,
  alternativas: p.alternativas,
  letra_correta: p.letraCorreta,
  explicacao: p.explicacao,
  referencia: p.referencia ?? null,
}));

process.stdout.write(JSON.stringify(lote));
