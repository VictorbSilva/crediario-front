# Armadilhas do Crediário

Este documento reúne os comentários explicativos que antes viviam no código-fonte do Crediário. Eles foram extraídos do código e movidos para cá — o código ficou mais enxuto, mas o raciocínio por trás de várias decisões não pode se perder.

> **Este arquivo é versionado de propósito.** Ele nasceu fora do repositório, como
> `Warnings-N-Cautions.md`, e foi trazido para cá em 28/08/2026 porque o `CLAUDE.md`
> manda lê-lo antes de tocar em três arquivos, e porque novas invariantes serão
> *escritas* nele — documento que precisa ser editado junto com o código tem que
> viver no mesmo commit que o código. Diferente do documento de progresso, aqui não
> há nada pessoal: só invariante técnica por arquivo.

**Leia isto antes de alterar `vite.config.ts`, `src/lib/firebase.ts` e `pwa-assets.config.ts`.** Vários dos comentários abaixo, especialmente os destacados como `> **AVISO**`, registram armadilhas já pagas — bugs que não aparecem no build e que só se manifestam em produção, offline, ou em plataformas específicas (Android, iOS).

Os comentários estão agrupados por arquivo, em ordem alfabética de caminho. Cada entrada termina com a referência ao trecho de código de origem (linhas do arquivo antes da remoção dos comentários).

---

## pwa-assets.config.ts

Geração dos ícones do PWA a partir de UM único arquivo: `public/favicon.svg`. Rode `npm run generate-pwa-assets` depois de alterar o SVG da marca.

O `vite.config.ts` lê este arquivo (`pwaAssets: { config: true }`) e injeta sozinho os ícones no manifest e os `<link>` no index.html — por isso os ícones NÃO são listados à mão em lugar nenhum.

— referente a pwa-assets.config.ts, linhas 3–10

Mesmo azul da logo (brand-600 no tailwind.config.js).

— referente a pwa-assets.config.ts, linha 12

Sem respiro: o SVG já é um quadrado azul arredondado, então ele deve ocupar o ícone inteiro em vez de flutuar com margem transparente.

— referente a pwa-assets.config.ts, linhas 20–21

> **AVISO**
> O padrão do gerador preenche o fundo de BRANCO. Num ícone maskable o Android recorta um círculo sobre a arte, o que deixaria uma borda branca em volta do azul. Preenchendo com a cor da marca, o recorte cai sempre sobre o azul e o desenho fica dentro da zona segura dos 30% de padding.

— referente a pwa-assets.config.ts, linhas 26–29

> **AVISO**
> iOS não aceita transparência no apple-touch-icon (vira preto) e aplica o arredondamento por conta própria — daí fundo azul e padding pequeno.

— referente a pwa-assets.config.ts, linhas 34–35

## src/App.tsx

> **AVISO**
> Tudo abaixo exige sessão. A guarda é conveniência de navegação; a autorização de verdade está nas regras do Firestore.

— referente a src/App.tsx, linhas 17–18

## src/auth/AuthProvider.tsx

Traduz os códigos de erro do Firebase Auth para algo que o dono da loja entenda. Sem isso a tela mostraria "auth/invalid-credential".

— referente a src/auth/AuthProvider.tsx, linhas 9–12

Caso importante: entrar exige internet, ao contrário do resto do app.

— referente a src/auth/AuthProvider.tsx, linha 26

Resolve offline também: a sessão fica salva em IndexedDB (ver firebase.ts).

— referente a src/auth/AuthProvider.tsx, linha 39

Sem `forceRefresh`: usa o token em cache, então funciona offline. O preço é que uma mudança de claim só chega no próximo refresh (até 1h, ou ao sair e entrar de novo).

— referente a src/auth/AuthProvider.tsx, linhas 46–48

`cause` preserva o erro original do SDK para depuração, sem vazar o código cru para a tela.

— referente a src/auth/AuthProvider.tsx, linhas 77–78

## src/auth/RequireAuth.tsx

> **AVISO**
> Guarda de rota. Enquanto o SDK ainda não resolveu se existe sessão salva, não decide nada — redirecionar aqui jogaria o usuário para o login a cada recarga, inclusive offline.
>
> Isto é conveniência de navegação, NÃO segurança: quem autoriza de verdade são as regras do Firestore. Nunca confiar na interface para autorização.

— referente a src/auth/RequireAuth.tsx, linhas 4–11

`state` guarda para onde o usuário queria ir, para voltar após entrar.

— referente a src/auth/RequireAuth.tsx, linha 29

