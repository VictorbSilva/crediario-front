# Armadilhas do Crediário

Este documento reúne os comentários explicativos que antes viviam no código-fonte do Crediário. Eles foram extraídos do código e movidos para cá — o código ficou mais enxuto, mas o raciocínio por trás de várias decisões não pode se perder.

> **Este arquivo é versionado de propósito.** Ele nasceu fora do repositório, como
> `Warnings-N-Cautions.md`, e foi trazido para cá em 28/08/2026 porque o `CLAUDE.md`
> manda lê-lo antes de tocar em três arquivos, e porque novas invariantes serão
> *escritas* nele — documento que precisa ser editado junto com o código tem que
> viver no mesmo commit que o código. Diferente do documento de progresso, aqui não
> há nada pessoal: só invariante técnica por arquivo.

**Leia isto antes de alterar `vite.config.ts`, `src/lib/firebase.ts`, `pwa-assets.config.ts` e `firestore.rules`.** Vários dos comentários abaixo, especialmente os destacados como `> **AVISO**`, registram armadilhas já pagas — bugs que não aparecem no build e que só se manifestam em produção, offline, ou em plataformas específicas (Android, iOS).

Os comentários estão agrupados por arquivo, em ordem alfabética de caminho. Cada entrada termina com a referência ao trecho de código de origem (linhas do arquivo antes da remoção dos comentários, ou o nome da função quando a referência por linha envelheceria rápido).

---

## firestore.rules

> **AVISO**
> **POSTURA: negar por padrão.** Uma coleção só se torna gravável depois que a regra dela existe neste arquivo. Não há curinga `{documento=**}` de propósito — ele existia até 28/08/2026 e tornava inerte qualquer regra por-coleção, porque no Firestore basta UMA regra casada permitir para o acesso ser concedido. Ver o item 9 mais abaixo.

Este projeto não tem Cloud Functions e não vai ter (plano Spark), nem service account: não existe credencial administrativa que ignore estas regras. Elas são a validação completa dos dados, não a primeira de várias camadas.

**ACESSO, HOJE:** só o dono usa o app, e `ehDono()` é a única porta que abre. `pertenceAEmpresa()` depende do custom claim `businessId`, e custom claim só o Admin SDK grava — que este projeto não tem. O caminho do funcionário está escrito e testado (o emulador forja o claim à vontade), mas não tem como existir em produção. Múltiplos usuários são atualização pós-MVP.

— referente ao cabeçalho de firestore.rules

A lista fechada de `camposConhecidos()` é o que transforma um campo digitado errado em erro de escrita, em vez de um documento silenciosamente torto. O preço é que campo novo exige mexer na regra e no teste — que é exatamente a regra do `CLAUDE.md`, não um efeito colateral dela.

— referente a firestore.rules, `camposConhecidos()`

`serverTimestamp()` é resolvido pelo servidor no instante em que a escrita é processada — o mesmo valor de `request.time`. Exigir a igualdade impede o dispositivo de escolher a própria data. Continua valendo para escrita offline: o carimbo nasce quando a fila sobe, não quando foi enfileirada.

— referente a firestore.rules, `carimboDeCriacao()`

`numero` é fixo por decisão do dono: a lista de papel vai de 1 a N e essa ordem não muda. `criadoEm` e `cadastradoEm` são fatos históricos — um diz quando sincronizou, o outro quando o dono estava lá.

— referente a firestore.rules, `imutaveisPreservados()`

Sem `delete` pelo app. Um handler com bug apaga sem perguntar, e o histórico do cliente é o ativo mais caro deste sistema. Cadastro errado se resolve com `arquivado: true`. Exclusão de titular (LGPD) é operação do dono pelo console, não da interface.

— referente a firestore.rules, `allow delete: if false`

### `cadastradoEm` — acrescentado na etapa 3 (03/09/2026)

`cadastradoEm` é a data em que o dono **estava na casa do cliente**, lida do relógio do aparelho. Existe porque `criadoEm` não responde isso: ele é `request.time`, o instante em que a fila offline subiu. Cadastro feito numa terça sem sinal que só sincroniza no sábado tem `criadoEm` = sábado, e a diferença não é recuperável depois. É a resolução da armadilha #3.

