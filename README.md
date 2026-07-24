# Crediário

Sistema de gestão de crediário para uma loja de pequeno porte com cerca de 700 clientes.
Controla o cadastro de clientes, as rotas de cobrança e as parcelas dos carnês.

A aplicação é *offline-first* e distribuída como PWA instalável, para que o cobrador
consiga trabalhar em campo mesmo sem sinal, sincronizando quando a conexão voltar.

## Status

**MVP em desenvolvimento.** No momento a aplicação contém apenas o shell de navegação —
nenhuma funcionalidade de negócio foi implementada.

## Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 3 (PostCSS + Autoprefixer)
- React Router 7
- lucide-react (ícones)
- @dnd-kit/core (ordenação das rotas por arrastar-e-soltar)

Instalados como dependência, mas **ainda não integrados**:

- Firebase (Firestore + Auth) — sem configuração nem inicialização
- vite-plugin-pwa — ainda não registrado no `vite.config.ts`

## Pré-requisitos

- Node.js 20 ou superior (exigido pelo Vite 8)
- npm

## Instalação

```bash
git clone <url-do-repositorio>
cd crediario
npm install
```

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o servidor de desenvolvimento com HMR |
| `npm run build` | Verifica os tipos (`tsc -b`) e gera o build de produção em `dist/` |
| `npm run lint` | Roda o ESLint em todo o repositório |
| `npm run preview` | Serve localmente o build de produção |

Ainda não há script nem framework de testes configurado.

## Estrutura do projeto

```
src/
  components/
    layout/      # AppShell, Sidebar, BottomNav, TopBar, navItems
    ui/          # componentes de apresentação reutilizáveis
    BrandMark.tsx
  pages/         # Clientes, Rotas, Financeiro
  App.tsx        # configuração das rotas
  main.tsx       # ponto de entrada
  index.css      # diretivas do Tailwind + estilos globais
```

O alias `@/*` aponta para `src/*` e está declarado em **dois** lugares —
`vite.config.ts` e `tsconfig.app.json`. Se ele mudar, os dois precisam ser atualizados.

Os tokens visuais (escala da cor `brand`, cores de status e a família tipográfica)
ficam em `tailwind.config.js`, que é a fonte única de verdade. O `index.css` guarda
apenas o mínimo que não dá para expressar como utilitário do Tailwind.

## O que ainda não existe

- PWA: manifest, service worker e ícones
- Configuração e inicialização do Firebase
- Regras de segurança do Firestore
- Autenticação
- Modelos de dados do domínio (clientes, rotas, parcelas)
- Toda a lógica de negócio — as regras financeiras (juros, multa, arredondamento,
  estados de pagamento) ainda não estão especificadas
