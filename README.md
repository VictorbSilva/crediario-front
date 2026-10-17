# Crediário

Sistema de gestão de crediário para uma loja de pequeno porte com cerca de 700 clientes.
Controla o cadastro de clientes, as rotas de cobrança e as parcelas dos carnês.

A aplicação é *offline-first* e distribuída como PWA instalável, para que o cobrador
consiga trabalhar em campo mesmo sem sinal, sincronizando quando a conexão voltar.

## Status

**MVP em desenvolvimento, com dados reais do Firestore em todas as telas de negócio.**
Clientes oferece cadastro, busca, edição dos dados e dias de visita, arquivamento e
desarquivamento. A página individual permite lançar vendas, registrar e estornar
pagamentos e cancelar vendas, preservando o histórico.

Rotas mostra as visitas de hoje e o planejamento no calendário do mês atual e do seguinte,
com ordenação por arrasto e marcas de visita. Financeiro é só leitura: a receber, vencido,
recebido no mês atual e parcelas a receber no mês escolhido. O backup JSON inclui
clientes, vendas, parcelas e pagamentos; o CSV continua sendo uma lista de clientes.

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
fora do Git por higiene, não por sigilo. **Não existe credencial administrativa neste
projeto**: não há script de importação nem service account, e os clientes são cadastrados
pelo próprio app. Isso torna `firestore.rules` a validação única e completa — não há
caminho de escrita que passe por fora dela.

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

Ao ler o token, o app prefere o **custom claim `businessId`** e usa `VITE_BUSINESS_ID`
como alternativa. Só o claim é salvo em `localStorage`, por usuário; sem claim, esse
valor salvo é removido. Se a leitura do token falhar, tenta o claim salvo e depois a
variável de ambiente.

Sem empresa resolvida, o app mostra "Conta sem empresa vinculada" em vez de tentar
ler um caminho inválido.

As regras ficam em `firestore.rules` (versionado). Elas negam tudo por padrão e liberam
o dono em todas as empresas, a conta de testes somente em `loja-treino`, ou quem tiver o
claim da empresa correspondente. As quatro coleções de negócio têm regras próprias:
`clients`, `sales`, `installments` e `payments`.

> O UID do dono fica fixo em `firestore.rules`, na função `ehDono()`. Ao publicar as
> regras contra um projeto Firebase diferente do atual, troque esse UID pelo do dono de
> lá (Firebase → Authentication → Users → coluna *Identificador do usuário*). Com o UID
> errado a conta do dono perde essa autorização. A conta de testes tem literal separado
> em `ehTesteNoTreino()`; os identificadores correspondentes nos testes de regras precisam
> acompanhar qualquer troca.

Cada coleção nasce com a sua própria regra. **Não** existe `match /{documento=**}` no
arquivo: as regras se combinam por *ou*, então um curinga permissivo anula qualquer regra
estrita escrita depois. O efeito colateral é que uma coleção ainda sem regra própria fica
inacessível — que é o lado seguro de errar.

```bash
npx firebase-tools deploy --only firestore:rules
```

## Pré-requisitos

- Node.js **22** (`.nvmrc`; `engines: >=22 <23`, com `engine-strict` em `.npmrc`)
- npm
- JDK **21 ou superior**, apenas para rodar o emulador do Firestore (`npm run emu` e
  `npm run test:rules`). O `firebase-tools` 15 recusa o JDK 17 com
  `no longer supports Java version before 21` — o 17 ser LTS engana.

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
| `npm run preview:treino` | Gera o build de produção apontado para `loja-treino` e serve em `http://localhost:4174` |
| `npm test` | Roda a suíte de testes da aplicação uma vez (Vitest) |
| `npm run test:watch` | A mesma suíte em modo *watch* |
| `npm run test:coverage` | Roda a suíte com cobertura; exige pelo menos 70% em linhas, funções, ramos e instruções |
| `npm run test:rules` | Sobe o emulador do Firestore e roda os testes das regras de segurança |
| `npm run emu` | Sobe os emuladores de Firestore e Auth para desenvolvimento local |
| `npm run generate-pwa-assets` | Regera os ícones do PWA a partir de `public/favicon.svg` |
| `npm run revisar -- main` | Executa o revisor local contra a base informada; sem argumento usa `origin/main` |