Autenticado, mas o token não traz `businessId`. Sem isso não há caminho de dados possível — todo documento vive sob businesses/{businessId}/. Acontece quando a conta foi criada no console mas o claim não foi atribuído, ou quando o claim foi dado depois e o token ainda é o antigo.

— referente a src/auth/RequireAuth.tsx, linhas 33–36

## src/auth/auth-context.ts

Empresa a que este usuário pertence, lida do custom claim `businessId` do token. Todo caminho de dados vive sob `businesses/{businessId}/...`.

`null` com `usuario` preenchido significa conta autenticada mas sem empresa vinculada — ver AuthProvider.

— referente a src/auth/auth-context.ts, linhas 6–12

`true` enquanto o SDK ainda não disse se há sessão salva.

— referente a src/auth/auth-context.ts, linha 14

Em arquivo separado do AuthProvider de propósito: o `react-refresh/only-export-components` do ESLint quebra se um mesmo arquivo exporta componente e não-componente.

— referente a src/auth/auth-context.ts, linhas 20–24

## src/components/BrandMark.tsx

Marca da loja: silhueta de casa com um "H" formado pelas paredes internas. Desenhada em código (stroke = currentColor) para não depender de assets.

— referente a src/components/BrandMark.tsx, linhas 5–8

## src/components/SetupError.tsx

Tela mostrada quando o app não consegue nem inicializar — na prática, quando falta configuração do Firebase.

Existe porque o erro acontece no carregamento do módulo, antes do React montar qualquer coisa: sem isto o desenvolvedor vê uma tela branca e precisa abrir o console para descobrir o motivo.

— referente a src/components/SetupError.tsx, linhas 1–8

## src/components/layout/SignOutButton.tsx

Sair da conta. Usado pela Sidebar (desktop) e pela TopBar (celular).

— referente a src/components/layout/SignOutButton.tsx, linhas 4–6

## src/components/layout/TopBar.tsx

Cabeçalho apenas para telas pequenas. É o lugar previsto para o indicador de sincronização (offline-first) — ainda não implementado.

— referente a src/components/layout/TopBar.tsx, linhas 4–7

## src/components/layout/navItems.ts

Fonte única de navegação — consumida pela Sidebar e pela BottomNav.

— referente a src/components/layout/navItems.ts, linha 10

## src/components/pwa/PwaPrompt.tsx

Avisos do service worker: nova versão disponível e app pronto para uso offline.

NÃO é o indicador de sincronização do Firestore. Este componente só sabe sobre o service worker (código do app); ele não sabe nada sobre dados pendentes de gravação. O indicador de sync sai de metadados de snapshot e ainda não existe.

— referente a src/components/pwa/PwaPrompt.tsx, linhas 3–11

Uma atualização pendente é mais importante que o aviso de "pronto offline".

— referente a src/components/pwa/PwaPrompt.tsx, linha 21

Acima da BottomNav no celular (mesmo 4.5rem usado pelo AppShell).

— referente a src/components/pwa/PwaPrompt.tsx, linha 33

## src/index.css

Aplicação somente em tema claro. Impede o navegador de escurecer campos de formulário, barras de rolagem e autofill em dispositivos configurados no modo escuro.

— referente a src/index.css, linhas 7–9

## src/lib/firebase.ts

Inicialização única do Firebase.

As chaves vêm de `.env.local` (veja `.env.example`). Elas NÃO são segredo — a config web do Firebase vai no bundle e é pública por design. Quem protege os dados são as regras de segurança do Firestore, nunca o fato de a chave estar escondida.

— referente a src/lib/firebase.ts, linhas 17–24

> **AVISO**
> `initializeAuth` em vez de `getAuth` para escolher a persistência explicitamente. A ordem importa: o SDK usa a primeira que funcionar.
>
> IndexedDB primeiro porque sobrevive a fechar e reabrir o navegador — é o que permite o app continuar autenticado offline. Sem isso, reabrir sem internet jogaria o usuário para a tela de login e ele não conseguiria entrar (login exige rede).

— referente a src/lib/firebase.ts, linhas 50–58

> **AVISO**
> Persistência local do Firestore.
>
> `persistentMultipleTabManager` mantém o cache coerente se o usuário abrir o app em mais de uma aba — requisito explícito do projeto.
>
> Se o navegador não suportar (IndexedDB bloqueado, aba anônima em alguns navegadores), cair para cache em memória é melhor que quebrar o app: ele continua funcionando online, só perde o offline. O aviso fica no console porque é uma degradação silenciosa e importante.
>
> ATENÇÃO: este é o ÚNICO cache de dados do app. Não criar uma camada paralela (nem no Workbox, nem "na mão") — ela competiria com esta e serviria dado velho por cima do que o Firestore considera correto.

