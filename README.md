# Crediário

Sistema de gestão de crediário para uma loja de pequeno porte com cerca de 700 clientes.
Controla o cadastro de clientes, as rotas de cobrança e as parcelas dos carnês.

A aplicação é *offline-first* e distribuída como PWA instalável, para que o cobrador
consiga trabalhar em campo mesmo sem sinal, sincronizando quando a conexão voltar.

## Status

**MVP em desenvolvimento.** A aplicação já é um PWA instalável e o shell abre offline,
mas nenhuma funcionalidade de negócio foi implementada — as três páginas são
placeholders.

## Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 3 (PostCSS + Autoprefixer)
- React Router 7
- lucide-react (ícones)
- @dnd-kit/core (ordenação das rotas por arrastar-e-soltar)
- vite-plugin-pwa (Workbox) — manifest, service worker e precache do shell
- Firebase — Auth (e-mail/senha) e Firestore com persistência local

## Configuração do Firebase

O app não sobe sem isso. Se faltar configuração, em vez de tela branca aparece uma tela
explicando o que fazer.

1. Crie um projeto no console do Firebase e registre um **app Web**.
2. Ative **Authentication → Sign-in method → E-mail/senha**.
3. Crie o usuário do proprietário em **Authentication → Users** (o app não tem tela de
   cadastro: é sistema de um usuário só).
4. Crie o **Firestore Database**.
5. Copie `.env.example` para `.env.local` e preencha com os dados de
   *Configurações do projeto → Seus apps → Web*.

Esses valores **não são segredo** — a config web do Firebase vai no bundle e é pública por
design. Quem protege os dados são as regras de segurança do Firestore. O `.env.local` fica
fora do Git por higiene, não por sigilo. A credencial que **é** segredo é a service account
do script de importação em Python, que nunca entra no repositório.

### Persistência e offline

`src/lib/firebase.ts` é o único ponto de inicialização:

- **Firestore** com `persistentLocalCache` + `persistentMultipleTabManager` (a API atual;
  `enableIndexedDbPersistence` está depreciada). Se o navegador não suportar, cai para
  cache em memória com aviso no console — o app continua funcionando online e perde só o
  offline.
- **Auth** com `initializeAuth` e persistência em IndexedDB. É isso que mantém a sessão ao
  fechar e reabrir o navegador **sem internet**. Sem essa persistência, reabrir offline
  jogaria o usuário para o login — e login exige rede.

> **Entrar exige internet.** O resto do app não. Uma vez autenticado, a sessão sobrevive
> offline; a tela de login avisa isso quando a rede falha.

Esse cache do Firestore é a **única** camada de cache de dados do app. Não criar outra em
paralelo — ver o aviso sobre `runtimeCaching` na seção de PWA.

### Empresa (`businessId`) e regras

Todo documento vive sob `businesses/{businessId}/…`. Isso existe desde o começo porque
migrar dados vivos depois — com vendas, parcelas e pagamentos amarrados — é bem pior que
carregar um segmento a mais no caminho.

Como o app descobre a empresa do usuário, em ordem de precedência:

1. **Custom claim `businessId`** do token, se existir.
2. **`VITE_BUSINESS_ID`** do `.env`.
3. O último valor conhecido, guardado em `localStorage` (só serve offline, quando a
   renovação do token falha).

Hoje só existe a opção 2: uma empresa, um usuário. Quando o multiusuário virar produto,
basta passar a atribuir o claim — **o app não muda**, porque o claim já tem prioridade.
Mudam apenas as regras e o script que atribui o claim.

Se nenhuma das três resolver, o app mostra "Conta sem empresa vinculada" em vez de tentar
ler um caminho inválido.

As regras ficam em `firestore.rules` (versionado). Elas negam tudo por padrão e liberam
apenas: o UID do dono, ou quem tiver o claim da empresa correspondente.

> **Antes de publicar as regras**, substitua `COLE_AQUI_O_UID_DO_DONO` pelo UID real
> (Firebase → Authentication → Users → coluna *Identificador do usuário*). Enquanto o
> placeholder estiver lá, tudo é negado — que é o lado seguro de errar.

```bash
npx firebase-tools deploy --only firestore:rules
```

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
| `npm run generate-pwa-assets` | Regera os ícones do PWA a partir de `public/favicon.svg` |

Ainda não há script nem framework de testes configurado.

## PWA

O app é instalável no celular e no desktop. A configuração fica em dois arquivos:

- `vite.config.ts` — plugin `VitePWA`: manifest, estratégia `generateSW` e o precache
  do shell (HTML, JS, CSS e ícones).
