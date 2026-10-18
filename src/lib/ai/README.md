# Sistema de IA Genérica

Este módulo fornece uma infraestrutura genérica para integrar IA (MCTS, Minimax, etc.) em jogos de tabuleiro e estratégia.

## Arquitetura

```
src/lib/ai/
├── GameEngine.ts       # Interface genérica que jogos devem implementar
├── MCTS.ts            # Motor MCTS (Monte Carlo Tree Search) genérico
└── README.md          # Esta documentação
```

## Como Usar

### 1. Implementar a Interface GameEngine

Todo jogo que deseja usar a IA genérica deve implementar a interface `GameEngine`:

```typescript
import { GameEngine, GameState, Move } from "@/lib/ai/GameEngine";

class MeuJogoAdapter implements GameEngine<MeuJogoState, MeuJogoMove> {
  getValidMoves(state: MeuJogoState): MeuJogoMove[] {
    // Retorna todas as jogadas legais
  }

  applyMove(state: MeuJogoState, move: MeuJogoMove): MeuJogoState {
    // Aplica a jogada e retorna NOVO estado (imutável)
  }

  isGameOver(state: MeuJogoState): boolean {
    // Verifica se o jogo terminou
  }

  getWinner(state: MeuJogoState): number | null {
    // Retorna o vencedor (1 ou 2), null se não acabou
  }

  evaluate(state: MeuJogoState, player: number): number {
    // Avaliação heurística (opcional, mas recomendado)
    // Positivo = vantagem para o jogador, negativo = desvantagem
  }

  getCurrentPlayer(state: MeuJogoState): number {
    // Retorna o jogador que deve jogar (opcional)
  }
}
```

### 2. Usar o Motor MCTS

```typescript
import { MCTS } from "@/lib/ai/MCTS";

const adapter = new MeuJogoAdapter();
const mcts = new MCTS(adapter, {
  maxIterations: 10000,      // Máximo de simulações
  timeBudgetMs: 3000,       // Tempo máximo em ms
  explorationConstant: 1.41, // C parâmetro UCB1
  useHeuristicRollout: false, // Se true, usa heurística nos rollouts
});

const result = mcts.computeMove(currentState, currentPlayer);
console.log("Melhor jogada:", result.move);
console.log("Win rate:", result.winRate);
console.log("Iterações:", result.iterations);
```

### 3. Exemplo: Trilha

A Trilha já está integrada. Veja `src/lib/trilha/TrilhaEngineAdapter.ts` e `src/lib/trilha/ai.ts`.

## Quando Usar MCTS vs Minimax

### MCTS (Monte Carlo Tree Search)
- **Melhor para**: Jogos com espaço de estados grande, jogos estocásticos (com aleatoriedade)
- **Vantagens**: Aprofundamento adaptativo, não precisa de função de avaliação precisa
- **Desvantagens**: Mais lento que Minimax em jogos simples

### Minimax
- **Melhor para**: Jogos determinísticos com espaço de estados pequeno/médio
- **Vantagens**: Mais rápido em jogos simples, garante profundidade fixa
- **Desvantagens**: Precisa de boa função de avaliação, profundidade fixa

## Quando NÃO Usar Este Sistema

Este sistema **NÃO** é adequado para:
- Jogos de ação real-time (Car Brawl, Futebol 3D)
- Jogos com física contínua
- Jogos que exigem Deep Reinforcement Learning

Para esses casos, use:
- State machines comportamentais (Car Brawl)
- Heurísticas avançadas (Futebol)
- Deep RL (TensorFlow.js, PyTorch)

## API Reference

### GameEngine<S, M>

Interface que jogos devem implementar.

#### Métodos

- `getValidMoves(state: S): M[]` - Retorna jogadas legais
- `applyMove(state: S, move: M): S` - Aplica jogada (imutável)
- `isGameOver(state: S): boolean` - Verifica fim de jogo
- `getWinner(state: S): number | null` - Retorna vencedor
- `evaluate(state: S, player: number): number` - Avaliação heurística
- `getCurrentPlayer?(state: S): number` - Jogador atual (opcional)

### MCTS<S, M>

Motor MCTS genérico.

#### Construtor

```typescript
new MCTS(engine: GameEngine<S, M>, config?: Partial<MCTSConfig>)
```

#### MCTSConfig

```typescript
{
  maxIterations: number;        // Padrão: 10000
  timeBudgetMs: number;        // Padrão: 3000
  explorationConstant: number; // Padrão: √2 ≈ 1.41
  useHeuristicRollout?: boolean; // Padrão: false
}
```

#### Métodos

- `computeMove(state: S, player: number): MCTSResult<M>` - Computa melhor jogada
- `setRNG(rng: () => number): void` - Define gerador de números aleatórios

#### MCTSResult<M>

```typescript
{
  move: M | null;        // Melhor jogada
  iterations: number;    // Iterações realizadas
  elapsedMs: number;     // Tempo decorrido
  totalNodes: number;    // Nós na árvore
  winRate: number;       // Win rate (0..1)
}
```

## Performance Tips

1. **Use heurística boa**: `evaluate()` deve ser rápida e precisa
2. **Ordene jogadas**: Implemente ordenação em `getValidMoves()` para melhorar poda
3. **Ajuste iterações**: Comece com 5000, aumente se precisar de mais qualidade
4. **Cache estados**: Se possível, cache estados frequentemente visitados
5. **Use rollout heurístico**: `useHeuristicRollout: true` pode acelerar, mas perde precisão

## Testando

```typescript
import { MCTS } from "@/lib/ai/MCTS";
import { TrilhaAdapter } from "@/lib/trilha/TrilhaEngineAdapter";
import { createInitialState } from "@/lib/trilha/engine";

const adapter = new TrilhaAdapter();
const mcts = new MCTS(adapter, { maxIterations: 1000, timeBudgetMs: 500 });

const state = createInitialState();
const result = mcts.computeMove(state, 1);

console.log("Teste MCTS:", result);
```

## Contribuindo

Para adicionar um novo jogo:

1. Crie `src/lib/[jogo]/[Jogo]EngineAdapter.ts` implementando `GameEngine`
2. Adicione integração em `src/lib/[jogo]/ai.ts` (similar à Trilha)
3. Atualize esta documentação com exemplos

## Referências

- [MCTS Wikipedia](https://en.wikipedia.org/wiki/Monte_Carlo_tree_search)
- [UCT Algorithm](https://www.chessprogramming.org/UCT)
- [OpenSpiel](https://github.com/deepmind/open_spiel) - Framework de jogos e IA (referência)