### Testes

Contagens verificadas em 17/10/2026 nesta revisão: **1.005 testes em 43 arquivos** por
`npm test` e **144 testes em 3 arquivos** por `npm run test:rules`.
São duas suítes separadas, cada uma com a sua configuração:

- **`vitest.config.ts`** — testes de `src/**/*.test.{ts,tsx}`: funções de negócio,
  camada de dados, autenticação, componentes e páginas. O ambiente padrão é `node`;
  os testes que montam interfaces pedem `jsdom`. `globals` está desligado de propósito:
  importar `describe`/`it`/`expect` explicitamente é o que mantém o `tsc -b` passando sem
  configuração de tipos extra.
- **`vitest.rules.config.ts`** — testes de `tests/regras/`, que exercitam o
  `firestore.rules` de verdade contra o emulador, via `@firebase/rules-unit-testing`.
  Rodam por `npm run test:rules`, que sobe e derruba o emulador sozinho.

Toda coleção nova nasce com a sua regra **e** com o teste de regra correspondente, no
mesmo commit. Sem Cloud Functions (plano Spark), a regra é a única validação de schema que
este projeto vai ter.

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
no `App`, fora da guarda de autenticação, inclusive no login. Ele cobre dois estados do service worker:

- **"Nova versão disponível."** com os botões *Atualizar* e *Depois*. *Atualizar* manda
  `SKIP_WAITING` ao worker em espera e recarrega a página já na versão nova.
- **"Pronto para uso sem internet."** na primeira instalação, quando o precache termina.