- `pwa-assets.config.ts` — geração dos ícones a partir de **um único** arquivo,
  `public/favicon.svg`. Os PNGs em `public/` são gerados; para alterá-los, edite o SVG e
  rode `npm run generate-pwa-assets`.

Os `<link>` de ícone e o `<meta name="theme-color">` são **injetados pelo plugin** — por
isso não aparecem no `index.html`. Declará-los à mão duplica as tags.

### Aviso de atualização

`registerType` é **`prompt`**, não `autoUpdate`: o requisito pede que a atualização seja
comunicada ao usuário. Quem mostra o aviso é `src/components/pwa/PwaPrompt.tsx`, montado
no `AppShell`. Ele cobre dois estados do service worker:

- **"Nova versão disponível."** com os botões *Atualizar* e *Depois*. *Atualizar* manda
  `SKIP_WAITING` ao worker em espera e recarrega a página já na versão nova.
- **"Pronto para uso sem internet."** na primeira instalação, quando o precache termina.

Esse componente **não** é o indicador de sincronização do Firestore. Ele só sabe sobre o
service worker (o código do app); não sabe nada sobre dados pendentes de gravação. O
indicador de sync é trabalho separado e sai de metadados de snapshot.

### Como testar offline

**`npm run dev` não funciona offline, e isso é esperado.** Se você puser o DevTools em
*Network → Offline* com o dev server rodando, a página não carrega. Não é bug do PWA.

Em desenvolvimento o Vite serve o app **sem bundle**, como ~24 módulos separados gerados
sob demanda (`/src/main.tsx`, `/src/App.tsx`, `/node_modules/.vite/deps/…`). Esses módulos
não entram no precache: o service worker de desenvolvimento pré-cacheia apenas
`registerSW.js` e `/index.html`. Offline, o HTML abriria e todo o JavaScript falharia —
tela branca. Por isso `devOptions` está desligado no `vite.config.ts`; ligar não resolve.

Offline só se testa na build de produção, que é bundlada e pré-cacheada:

```bash
npm run build && npm run preview
```

Depois abra `http://localhost:4173`, confirme no DevTools (*Application → Service
Workers*) que o worker está `activated`, e só então corte a rede — ou, melhor ainda,
**derrube o processo do preview**, que é um teste mais honesto que o modo offline do
DevTools.

Duas armadilhas já encontradas, para não repetir:

- **Não** incluir `webmanifest` no `workbox.globPatterns`. O plugin já injeta o
  `manifest.webmanifest` no precache; incluir no glob coloca a mesma URL duas vezes com
  revisões diferentes, o Workbox aborta com `add-to-cache-list-conflicting-entries` e o
  service worker ativa **sem cachear nada** — o app para de abrir offline e o build não
  acusa nada.
- **Não** adicionar `runtimeCaching` para o Firestore. O SDK tem persistência local
  própria; cachear as chamadas dele no Workbox cria uma segunda camada competindo com a
  primeira e serve dado velho por cima do que o Firestore considera correto.

## Estrutura do projeto

```
public/              # favicon.svg (fonte) + ícones do PWA gerados a partir dele
pwa-assets.config.ts # receita de geração dos ícones
.env.example         # modelo do .env.local (config do Firebase)
src/
  auth/          # AuthProvider, contexto, useAuth, RequireAuth
  lib/
    firebase.ts  # ponto único de inicialização do Firebase
  components/
    layout/      # AppShell, Sidebar, BottomNav, TopBar, navItems, SignOutButton
    pwa/         # PwaPrompt (aviso de atualização / pronto offline)
    ui/          # componentes de apresentação reutilizáveis
    BrandMark.tsx
    SetupError.tsx
  pages/         # Login, Clientes, Rotas, Financeiro
  App.tsx        # rotas + guarda de autenticação
  main.tsx       # ponto de entrada
  index.css      # diretivas do Tailwind + estilos globais
```

O alias `@/*` aponta para `src/*` e está declarado em **dois** lugares —
`vite.config.ts` e `tsconfig.app.json`. Se ele mudar, os dois precisam ser atualizados.

Os tokens visuais (escala da cor `brand`, cores de status e a família tipográfica)
ficam em `tailwind.config.js`, que é a fonte única de verdade. O `index.css` guarda
apenas o mínimo que não dá para expressar como utilitário do Tailwind.

## O que ainda não existe

- Leitura e escrita reais no Firestore (as telas usam `src/demo/`)
- Indicador de sincronização (estado pendente/sincronizado)
- Modelos de dados do domínio (clientes, rotas, parcelas)
- Toda a lógica de negócio — as regras financeiras (juros, multa, arredondamento,
  estados de pagamento) ainda não estão especificadas