— referente a src/lib/firebase.ts, linhas 63–77

Emuladores locais, para desenvolver e testar regras sem tocar em produção.

— referente a src/lib/firebase.ts, linha 97

## src/main.tsx

`App` é importado dinamicamente para que uma falha na inicialização do Firebase (config ausente) vire uma tela explicativa em vez de tela branca. O erro acontece ao avaliar o módulo, antes de o React montar — por isso um error boundary não pegaria.

— referente a src/main.tsx, linhas 8–13

## src/vite-env.d.ts

Tipagem das variáveis de ambiente do projeto. Serve para o TypeScript reclamar de um nome errado em vez de entregar `undefined` em runtime.

— referente a src/vite-env.d.ts, linhas 3–6

'true' liga os emuladores locais em vez do Firebase de verdade.

— referente a src/vite-env.d.ts, linha 12

## vite.config.ts

https://vite.dev/config/

— referente a vite.config.ts, linha 6

'prompt' e não 'autoUpdate': o requisito pede que a atualização seja COMUNICADA ao usuário ("aviso de atualização disponível"). Com autoUpdate a troca acontece calada. Quem mostra o aviso e aplica a atualização é o src/components/pwa/PwaPrompt.tsx.

— referente a vite.config.ts, linhas 11–14

Ícones e <link> do head vêm do pwa-assets.config.ts. Não listar à mão.

— referente a vite.config.ts, linha 16

Sem travar orientação: o app precisa servir celular E desktop.

— referente a vite.config.ts, linha 29

> **AVISO**
> Só o shell do app é pré-cacheado. Os dados ficam por conta da persistência do Firestore.
>
> NÃO incluir `webmanifest` aqui: o plugin já injeta o manifest.webmanifest na lista de precache por conta própria. Incluir no glob faz a mesma URL entrar duas vezes com revisões diferentes, o Workbox aborta com `add-to-cache-list-conflicting-entries`, e o service worker ativa sem cachear NADA — o app deixa de abrir offline sem nenhum erro visível no build.

— referente a vite.config.ts, linhas 34–42

SPA: qualquer rota (/clientes, /rotas, ...) cai no index.html.

— referente a vite.config.ts, linha 44

> **AVISO**
> ATENÇÃO — não adicionar `runtimeCaching` para o Firestore. O SDK já tem persistência local própria (IndexedDB); cachear as chamadas dele no Workbox criaria uma segunda camada de cache competindo com a primeira e serviria dado velho por cima do que o Firestore considera correto. É proibido pelo requisito offline-first.

— referente a vite.config.ts, linhas 48–52

> **AVISO**
> O service worker fica fora do `npm run dev` DE PROPÓSITO.
>
> Não adianta ligar isto para "testar offline em dev": em dev o Vite serve o app sem bundle, como ~24 módulos separados gerados sob demanda (/src/main.tsx, /src/App.tsx, /node_modules/.vite/deps/...). Esses módulos não entram no precache — o service worker de dev pré-cacheia só `registerSW.js` e `/index.html`. Offline, o HTML abriria e todo o JavaScript falharia: tela branca.
>
> Testar PWA e offline SEMPRE pela build de produção:
>   npm run build && npm run preview

— referente a vite.config.ts, linhas 54–64

---

# Invariantes acrescentadas na varredura de defeitos (08/08/2026)

Estas NÃO vieram de comentários extraídos. São regras descobertas ao corrigir defeitos
depois que o código já estava sem comentários. Como não há mais comentários no código,
elas só existem aqui.

## src/lib/firebase.ts

> **AVISO**
> `initializeFirestore()` e `initializeAuth()` LANÇAM se chamados uma segunda vez
> ("initializeFirestore() has already been called with different options").
>
> Havia um `try/catch` cujo `catch` chamava `initializeFirestore()` de novo. Esse
> "fallback" derrubaria o app em vez de salvá-lo — a rede de segurança tinha um buraco
> exatamente no ponto em que seria acionada. Nos `catch` use `getFirestore(app)` e
> `getAuth(app)`, que devolvem a instância existente e nunca lançam.
>
> Pior: aquele `catch` também NÃO capturava o caso que dizia tratar. Falha de
> persistência (IndexedDB indisponível) não é lançada de forma síncrona por
> `initializeFirestore` — ela aparece depois, de forma assíncrona. Por isso a checagem
> de suporte agora é feita ANTES, com `suportaPersistencia()`, que testa `indexedDB`
> diretamente e é determinística.