Esse componente **não** é o indicador de sincronização do Firestore. Ele só sabe sobre o
service worker (o código do app); não sabe nada sobre dados pendentes de gravação. O
`SyncBadge` em `TopBar` e `Sidebar` recebe o estado derivado dos snapshots de clientes;
ele não agrega as escritas do carnê.

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
npm run preview:treino
```

Depois abra `http://localhost:4174` — não a 4173: lá mora o service worker de builds
antigos que gravavam em `loja-principal`, e outra porta é outra origem, sem esse worker nem
a fila offline dele. Confirme no DevTools (*Application → Service
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

## Deploy (Vercel)

A Vercel gera um build a cada push, com a configuração versionada em `vercel.json`
(rewrite de SPA e cabeçalhos de cache):

- **`main` → Production.**
- **Qualquer outro branch → Preview**, gravando em `loja-treino`. O branch `treino` é o
  endereço estável de teste: cada deploy tem URL própria, e cada URL é uma origem própria,
  com cache, fila offline, service worker e login próprios.

As variáveis ficam no painel (*Settings → Environment Variables*), por ambiente:

| Variável | Production | Preview |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | sim | sim |
| `VITE_BUSINESS_ID` | **cadastrar somente na entrega ao dono** | `loja-treino` |

Sem claim, claim salvo ou `VITE_BUSINESS_ID`, o app não resolve uma empresa e a guarda
impede abrir as telas de negócio. Manter a variável de Production ausente até a entrega
é a orientação para que `loja-principal` só receba dado quando o dono começar a usar.

Para atualizar o treino com o que está na `main`:

```bash
git push origin main:treino
```

Só avanço rápido: nunca faça commit direto no `treino`, para que o push acima nunca
precise de força.

Variável mudada no painel **só vale no próximo deploy**: o Vite a embute no build. Depois
de mudar, use *Redeploy* no deploy mais recente.

O deploy das regras do Firestore continua manual (`firebase deploy --only
firestore:rules`); o CI só verifica.

## Estrutura do projeto

```
.github/workflows/   # CI: lint, build, cobertura e testes de regras
.claude/scripts/     # revisor local de PR
docs/                # armadilhas e invariantes técnicas
public/              # favicon.svg (fonte) + ícones do PWA gerados
scripts/             # firebase-com-jdk.mjs (prioriza o JDK do JAVA_HOME)
src/
  auth/          # AuthProvider, contexto, useAuth, RequireAuth, recuperação de senha
  data/          # ClientesProvider/contexto/useClientes, useCarne, useCarneDaEmpresa
  types/         # cliente.ts e venda.ts: Cliente, Venda, Parcela, Pagamento
  lib/           # funções de negócio (com testes ao lado) e inicialização do Firebase
    ambiente.ts, carne.ts, cliente.ts, cpf.ts, data.ts, dinheiro.ts, dispositivo.ts
    exportacao.ts, financeiro.ts, firebase.ts, parcelas.ts, rotas.ts, sync.ts, texto.ts, venda.ts
  components/
    clientes/    # cadastro/edição, dias de visita, lista, painel, identidade, arquivo e exportação
      carne/     # carnê, resumos, vendas, parcelas, pagamentos e cancelamento de venda
    layout/      # AppShell, navegação, TopBar, SyncBadge, SignOutButton, useTelaLarga
    rotas/       # SeletorDoDia (calendário) e ParadaDaRota
    pwa/         # PwaPrompt (aviso de atualização / pronto offline)
    ui/          # componentes de apresentação reutilizáveis
    BrandMark.tsx
    FaixaDeTreino.tsx
    SetupError.tsx
  pages/         # Login, Clientes, Cliente (/clientes/:id), Rotas, Financeiro
  test/          # apoio dos testes: diálogo e stub do registro do PWA
  App.tsx        # rotas + guarda de autenticação
  main.tsx       # ponto de entrada
  index.css      # diretivas do Tailwind + estilos globais
tests/regras/    # acesso, clientes e vendas/parcelas/pagamentos, com ambiente comum
.env.example     # modelo da configuração local do Firebase
.env.development, .env.treino  # loja-treino nos modos locais de teste
firestore.rules, firestore.indexes.json, firebase.json
pwa-assets.config.ts, vite.config.ts
vitest.config.ts, vitest.rules.config.ts
package.json, .nvmrc, .npmrc
```

O alias `@/*` aponta para `src/*` e está declarado em **dois** lugares —
`vite.config.ts` e `tsconfig.app.json`. Se ele mudar, os dois precisam ser atualizados.

Os tokens visuais (escala da cor `brand`, cores de status e a família tipográfica)
ficam em `tailwind.config.js`, que é a fonte única de verdade. O `index.css` guarda
apenas o mínimo que não dá para expressar como utilitário do Tailwind.

## O que já funciona ponta a ponta

- Cadastro, busca, edição dos dados e dias de visita, arquivamento e desarquivamento de clientes
- Backup JSON versão 2 de clientes, vendas, parcelas e pagamentos; CSV só de clientes
- Página individual do cliente (`/clientes/:id`): carnê com vendas expansíveis, parcelas,
  situação derivada e simulação de encargo atrás de um interruptor desligado por padrão
- Lançar venda (gera o carnê), registrar e estornar pagamento, cancelar venda sem estornar pagamentos
- Rotas de hoje com Visitado/Ausente/Desmarcar e planejamento por calendário, com ordem por dia do mês
- Financeiro só de leitura, com totais, clientes em atraso e parcelas a receber por mês

O aceite manual de PWA e offline deve ser feito com `npm run preview:treino`, inclusive
fechar e reabrir sem rede e sincronizar depois. As suítes automatizadas não certificam
o comportamento no aparelho usado em campo.

## O que ainda não existe

- Registro persistente de falhas de escrita entre sessões. Hoje os `.catch()` alimentam
  apenas o estado em memória do provider/hook montado; reabrir o app não recupera a recusa
  de uma escrita da sessão anterior. Essa recuperação fica fora do MVP; uma coleção de
  erros, sozinha, não recuperaria os callbacks perdidos ao fechar o app.

As **regras financeiras deixaram de ser a incógnita**: o dono respondeu em 21/09/2026 e
elas estão em Domain Notes no `CLAUDE.md`. Em resumo — não existe renegociação como
funcionalidade, pagamento é valor livre contra a venda (livro-caixa, situação da parcela
derivada), e juros e multa são **simulação desligada por padrão**, usada como pressão de
cobrança e não como cobrança.
