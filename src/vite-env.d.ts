/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_BUSINESS_ID?: string
  readonly VITE_USE_FIREBASE_EMULATORS?: string
  readonly VITE_LOJA_NOME?: string
  readonly VITE_LOJA_CNPJ?: string
  readonly VITE_LOJA_TELEFONE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
