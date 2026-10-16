/**
 * Quem gera `virtual:pwa-register/react` é o vite-plugin-pwa, que a config de
 * teste não carrega. O alias do `vitest.config.ts` aponta para cá; o teste que
 * precisa do registro substitui este módulo com `vi.mock`.
 */
export function useRegisterSW(): never {
  throw new Error('useRegisterSW: substitua com vi.mock no teste')
}