**String `'YYYY-MM-DD'` e não `Timestamp`:** o que se registra é uma data de calendário no fuso local, não um instante. `Timestamp` obrigaria a escolher uma hora e reintroduziria fuso numa pergunta que não tem fuso. Mesma convenção já decidida para vencimento de parcela.

> **AVISO**
> **Nasceu obrigatório, e essa janela não volta.** O app é o único escritor e sempre preenche o campo; campo que existe em alguns documentos e falta em outros obriga toda consulta futura a tratar o buraco. Só foi possível porque a coleção em produção estava **vazia** em 03/09/2026 (verificado no console). Tornar um campo obrigatório **depois** que existe dado é porta de mão única: `obrigatoriosPresentes()` também vale no `update`, então todo documento antigo sem o campo fica **inatualizável** — e como `delete` é proibido, fica encalhado para sempre. O teste `recusa edição de documento sem cadastradoEm` existe para deixar essa consequência visível.

O regex `^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$` recusa a classe grosseira de lixo (`2026-9-3`, `03/09/2026`, `2026-13-01`, `9999-99-99`) a custo zero. Ele **não** valida 30 de fevereiro — regra não tem calendário, e há um teste afirmando que `2026-02-30` passa. O dono desse resto é o formulário.

— referente a firestore.rules, `tiposValidos()` e `imutaveisPreservados()`

## tests/regras/ambiente.ts

Projeto com prefixo `demo-`: o SDK reconhece esse prefixo como projeto de emulador e recusa qualquer chamada de rede para produção. É a garantia de que um teste de regra nunca escreve na base real.

— referente a tests/regras/ambiente.ts, `PROJETO`

`UID_DONO` é o UID real do dono, o mesmo que está literal em `firestore.rules`.

— referente a tests/regras/ambiente.ts, `UID_DONO`

`clienteValido()` é o documento que passa em todas as validações. Os testes de schema partem daqui e estragam **um campo por vez** — assim a causa da recusa é sempre o campo em questão, e não uma segunda coisa errada que ninguém percebeu.

— referente a tests/regras/ambiente.ts, `clienteValido()`

> **AVISO**
> `clienteComoOAppEscreve()` é o documento **literal** que o formulário de cadastro monta (`src/lib/cliente.ts`). É **cópia manual**, e de propósito: `vitest.rules.config.ts` não tem o alias `@` porque estes testes exercitam a fronteira, não o código da aplicação. O preço da cópia é que os dois lados podem divergir — e os testes que usam esse helper são o **único** lugar que percebe quando divergem. Ao mexer nos campos que o formulário grava, mexer aqui também.
>
> Repare no que **não** está lá: `rotaId`. A coleção `routes/` ainda não tem regra, então é ingravável, e o formulário não oferece o campo.

— referente a tests/regras/ambiente.ts, `clienteComoOAppEscreve()`

## tests/regras/clients.test.ts

`semear()` grava direto, com as regras desligadas, para montar o estado de partida dos testes de edição.

— referente a tests/regras/clients.test.ts, `semear()`

A lista fechada de campos é a única coisa entre um typo de campo e 700 documentos tortos — daí os dois testes de campo desconhecido, um deles com valor monetário em string, que é a forma mais provável de o erro aparecer.

— referente a tests/regras/clients.test.ts, `describe('clients — campos desconhecidos')`

Os dois testes `aceita o documento que o formulário monta` não checam um campo isolado: checam a **forma inteira** que o app grava de verdade, cheia e mínima. É o teste de deriva entre formulário e regra. Se alguém acrescentar um campo no formulário sem abrir o arquivo de regras, é ali que aparece — e não meses depois, num rollback silencioso em produção.

— referente a tests/regras/clients.test.ts, `describe('clients — criação válida')`

---

## src/lib/cliente.ts

`LIMITES_CLIENTE` existe para que o `maxLength` do formulário e o limite da regra saiam do
mesmo lugar. Estourar um limite offline não dá erro na hora: a escrita entra no cache, a
tela diz que salvou, e a rejeição chega dias depois com rollback silencioso. Barrar na
digitação é a única defesa útil, e ela só funciona enquanto os dois números forem o mesmo
número — se `firestore.rules` mudar um limite, este arquivo muda junto.

`parseNumeroCadastro` recusa em vez de truncar. `parseInt('12abc')` devolve `12`, e um
cliente cadastrado com o número errado é irreversível: `numero` é imutável e `delete` é
proibido, então o conserto é arquivar e recadastrar.

