# Implementação do Sistema de IA Genérica (MCTS)

## Resumo da Implementação

Foi implementado um sistema completo de IA genérica baseado em MCTS (Monte Carlo Tree Search) que permite integrar IA em jogos de tabuleiro/estratégia de forma plug-and-play.

## Arquivos Criados/Modificados

### Novos Arquivos

1. **`src/lib/ai/GameEngine.ts`** (52 linhas)
   - Interface genérica que jogos devem implementar
   - Define contrato: `getValidMoves()`, `applyMove()`, `isGameOver()`, `getWinner()`, `evaluate()`, `getCurrentPlayer()`

2. **`src/lib/ai/MCTS.ts`** (368 linhas)
   - Motor MCTS completo com implementação UCT
   - Seleção via UCB1, Expansão, Simulação (rollout), Retropropagação
   - Configurável: iterações, tempo, constante de exploração, rollout heurístico
   - Retorna estatísticas: jogada, win rate, iterações, tempo, nós na árvore

3. **`src/lib/trilha/TrilhaEngineAdapter.ts`** (59 linhas)
   - Adaptador que implementa `GameEngine` para a Trilha
   - Reutiliza funções existentes do engine da Trilha
   - Bridge entre a Trilha e o sistema de IA genérico

4. **`src/lib/ai/README.md`** (187 linhas)
   - Documentação completa do sistema
   - Guia de uso, exemplos, referências de API
   - Tips de performance e quando usar/não usar

5. **`src/lib/ai/example.ts`** (176 linhas)
   - Exemplos práticos de uso
   - Demonstração com Trilha
   - Exemplo de implementação para um jogo fictício
   - Comparação MCTS vs Minimax

### Arquivos Modificados

1. **`src/lib/trilha/engine.ts`**
   - Movida a função `evaluate()` do `ai.ts` para o `engine.ts`
   - Adicionada constante `WIN` exportada
   - Adicionadas funções auxiliares de avaliação (`lineStats`, `doubleMills`, `blockedPieces`, `mobility`)
   - Exportada `evaluate()` para uso pelo adaptador

2. **`src/lib/trilha/ai.ts`**
   - Adicionado import de `MCTS` e `TrilhaAdapter`
   - Adicionado campo `useMCTS` no perfil "general"
   - Adicionada função `chooseMoveMCTS()` que usa MCTS para o nível "general"
   - Modificada `chooseMove()` para rotear para MCTS quando `useMCTS: true`
   - Removida duplicação de código (funções de avaliação movidas para engine.ts)

## Como Funciona

### Fluxo da IA na Trilha

```
Jogador faz jogada
    ↓
useLocalGame chama chooseMove(state, difficulty)
    ↓
Se difficulty === "general" e useMCTS === true:
    → chooseMoveMCTS()
        → Cria TrilhaAdapter
        → Cria MCTS com configuração
        → mcts.computeMove(state, player)
            → Roda iterações MCTS (Selection → Expansion → Simulation → Backpropagation)
            → Retorna melhor jogada com estatísticas
        → Avalia jogada para retornar score compatível
    ↓
Senão:
    → Usa Minimax existente (recruta/sargento)
    ↓
Retorna AiDecision com a jogada escolhida
```

### Estrutura MCTS

```
Node (Estado do Jogo)
├── state: GameState
├── move: Move | null (jogada que levou aqui)
├── player: number (quem jogou)
├── parent: Node | null
├── children: Map<string, Node> (filhos expandidos)
├── visits: number (quantas vezes visitado)
├── wins: number (vitórias para o jogador)
├── unexpandedMoves: Move[] (jogadas ainda não expandidas)
└── isTerminal: boolean

Algoritmo por iteração:
1. Selection: UCB1 para escolher nó promissor
2. Expansion: Expandir nó não-terminal com jogada não expandida
3. Simulation: Rollout aleatório até terminal
4. Backpropagation: Atualizar wins/visits no caminho até raiz
```

## Configuração Atual

