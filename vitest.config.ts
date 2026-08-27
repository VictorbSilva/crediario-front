import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Config separada do vite.config.ts de propósito: os testes não precisam do
// plugin do PWA (que gera service worker e ícones a cada execução) nem do
// plugin do React. Só o alias '@' precisa ser repetido aqui.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