> **AVISO**
> `validarCliente` **não** trata CPF com dígito verificador errado como erro — é aviso, por
> decisão do dono. Bloquear não produz um CPF correto: produz um CPF **vazio**, porque o
> dono apaga o campo para conseguir salvar, e os dígitos que estavam no papel se perdem.
> Como `cpf` é mutável (não está em `imutaveisPreservados()`), errado-e-presente é sempre
> mais recuperável que ausente.

O guarda de `nomeBusca` vazio parece paranoia e não é: `normalizar()` aplica NFD e remove a
faixa de diacríticos, então um nome feito só de marcas de combinação vira string vazia, e a
regra exige `nomeBusca.size() > 0`. Sem o guarda, a rejeição acontece no servidor, offline,
dias depois.

`montarCamposCliente` estoura em vez de montar documento com entrada inválida. Não é
caminho de usuário — o formulário valida antes —, então falhar alto é melhor que gravar
torto.

— referente a src/lib/cliente.ts, arquivo inteiro

## src/lib/sync.ts

`confiancaDaLista` é o que separa *"conferi e o número não existe"* de *"ainda não sei
nada"*. A checagem de número repetido vale exatamente o quanto a lista estiver completa, e
o Firestore não tem como dizer se o cache local está completo ou vazio.

> **AVISO**
> O caso perigoso é o aparelho que **nunca sincronizou** esta coleção: celular novo,
> armazenamento limpo, primeiro login. O listener emite um snapshot vindo do cache, com zero
> clientes, e toda checagem de duplicata passa no vácuo. O número repetido desce depois, e
> aí já existem dois clientes ativos com o mesmo número — irreversível, porque `numero` é
> imutável e `delete` é proibido.
>
> `fromCache: true` sozinho **não** serve de alarme: offline é o caso comum deste produto e
> o aviso viraria ruído permanente, ignorado no dia em que importasse. O que distingue os
> dois é a memória de já ter sincronizado alguma vez neste aparelho, que o provider grava em
> `localStorage` na primeira vez que recebe um snapshot confirmado pelo servidor — mesmo
> padrão que o `AuthProvider` já usa para o `businessId`.

Por isso a confiança tem três estados e não dois: `desconhecida` bloqueia o salvamento,
`parcial` deixa salvar com aviso, `confiavel` não diz nada. Bloquear em `parcial` impediria
cadastrar offline num aparelho novo, que é pior do que o risco que evita.

— referente a src/lib/sync.ts, arquivo inteiro

## src/lib/data.ts

> **AVISO**
> `dataLocalISO` usa `getFullYear`/`getMonth`/`getDate` e **nunca `toISOString()`**. Em
> UTC-3, às 21h de uma terça o `toISOString()` já devolve a quarta-feira — o cadastro feito
> à noite na casa do cliente ficaria com a data do dia seguinte, que é exatamente o desvio
> que o campo `cadastradoEm` existe para corrigir.
>
> O teste que prova isso só falha em fuso negativo. Por isso o `vitest.config.ts` fixa
> `TZ: 'America/Sao_Paulo'`: o runner do CI roda em UTC e o teste passaria por acidente.

— referente a src/lib/data.ts e vitest.config.ts

## src/lib/cpf.ts

`situacaoCpf` separa `incompleto` de `invalido` porque menos de 11 dígitos é digitação em
andamento, não erro: avisar enquanto a pessoa digita treina todo mundo a ignorar o aviso.

A sequência de dígitos repetidos (`11111111111`) **passa na conta do dígito verificador** e
precisa de teste próprio. É a única família de CPF inválido que o algoritmo aceita.

— referente a src/lib/cpf.ts

## src/lib/dispositivo.ts

`atualizadoPor` é diagnóstico de dispositivo, nunca autorização — ver a armadilha do
`atualizadoPor` mais abaixo. Oito caracteres hexadecimais cabem folgado no limite de 64 da
regra.

O `localStorage` pode estourar (aba anônima, armazenamento bloqueado), então há fallback em
memória: o id deixa de sobreviver ao recarregamento, mas o cadastro não para. Perder a
continuidade do diagnóstico é aceitável; travar o cadastro do dono, não.

— referente a src/lib/dispositivo.ts

## scripts/firebase-com-jdk.mjs

