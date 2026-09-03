import { defineConfig } from 'vitest/config'

// Config separada da vitest.config.ts de propósito.
//
// Os testes de regra precisam do emulador do Firestore de pé. Se morassem na
// suíte padrão, `npm test` passaria a falhar em qualquer máquina sem emulador
// (e sem Java) — o que treina qualquer um a ignorar teste vermelho. Aqui eles
// ficam atrás de `npm run test:rules`, que sobe e derruba o emulador sozinho.
//
// Sem alias '@': estes testes não importam nada de src/. Eles exercitam o
// firestore.rules, que é a fronteira, não o código da aplicação.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/regras/**/*.test.ts'],
    // O emulador é um processo só e os testes compartilham a mesma base:
    // rodar arquivos em paralelo faria o clearFirestore() de um apagar o
    // estado semeado por outro no meio da execução.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
})