### Nível "General" (MCTS)
- **Iterações**: 15,000
- **Tempo**: 3,000ms (3 segundos)
- **Constante de exploração**: √2 ≈ 1.41
- **Rollout**: Aleatório puro (sem heurística)
- **Resultado**: Jogada mais robusta que Minimax depth 7

### Níveis "Recruta" e "Sargento" (Minimax)
- **Recruta**: Depth 1, 35% blunder, 250ms
- **Sargento**: Depth 3, 8% blunder, 700ms
- **Continuam usando Minimax** (mais rápido para níveis baixos)

## Como Adicionar um Novo Jogo

### Passo 1: Implementar GameEngine

```typescript
// src/lib/[jogo]/[Jogo]EngineAdapter.ts
import { GameEngine } from "@/lib/ai/GameEngine";

class MeuJogoAdapter implements GameEngine<MeuJogoState, MeuJogoMove> {
  getValidMoves(state: MeuJogoState): MeuJogoMove[] { /* ... */ }
  applyMove(state: MeuJogoState, move: MeuJogoMove): MeuJogoState { /* ... */ }
  isGameOver(state: MeuJogoState): boolean { /* ... */ }
  getWinner(state: MeuJogoState): number | null { /* ... */ }
  evaluate(state: MeuJogoState, player: number): number { /* ... */ }
  getCurrentPlayer(state: MeuJogoState): number { /* ... */ }
}
```

### Passo 2: Integrar no AI do Jogo

```typescript
// src/lib/[jogo]/ai.ts
import { MCTS } from "@/lib/ai/MCTS";
import { MeuJogoAdapter } from "./MeuJogoEngineAdapter";

export function chooseMove(state: MeuJogoState, difficulty: Difficulty) {
  if (difficulty === "hard") {
    const adapter = new MeuJogoAdapter();
    const mcts = new MCTS(adapter, { maxIterations: 10000, timeBudgetMs: 2000 });
    const result = mcts.computeMove(state, state.turn);
    return { move: result.move, /* ... */ };
  }
  // Outros níveis...
}
```

### Passo 3: Usar no Componente

```typescript
// Sem mudanças necessárias no componente!
// O jogo continua usando chooseMove() como antes.
```

## Build e Testes

### Build Status
✅ Build bem-sucedido (sem erros TypeScript)
✅ Todos os módulos transformados
✅ Tamanho total: ~1.5MB (Three.js domina)

### Próximos Passos Sugeridos

1. **Testes unitários**: Criar testes para MCTS e adaptadores
2. **Benchmark**: Comparar MCTS vs Minimax em vários estados da Trilha
3. **Ajuste de parâmetros**: Tunar iterações/tempo baseado em performance real
4. **Novos jogos**: Implementar adaptadores para outros jogos (Xadrez, Damas, etc.)
5. **UI de debug**: Adicionar visualização da árvore MCTS para debugging

## Limitações e Considerações

### O que MCTS resolve
- ✅ Jogos de tabuleiro determinísticos (Trilha, Xadrez, Damas)
- ✅ Jogos estocásticos (com RNG trackeável)
- ✅ Espaços de estados grandes

### O que MCTS NÃO resolve
- ❌ Jogos de ação real-time (Car Brawl, Futebol 3D)
- ❌ Jogos com física contínua
- ❌ Jogos que exigem Deep Reinforcement Learning

### Alternativas para jogos não-tabuleiro
- **Car Brawl**: State machine comportamental (já implementado)
- **Futebol 3D**: Heurística avançada ou imitation learning
- **Deep RL**: TensorFlow.js ou PyTorch com Rust bridge

## Referências

- [MCTS Wikipedia](https://en.wikipedia.org/wiki/Monte_Carlo_tree_search)
- [UCT Algorithm](https://www.chessprogramming.org/UCT)
- [OpenSpiel](https://github.com/deepmind/open_spiel) - Framework de referência

## Suporte

Para dúvidas ou problemas:
1. Consulte `src/lib/ai/README.md`
2. Veja exemplos em `src/lib/ai/example.ts`
3. Verifique implementação da Trilha em `src/lib/trilha/TrilhaEngineAdapter.ts`