Os scripts `test:rules` e `emu` não chamam o `firebase` direto: passam por este wrapper, que
põe o `bin` do `JAVA_HOME` na frente do `PATH` antes de invocar o `firebase-tools`.

> **AVISO**
> O emulador do Firestore roda em Java e o `firebase-tools` 15 recusa qualquer versão
> anterior à 21. **O `firebase-tools` resolve `java` pelo `PATH`, não pelo `JAVA_HOME`** —
> então ter o `JAVA_HOME` apontando para um JDK 21 não basta, e foi exatamente isso que
> aconteceu em 21/09/2026: um instalador automático pôs um Java 8 da Oracle em
> `C:\Program Files (x86)\Common Files\Oracle\Java\java8path`, à frente do JDK 21 no PATH da
> máquina. `JAVA_HOME` continuava correto; `npm run test:rules` morria mesmo assim, com uma
> mensagem que não sugere a causa. Consertar o PATH da máquina exige privilégio de
> administrador e vale só para aquela máquina; o wrapper vale para todas, inclusive o runner
> do CI.

Quando nem o `JAVA_HOME` nem o `PATH` oferecem um JDK 21+, o wrapper falha com as duas
versões impressas em vez de deixar o `firebase-tools` falhar sozinho — a mensagem original
não diz qual `java` ele encontrou nem de onde.

— referente a scripts/firebase-com-jdk.mjs, arquivo inteiro

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

**Dono decidido em 01/09/2026, confirmado pelo dono do negócio em 03/09/2026:** o caminho
de escrita do app. O cliente cadastrado fica com **o mesmo número que já tem no papel**, e
quem digita é o dono — **o app nunca aloca número**, nem para cliente que nunca esteve na
lista (ele continua a sequência de cabeça). Por isso `max(numero) + 1`, contador
transacionado e reserva de bloco estão todos descartados, e não existe "maior número do
caderno" que o app precise conhecer.

Sendo assim, o formulário de cadastro consulta os clientes que o listener já mantém em
cache e **recusa um número que já exista**, com mensagem explícita. É verificação local,
não garantia distribuída; mas com um usuário num dispositivo é o que dá para ter, e num
cadastro manual de centenas de registros o erro de digitação é o caso comum, não a borda.
Como nada mais guarda esse invariante, a checagem é **implementação obrigatória da etapa
3**, não melhoria.

> ⚠️ **A checagem tem que ignorar `arquivado: true`.** Corrigir número digitado errado é
> arquivar e recadastrar (ver o comentário do `allow delete: if false`). Se o registro
> arquivado continuar ocupando o número, um erro de digitação **queima aquele número para
> sempre** — e o cliente real que o tem nunca mais consegue ser cadastrado.

## 2. `nomeBusca` ser de fato `normalizar(nome)` — 🟡 dono frágil

A regra verifica que `nomeBusca` existe, é string e tem tamanho plausível. Ela **não tem
como** verificar que é a normalização de `nome`: a linguagem das regras não faz
decomposição NFD nem remoção de diacríticos. `lower()` existe; tirar acento, não.

Dono: o caminho de escrita da aplicação, que deve derivar `nomeBusca` de `nome` num
lugar só. **Todo caminho de escrita alternativo quebra isso em silêncio** — edição pelo
console do Firebase, correção manual, qualquer ferramenta administrativa futura. O sintoma não é erro: é o cliente
sumir da busca.

## 3. `criadoEm` significa "quando sincronizou", não "quando cadastrei" — 🟢 resolvida em 03/09/2026

A regra exige `dados().criadoEm == request.time`, e `request.time` é o relógio do
**servidor** no instante em que a escrita é processada. Isso é deliberado: impede um
aparelho com relógio errado — ou mexido de propósito — de antedatar um registro.

O preço aparece na fila offline. O carimbo nasce quando a fila sobe, não quando foi
enfileirada:

> O dono cadastra a Dona Maria numa **terça**, na casa dela, sem sinal. O celular só volta
> a ter internet no **sábado**. `criadoEm` fica sábado. Não há aviso, e a diferença não é
> recuperável depois.

