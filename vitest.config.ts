import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Config separada do vite.config.ts de propósito: os testes não precisam do
// plugin do PWA (que gera service worker e ícones a cada execução) nem do
// plugin do React. Só os aliases precisam ser repetidos aqui.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Módulo virtual do plugin do PWA, que aqui não roda.
      'virtual:pwa-register/react': path.resolve(__dirname, './src/test/pwa-register.ts'),
    },
  },
  test: {
    // `node` continua sendo o padrão. Teste que precisa de DOM (clique, digitação,
    // efeito montado de verdade) pede jsdom na primeira linha do próprio arquivo.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    // O runner do CI roda em UTC e a máquina do dono, em UTC-3. Sem fixar o
    // fuso, o teste que prova que `dataLocalISO` não usa `toISOString()`
    // passaria em UTC por acidente — é justamente em fuso negativo que as
    // duas respostas divergem.
    env: { TZ: 'America/Sao_Paulo' },
    coverage: {
      provider: 'v8',
      // Sem `include`, o relatório só conta os arquivos que algum teste importa, e
      // arquivo sem teste nenhum some da conta em vez de entrar como 0%.
      include: ['src/**/*.{ts,tsx}'],
      // `src/test/` guarda apoio para os testes (o polyfill do `<dialog>` e o stub do
      // registro do PWA), não código do app.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts', 'src/test/**'],
      thresholds: { statements: 70, branches: 70, functions: 70, lines: 70 },
    },
  },
})