`initializeApp` é protegido por `getApps().length > 0` para sobreviver a re-execução do
módulo (HMR).

## src/auth/AuthProvider.tsx

> **AVISO**
> `getIdTokenResult()` renova o token pela rede quando ele está expirado ou perto de
> expirar (~5 min). Offline isso REJEITA.
>
> A versão anterior concluía `businessId = null` nesse caso, e o usuário caía na tela
> "Conta sem empresa vinculada" — justamente no cenário de aceite principal do projeto
> (reabrir o app offline). Agora o `businessId` resolvido é gravado em `localStorage`
> por uid e usado como fallback quando a leitura do token falha.
>
> Isso NÃO é brecha de segurança: o valor só escolhe o caminho dos dados
> (`businesses/{businessId}/...`). Quem autoriza são as regras do Firestore — se o valor
> estiver errado, a regra recusa.

O callback do `onAuthStateChanged` é assíncrono, então duas mudanças de sessão em
sequência podem resolver fora de ordem. Antes de gravar o estado, o código confere
`ativo` (o efeito não foi desmontado) e `auth.currentUser?.uid === u.uid` (a resposta
ainda corresponde à sessão atual).

O código de erro `auth/api-key-not-valid...` (com o sufixo variável) tem mensagem
própria. Sem isso, uma chave errada em produção mostraria "Não foi possível entrar.
Tente novamente." para sempre, sem nenhuma pista de que o problema é configuração.

## src/App.tsx

> **AVISO**
> `<PwaPrompt />` fica FORA de `<RequireAuth>`, no nível do `App`.
>
> Ele estava dentro do `AppShell`, que está atrás da guarda de autenticação — ou seja,
> só aparecia para quem já tinha sessão E `businessId`. Como `registerType` é `prompt`
> (a atualização exige confirmação do usuário), alguém parado na tela de login ou na
> tela "Conta sem empresa vinculada" nunca veria o aviso e ficaria presa numa versão
> antiga do app, sem caminho para atualizar.

## Rejeições de Promise não tratadas

Handlers de clique que chamam função assíncrona (`sair()`, `updateServiceWorker()`)
usam `.catch()` com log. Antes usavam `void`, que descarta a Promise e transforma
qualquer falha em `unhandledrejection` silencioso.

## src/demo/dadosDemo.ts

> **AVISO**
> `src/demo/` contém dados FICTÍCIOS, escritos à mão só para validar o layout.
> Nenhum número ali saiu de regra de negócio — nem os totais do Financeiro, que
> são somas simples sem juros, multa ou arredondamento (essas regras seguem
> indefinidas).
>
> Toda página que consome esse módulo renderiza o `<DemoBanner />` dizendo isso na
> tela. **Ao ligar o Firestore, remover `src/demo/` e o `DemoBanner` juntos** — se
> só a fonte de dados mudar e o banner ficar, o app mente para o usuário dizendo
> que é demonstração; se só o banner sair, ele mente ao contrário, apresentando
> dado inventado como real.

O `<SyncBadge />` na Sidebar e na TopBar está fixo em `estado="nao-configurado"` de
propósito. Ele já aceita todos os estados exigidos (`sincronizado`, `sincronizando`,
`pendente`, `offline`, `erro`), mas ligá-lo a um estado otimista antes de existir
Firestore mostraria "Sincronizado" para dados que nunca saíram do aparelho.

---

# Invariantes sem dono — o que as Security Rules não expressam (28/08/2026)

Escrito na etapa 1, junto com a primeira regra por-coleção (`clients`).

Este projeto não tem Cloud Functions e não vai ter — o plano Spark não as inclui.
Isso faz do `firestore.rules` a **única** validação de schema que os dados vão ter.
As regras cobrem bastante: tipo de campo, obrigatoriedade, tamanho, lista fechada de
campos, imutabilidade e carimbo de tempo do servidor. O que segue é o que elas **não**
alcançam. Cada item aqui é um invariante que, se ninguém assumir explicitamente, não
tem dono nenhum.

## 1. Unicidade de `numero` — 🔴 sem dono hoje

Uma regra enxerga o documento sendo escrito e nada mais. Para saber se já existe outro
cliente com `numero: 7` seria preciso varrer a coleção, e regra não varre. `get()` lê um
documento de caminho conhecido, custa uma leitura faturada, e não resolve o caso real:
**dois dispositivos offline podem criar o número 7 ao mesmo tempo e ambos passam**, cada
um contra um cache que não conhece o outro.