Como o cadastro das ~700 linhas do caderno vai acontecer durante visitas, possivelmente
sem sinal, esse desvio não é borda: é o caso comum. Consequência: **`criadoEm` não
responde "quantos clientes entraram em setembro"**. Se essa pergunta importar, precisa de
um campo separado escrito pelo dispositivo — e aí volta o problema do relógio, porque
regra nenhuma consegue validá-lo (mesma natureza da armadilha #4).

~~Nada a fazer hoje. Fica registrado para ser decidido de olhos abertos na etapa 3, e não
descoberto meses depois num relatório.~~

**Decidido na etapa 3, em 03/09/2026: existe o campo separado.** `cadastradoEm` é uma
string `'YYYY-MM-DD'` escrita pelo relógio do aparelho, **obrigatória** e imutável — ver a
seção `firestore.rules` no topo deste arquivo para o porquê da obrigatoriedade e da forma.

`criadoEm` **continua sendo a data da sincronização** e não muda de significado. Os dois
campos convivem e respondem perguntas diferentes: `cadastradoEm` responde "em que dia eu
estava na casa do cliente", `criadoEm` responde "quando isso chegou ao servidor". Quem
quiser contar quantos clientes entraram em setembro usa `cadastradoEm`.

O problema do relógio, levantado acima, não foi resolvido e **não tem como ser**: regra
nenhuma valida o relógio de quem escreve (mesma natureza da armadilha #4). O que se ganhou
é que o dado agora é *autodeclarado e plausível* em vez de *sistematicamente errado*. O
regex barra lixo grosseiro; um aparelho com a data trocada continua podendo mentir, e isso
é aceito conscientemente — o campo é para relatório do dono, nunca para autorização.

## 4. `atualizadoPor` ser mesmo o dispositivo que escreveu — 🟢 aceito

É uma string autodeclarada. Regra nenhuma verifica a origem dela.

Isso é aceitável **porque o campo é diagnóstico, não autorização**: ele existe para
tornar diagnosticável a perda de campo sob last-write-wins. **Nunca usar `atualizadoPor`
numa condição de regra** — seria autorização baseada em algo que o próprio cliente
escreve.

## 5. Coerência entre documentos — 🔴 vai doer nas etapas 4 e 5

Regras avaliam **cada escrita isoladamente**, inclusive dentro de um `writeBatch`. Não
existe "valide o lote inteiro". Portanto nada disto é exprimível:

- a soma das parcelas ser igual ao valor da venda;
- o número de parcelas gravadas bater com `numeroParcelas`;
- `emAbertoCentavos` do cliente bater com as vendas dele;
- uma parcela pertencer a uma venda que existe.

Dono: a função pura que gera o carnê (`gerarParcelas()`, etapa 5) e os testes dela.
Registrar aqui porque isso significa que **o teste unitário da função é a única barreira**
entre um carnê torto e o Firestore — não há segunda linha de defesa.

## 6. O Admin SDK ignora as regras por completo — 🟢 sem objeto hoje

Registrado como princípio, não como risco corrente. Service account **bypassa as Security
Rules**: nenhuma validação deste arquivo se aplica a ela.

Isto valia para o script de importação em Python, **que deixou de existir em 01/09/2026** —
o dono preferiu não mexer na planilha e cadastrar à mão pelo app. Hoje não há nenhum caminho
de escrita com service account, e por isso `firestore.rules` é a validação única e completa
do projeto.

Volta a valer no instante em que qualquer ferramenta administrativa for escrita. Se isso
acontecer, toda validação que importa passa a precisar existir **duas vezes**.

## 7. Dígito verificador de CPF — 🟢 aceito

Regras não têm laço nem aritmética suficiente para calcular dígito verificador. A regra
limita tamanho de `cpfDigits` e nada mais.

Dono: o formulário. Sem importação, todo CPF entra digitado pelo dono, um a um — o que
faz da validação no formulário a única que existe.

## 8. O que É exprimível e ainda não foi feito

Para não confundir "impossível" com "ainda não":

- **Formato por regex.** `string.matches()` existe. `telefoneDigits` só com dígitos e
  `cpfDigits` com exatamente 11 dígitos são perfeitamente exprimíveis. Ficaram de fora
  de propósito: sem importação, os formatos reais aparecem aos poucos, conforme o dono
  cadastra. Apertar a regra antes de ver dado verdadeiro é recusar dado verdadeiro.
- **Faixa de `numero`.** Hoje só `> 0`. Um teto (`<= 10000`) é trivial e vale a partir do
  momento em que o dono disser até que número a lista dele vai.

## 9. O curinga `{documento=**}` anulava tudo isto

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