Consequência prática: **nada impede dois clientes com o mesmo número.** É exatamente o
buraco que a decisão de alocação do `numero` (etapa 3) precisa fechar, e é por isso que
`max(numero) + 1` está descartado.

Enquanto a decisão não vem, o dono do invariante é o script de importação — que preserva
os números da planilha e não inventa nenhum.

## 2. `nomeBusca` ser de fato `normalizar(nome)` — 🟡 dono frágil

A regra verifica que `nomeBusca` existe, é string e tem tamanho plausível. Ela **não tem
como** verificar que é a normalização de `nome`: a linguagem das regras não faz
decomposição NFD nem remoção de diacríticos. `lower()` existe; tirar acento, não.

Dono: o caminho de escrita da aplicação, que deve derivar `nomeBusca` de `nome` num
lugar só. **Todo caminho de escrita alternativo quebra isso em silêncio** — edição pelo
console do Firebase, script Python, correção manual. O sintoma não é erro: é o cliente
sumir da busca.

## 3. `atualizadoPor` ser mesmo o dispositivo que escreveu — 🟢 aceito

É uma string autodeclarada. Regra nenhuma verifica a origem dela.

Isso é aceitável **porque o campo é diagnóstico, não autorização**: ele existe para
tornar diagnosticável a perda de campo sob last-write-wins. **Nunca usar `atualizadoPor`
numa condição de regra** — seria autorização baseada em algo que o próprio cliente
escreve.

## 4. Coerência entre documentos — 🔴 vai doer nas etapas 4 e 5

Regras avaliam **cada escrita isoladamente**, inclusive dentro de um `writeBatch`. Não
existe "valide o lote inteiro". Portanto nada disto é exprimível:

- a soma das parcelas ser igual ao valor da venda;
- o número de parcelas gravadas bater com `numeroParcelas`;
- `emAbertoCentavos` do cliente bater com as vendas dele;
- uma parcela pertencer a uma venda que existe.

Dono: a função pura que gera o carnê (`gerarParcelas()`, etapa 5) e os testes dela.
Registrar aqui porque isso significa que **o teste unitário da função é a única barreira**
entre um carnê torto e o Firestore — não há segunda linha de defesa.

## 5. O Admin SDK ignora as regras por completo — 🔴 estrutural

O script de importação (etapa 2) usa service account. Service account **bypassa as
Security Rules**: nenhuma validação deste arquivo se aplica a ele.

Consequência: toda validação que importa precisa existir **duas vezes** — uma nas regras,
para o aplicativo, e outra em Python, para a importação. Um schema validado só nas regras
é um schema que os 700 registros iniciais nunca viram.

## 6. Dígito verificador de CPF — 🟢 aceito

Regras não têm laço nem aritmética suficiente para calcular dígito verificador. A regra
limita tamanho de `cpfDigits` e nada mais.

Dono: o formulário, e o relatório da importação (etapa 2), que deve listar os CPFs
malformados **para o dono decidir** o que fazer — não para o script consertar sozinho.

## 7. O que É exprimível e ainda não foi feito

Para não confundir "impossível" com "ainda não":

- **Formato por regex.** `string.matches()` existe. `telefoneDigits` só com dígitos e
  `cpfDigits` com exatamente 11 dígitos são perfeitamente exprimíveis. Ficaram de fora
  de propósito: o relatório da importação (etapa 2) é que vai dizer quais formatos os
  700 registros reais têm. Apertar a regra antes disso é recusar dado verdadeiro.
- **Faixa de `numero`.** Hoje só `> 0`. Um teto (`<= 10000`) é trivial e vale quando a
  planilha disser qual é o N real.

## 8. O curinga `{documento=**}` anulava tudo isto

Até 28/08/2026 o `firestore.rules` terminava com:

```
match /{documento=**} {
  allow read, write: if podeAcessar(businessId);
}
```

> **AVISO**
> No Firestore, basta **uma** regra casada permitir para o acesso ser concedido. As
> regras são combinadas por OU, não por E. Uma regra por-coleção estrita escrita ao lado
> desse curinga seria **inerte**: o curinga também casa com `clients/{clientId}` e
> autoriza a escrita que a regra estrita acabou de recusar.

Por isso o curinga foi removido inteiro, e não apenas complementado. O efeito colateral é
proposital e vale escrito: **uma coleção nova agora é ingravável até a regra dela existir
neste arquivo.** É o que dá dente à regra do `CLAUDE.md` de que toda coleção nasce com
sua regra e seu teste no mesmo commit. `tests/regras/acesso.test.ts` tem os testes que
impedem o curinga de voltar sem que alguém perceba.
