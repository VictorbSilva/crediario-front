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

> **AVISO**
> `pertenceAEmpresa()` confere `'businessId' in request.auth.token` **antes** de ler a
> propriedade. Sem esse passo, um usuário autenticado sem o claim faz a expressão **dar
> erro** em vez de devolver `false` — descoberto em 21/09/2026 no simulador do console, que
> reportou *"Property businessId is undefined on object"*.
>
> O acesso era negado do mesmo jeito, porque erro em regra nega. Mas negar por acidente é
> diferente de negar por decisão, e a fragilidade é concreta: `podeAcessar()` é
> `ehDono() || pertenceAEmpresa(...)`, e o `||` da linguagem de regras faz curto-circuito.
> Hoje o dono passa porque `ehDono()` resolve primeiro e o segundo operando nunca roda.
> **Inverter a ordem dos dois operandos — mudança que parece inofensiva — faria o erro
> disparar antes e trancaria o dono para fora dos próprios dados.**
>
> O teste `o dono lê sem ter claim nenhum` existe para quebrar nessa inversão. Ele descreve
> a situação real: nenhum usuário deste projeto tem claim, porque só o Admin SDK grava claim
> e o projeto não tem Admin SDK.

### Campos de rota no cliente — acrescentados em 13/10/2026

Decisões de 24/09 e 13/10/2026: rota é por dia do mês e mora no próprio cliente, sem
coleção nova. O cliente guarda os dias de visita, a ordem em cada dia e a última marca; a
pendência é derivada, não gravada. Oito campos entram em `camposConhecidos()` e
`tiposValidos()`:

- `diasDeVisita` — lista de inteiros de 1 a 31, sem repetição. Lista vazia vale.
  `hasOnly([1, …, 31])` resolve tipo e faixa de uma vez (`'5'` em string não está na lista), e
  `toSet().size() == size()` recusa o dia repetido.
- `rotaDesde` — data civil.
- `ordemPorDia` — mapa cujas chaves são as strings `'1'` a `'31'` e cujos valores são números.
- `ordemDoDia` — mapa com **exatamente** as chaves `data` (data civil) e `valor` (número).
- `ultimaMarca` (`'visitado'` ou `'ausente'`) e `ultimaMarcaEm` (data civil) — **os dois
  existem juntos ou nenhum**. Removê-los exige apagar os dois no mesmo update.
- `ultimoVisitado` e `visitadoAnterior` — datas civis; `visitadoAnterior` só existe se
  `ultimoVisitado` existir.

As duas listas literais (os 31 inteiros e as 31 strings) estão escritas por extenso.

**Todos são opcionais.** Já existe cliente gravado sem eles, e campo obrigatório depois de
haver dado é porta de mão única (ver `cadastradoEm`, acima): `obrigatoriosPresentes()` vale no
update, e todo cliente antigo ficaria inatualizável. Por isso `clienteValido()` em
`tests/regras/ambiente.ts` continua sem campo de rota.

> **AVISO**
> **A regra valida as chaves de `ordemPorDia`, não os valores.** A linguagem de regras não
> percorre os valores de um mapa, então não há como exigir que cada um seja número. Um
> `ordemPorDia['5'] = 'abc'` passa pela regra. **O dono dos valores é o código do app** —
> quem mexer na gravação de `ordemPorDia` não pode contar com a regra para pegar o erro.

**Gravação campo a campo por `FieldPath`.** O app grava `ordemPorDia` com
`new FieldPath('ordemPorDia', '5')`, mexendo em um dia só. A regra não enxerga o update
parcial: `request.resource.data` é o documento inteiro como ficaria depois da escrita, então a
checagem das chaves vale igual — `FieldPath('ordemPorDia', '40')` é negado. Os testes
`aceita gravar um dia de ordemPorDia por FieldPath em cliente sem rota` e `recusa gravar por
FieldPath um dia de ordemPorDia que não existe` cobrem os dois lados.

**`rotaId` continua aceito só por compatibilidade.** O modelo antigo, `routes/{diaDoMes}` com
um `rotaId` único por cliente, caiu com essas decisões, e nenhum código deve gravar o campo.
Ele fica na lista fechada porque tirá-lo seria a mesma porta de mão única ao contrário:
`camposConhecidos()` também vale no update, e cliente que tivesse o campo ficaria
inatualizável.

> **AVISO**
> A regra é publicada à mão, e **antes** de qualquer código gravar esses campos: a regra antiga
> recusa todos eles pela lista fechada, e offline essa recusa chega horas depois, longe de quem
> tocou no botão.

— referente a firestore.rules, `match /clients/{clientId}`, e tests/regras/clients.test.ts,
`describe('clients — rota')`

## firestore.rules — sales, installments e payments

Nascidas em 21/09/2026, com regra e teste no mesmo commit. Os helpers `dados()`,
`anterior()`, `ehDataCivil()`, `carimboDeCriacao()` e `autoriaValida()` subiram para o nível
de `businesses`, onde as quatro coleções os herdam — regra do Firestore é herdada por match
aninhado, e duplicar isso quatro vezes era o caminho para as cópias divergirem.

> **AVISO**
> `installments` é coleção de **primeiro nível**, com `clientId` e `saleId` como campos —
> **não** é subcoleção de `sales`, apesar do esboço de 08/08/2026 desenhar assim. O esboço é
> anterior ao checkpoint da página do cliente (26/08), que mudou a necessidade: a página
> mostra todas as vendas de um cliente e precisa das parcelas de todas elas. Aninhada, isso
> seria um listener por venda ou uma consulta de grupo de coleção. De primeiro nível, é **um
> listener por cliente aberto**, filtrando por `clientId`.
>
> O teste `recusa parcela aninhada dentro da venda` existe para travar essa decisão: o
> caminho antigo continua negado, então ninguém volta atrás sem perceber.

**O pagamento é append-only de verdade, e a regra é quem garante.** `soCancelaNuncaReescreve`
exige que `clientId`, `saleId`, `data`, `valorCentavos`, `forma`, `encargoCentavos` e
`criadoEm` sejam idênticos ao que já estava, e que a transição de `cancelado` seja
exatamente `false → true`. Ou seja:

- nasce com `cancelado: false` — criar já cancelado é negado;
- cancelar exige `canceladoEm`, e `canceladoEm` sem cancelamento é negado;
- **descancelar é negado**, porque o estorno também é fato;
- `delete` é negado, como em toda coleção deste projeto.

Isso é a resposta C3 do dono virando regra: *"registra o cancelamento, com data, nada é
apagado"*.

**`encargoCentavos` é opcional e existe por causa da aritmética do saldo.** O dono disse que
não cobra juros — a simulação é pressão de cobrança, não cobrança. Mas ele disse *"geralmente
não cobro"*, e no dia em que cobrar, o dinheiro que entra é maior que a parcela. Sem separar
quanto daquilo foi encargo, `saldo = total − Σ pagamentos` abateria principal que não foi
pago. A regra exige `encargoCentavos <= valorCentavos`.

**O estado da parcela não é gravado em lugar nenhum.** Ele se deriva de vencimento mais
pagamentos, alocados do mais antigo para o mais novo. A exceção que existia até 07/08 —
`renegociada` como fato gravado — **deixou de existir em 21/09**, quando o dono respondeu que
renegociação não é funcionalidade. Não há mais nenhum estado de parcela que precise ser
persistido.

`versaoCalculo` é obrigatório na venda e imutável. É a regra de reversibilidade do
`CLAUDE.md` virando campo: mudar a fórmula de geração de parcelas no futuro passa a ser um
ramo na leitura, não uma migração de dado vivo.

**A venda pode ser cancelada, nunca excluída** (decisão do Victor em 24/09/2026, regra de
13/10/2026). Dois campos novos em `sales`, `cancelada` (bool) e `canceladaEm` (data civil). O
feminino é de propósito, porque é a venda; o pagamento usa `cancelado`/`canceladoEm`, e os
nomes não se unificam. O cancelamento só grava o fato na venda — não toca `installments` nem
`payments`.

- **Os dois são opcionais.** Já existe venda gravada sem eles, e campo obrigatório depois de
  haver dado é porta de mão única (ver `cadastradoEm`, acima). Ausente vale `false`.
- nasce não cancelada (`nasceNaoCancelada`); `cancelada: true` exige `canceladaEm`, e
  `canceladaEm` sem `cancelada: true` é negado;
- **o update é uma disjunção** (`cancelamentoValido`): ou a venda ainda não estava cancelada,
  ou continua cancelada com o mesmo `canceladaEm`. Descancelar, apagar os dois campos com
  `deleteField()` e trocar a data de um cancelamento já gravado caem fora dos dois ramos.

**Por que não é `soCancelaNuncaReescreve`.** No pagamento, a única edição legítima é cancelar,
então aquela função exige a transição `false → true` em todo update. Na venda existe outra
edição legítima — as taxas de simulação —, e copiar a função negaria tudo que não fosse o
próprio cancelamento, quebrando `aceita mudar só as taxas de simulação`. Quem trava os valores
combinados continua sendo `imutaveisPreservados()`, que também vale no update que cancela.

> **AVISO**
> Toda leitura dos campos novos passa por `.get(campo, padrão)` — `dados().get('cancelada',
> false)`, `anterior().get('cancelada', false)`. A venda gravada antes de 13/10/2026 não tem o
> campo, e `anterior().cancelada` lido direto faz a expressão **dar erro** em vez de devolver
> `false`. Erro em regra nega, então toda venda antiga ficaria inatualizável — nem cancelar,
> nem mudar taxa. Mesma família do AVISO sobre `pertenceAEmpresa()`, acima. O teste `cancela
> venda gravada antes do campo existir` semeia a venda sem o campo para pegar essa regressão.
>
> A regra é publicada à mão, e **antes** de qualquer código gravar o campo: a regra antiga
> recusa `cancelada` pela lista fechada, e offline essa recusa chega horas depois, longe de
> quem tocou no botão.

— referente a firestore.rules e tests/regras/vendas.test.ts

## tests/regras/ambiente.ts — `veredito`

Os testes de regra não usam `assertFails`/`assertSucceeds` do
`@firebase/rules-unit-testing`. Usam `veredito(operacao)`, que devolve `'permitido'` ou
`'negado'`, e o teste compara com `expect`.

Duas razões, e a segunda é a que importa mais:

1. **O SonarQube marcava todo teste de regra como "teste sem asserção"** (regra S2699). Ele
   só reconhece uma lista fixa de bibliotecas, e `assertFails` não está nela. Eram dezenas de
   alertas permanentes — e alerta que sempre aparece é alerta que ninguém lê, que é
   exatamente o problema que este projeto passa o tempo tentando evitar na interface.
2. **`veredito` é mais estrito que `assertFails`.** Ele só devolve `'negado'` quando o erro é
   de fato `permission-denied`; qualquer outra falha — caminho errado, campo com nome trocado,
   emulador fora do ar — é **relançada** em vez de contada como negação. O `assertFails`
   aceitava a falha sem perguntar o motivo, o que deixava passar teste que "passava" porque o
   código de teste estava quebrado.

> A migração dos 95 pontos de chamada em 21/09/2026 serviu de prova: se algum dos 99 testes
> estivesse passando por motivo errado, o `veredito` teria estourado. Nenhum estourou.

— referente a tests/regras/ambiente.ts

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

## src/components/clientes/ListaDeClientes.tsx e PainelDoCliente.tsx

Extraídos da `ClientesPage` em 21/09/2026, depois de o SonarQube apontar complexidade
cognitiva alta e ternários aninhados no mesmo container JSX.

O ternário aninhado era a escolha entre quatro estados da lista — carregando, nenhum
cadastrado, nada encontrado na busca, e a lista de fato. Em componente próprio isso vira
quatro `return` com saída antecipada, que se lê de cima para baixo. A exceção da regra do
Sonar para JSX não valia aqui: ela cobre ternários em containers **separados**, e esses
estavam todos no mesmo.

> Distinguir "nenhum cliente cadastrado" de "nada encontrado para esta busca" exige os dois
> números. Por isso `ListaDeClientes` recebe `encontrados` **e** `cadastrados`: sem o
> segundo, um filtro que não casa nada diria ao dono que ele não tem clientes.

## src/pages/ClientesPage.tsx

Primeira tela do projeto lendo dado real. `DemoBanner` e `clientesDemo` saíram daqui, mas o
`src/demo/` **continua existindo** para Rotas e Financeiro: a invariante é por tela — nenhuma
tela mostra dado falso sem o banner, nem dado real com ele —, então apagar o módulo inteiro
quebraria duas telas fora do escopo desta etapa.

Os KPIs **"Com atraso" e "Sem rota" sumiram**, e não é esquecimento. `situacao` e
`emAbertoCentavos` não existem no modelo: nascem nas etapas 4 e 5, com as regras financeiras.
Mostrar "Em dia" ou "R$ 0,00" para todo mundo seria inventar número, que é o que o
`CLAUDE.md` proíbe. "Sem rota" daria 100% enquanto não houver rotas, o que não informa nada.
O KPI de arquivados só aparece quando há algum, para não ensinar um zero permanente.

A busca é em memória, sobre o que o listener já trouxe. Termo com dígitos casa `numero` por
**prefixo** e `telefoneDigits`/`cpfDigits` por trecho — buscar "137" tem que achar o cliente
137 antes de achar quem tem 137 no meio do telefone.

O botão de arquivar **não tem diálogo de confirmação**, de propósito: é alternância, desfaz
num clique, e confirmação para ação reversível é ruído. O contrário — botão só de ida —
esconderia o cliente sem caminho de volta.

> **AVISO**
> O painel de detalhe **não avisa sobre CPF com dígito inconsistente.** Desde 21/09 o
> formulário bloqueia, e a coleção nasceu vazia, então não existe caminho no app que grave um
> CPF inválido. Se um aparecer — edição pelo console, ou uma futura tela de edição que
> esqueça de validar —, ele fica invisível aqui. É dívida consciente: a rede de segunda
> instância custaria cinco linhas e hoje não teria o que pegar.

— referente a src/pages/ClientesPage.tsx, arquivo inteiro

## src/components/clientes/FormularioCliente.tsx

Usa `<dialog>` com `showModal()`, que entrega de graça o que daria um bom punhado de
código: armadilha de foco, `Esc` para fechar, fundo inerte e `::backdrop`. Não entra
biblioteca de modal no projeto por causa disto.

O componente **não tem prop `aberto`**: quem chama monta e desmonta. O estado do formulário
zera porque o componente morre, não por um efeito de reset — e efeito de reset seria
`setState` síncrono dentro de `useEffect`, que o `react-hooks/set-state-in-effect` recusa e
que custa um render a mais por abertura.

> **AVISO**
> O campo de número usa `inputMode="numeric"`, **nunca `type="number"`**. O `type="number"`
> aceita `e`, `+` e `-` como conteúdo válido, muda de valor com a roda do mouse por cima do
> campo, e ainda assim entrega uma string no `value`. Nada disso é o que se quer de um campo
> que é a identidade do cliente e é imutável depois de gravado.

Quando cada erro aparece não é detalhe de gosto:

- **Número** mostra erro assim que o campo tem conteúdo. É a única checagem cujo valor está
  em falhar cedo — descobrir a duplicata no primeiro campo poupa preencher o resto para
  levar o bloqueio no fim.
- **Os outros campos** só mostram erro depois do `blur` ou de uma tentativa de salvar.
- **O CPF depende disso.** `situacaoCpf` devolve `incompleto` com menos de 11 dígitos, então
  erro ao vivo gritaria "CPF incompleto" desde o primeiro número digitado — que é o
  comportamento que ensina qualquer usuário a ignorar aviso.

O `maxLength` de cada campo sai de `LIMITES_CLIENTE`, a mesma constante que a validação usa,
que por sua vez espelha `firestore.rules`. Estourar limite offline não dá erro na hora, dá
rollback silencioso dias depois.

Sem a prop `cliente`, o formulário continua no modo de cadastro. Com ela, nasce preenchido
por `entradaDoCliente` e usa `validarEdicaoCliente`: as mesmas validações dos dados do
cadastro, sem conferir número ou mostrar `avisoDeConferencia`. O número é fixo por decisão
do dono, então aparece só no subtítulo, nunca como campo de edição; o foco inicial vai para
Nome. Dias de visita pertencem a Rotas e não entram neste formulário.

Salvar chama `criarCliente` ou `editarCliente` sem `await` — ver o AVISO do
`ClientesProvider` sobre Promise que não resolve offline. O formulário guarda o cliente da
abertura para comparar os dados: mudanças posteriores do listener não substituem essa
base. Salvar sem alteração fecha sem escrita e preserva carimbo e autoria. Com alteração,
o update leva só os campos modificados e seus derivados, preservando mudanças de outro
aparelho em campos que o dono não editou. Mudanças simultâneas no mesmo campo continuam
sujeitas a last-write-wins. A edição recompõe `nomeBusca` de `nome` e preserva `numero`,
`cadastradoEm`, `criadoEm` e `arquivado`.

A página monta o formulário com `key={cliente.id}`: trocar a rota com ele aberto remonta
o estado para o cliente novo. `editarCliente` devolve `false` se faltar `businessId`; nesse
caso o formulário fica aberto e mostra o motivo. `true` indica que pode fechar, por não
haver mudanças ou porque a escrita entrou na fila, nunca confirmação do servidor.

Apagar um opcional **remove o campo do documento**, nunca grava string vazia. Telefone e
CPF removem também seus pares de dígitos; texto sem dígitos preserva o texto e remove o
derivado antigo. `montarEdicaoCliente` devolve `definir` e a lista `remover` sem importar o
SDK: o provider converte a lista em `deleteField()`, acrescenta `serverTimestamp()` em
`atualizadoEm` e empilha a rejeição em `falhas` pelo `.catch()`.

— referente a src/components/clientes/FormularioCliente.tsx, arquivo inteiro

## src/data/useCarne.ts

Três listeners por cliente aberto — `sales`, `installments` e `payments` —, cada um filtrado
por `clientId`. É hook e não contexto: o único consumidor é a página do cliente e sua árvore,
diferente do `ClientesProvider`, que existe como contexto porque o selo de sincronização o
consome do outro lado do app.

**A consulta filtra por `clientId` e nada mais; a ordenação é em memória.** Somar um
`orderBy` a um `where` exigiria índice composto declarado e publicado, e o
`firestore.indexes.json` está vazio de propósito. Com poucas vendas por cliente, ordenar em
memória custa nada e economiza um artefato de infraestrutura para manter.

> **AVISO**
> Carregamento **não** é contador regressivo. A primeira versão usava `faltam = 3` e
> decrementava a cada snapshot, o que quebra com `includeMetadataChanges: true`: os três
> listeners são independentes, e `sales` pode disparar três vezes antes de `payments` disparar
> uma. O contador chegaria a zero com uma coleção ainda vazia, e a tela diria "sem parcelas"
> para um carnê que existe. Agora marca **qual** coleção chegou, por cliente.

> **AVISO**
> Ao trocar de cliente, o estado anterior continua em memória até os novos snapshots
> chegarem — e mostrar o carnê do cliente errado é pior do que mostrar carnê nenhum. Por isso
> o memo **filtra tudo por `clientId`** antes de montar: dado do cliente anterior simplesmente
> não passa. A mesma chave por cliente vale para o carregamento, então trocar de cliente volta
> a "carregando" em vez de exibir o carnê de outra pessoa.

O `useMemo` recalcula `dataLocalISO(new Date())` a cada mudança das listas. A consequência é
que o atraso só é reavaliado quando algum dado muda — se o app ficar aberto atravessando a
meia-noite, os dias de atraso continuam os de ontem até a próxima escrita ou sincronização.
Aceitável hoje; quando incomodar, o conserto é um estado com o dia civil corrente.

`cancelarVenda` segue o molde de `cancelarPagamento`: `updateDoc` sem `await`, com `.catch`
empilhando em `falhas`. Os campos vêm de `montarCancelamentoVenda`, que já entrega
`atualizadoPor`; `atualizadoEm` vai como `serverTimestamp()` porque a regra exige
`atualizadoEm == request.time` em todo update. Só o documento da venda muda — parcelas e
pagamentos ficam como estão. A venda sai do saldo e das vencidas porque `montarCarne` zera o
resumo dela e `saldoDoCliente` a ignora, e **cancelar a venda não estorna pagamento**
(decisão de 24/09/2026): estornar continua sendo `cancelarPagamento`, lançamento por
lançamento. A regra só aceita `cancelada` indo de `false` para `true`, com `canceladaEm`
congelado depois disso; a tela esconde o botão numa venda já cancelada
(`podeCancelarVenda`) para não oferecer uma segunda escrita que seria recusada.

> **AVISO**
> `paraVenda` copia campo por campo, não espalha `dados`. Campo novo em `sales` que não
> entrar ali existe no cache e no servidor, mas a tela nunca o vê — foi o caso de `cancelada`
> e `canceladaEm`, que a regra já aceitava antes de `paraVenda` mapeá-los: uma venda
> cancelada continuaria cobrando.

### Carnê não baixado e carnê incompleto neste aparelho (T7)

Com dois aparelhos (notebook e iPhone, 24/09/2026), o cache de um não sabe o que o outro
lançou. Os três listeners só baixam o carnê de um cliente quando ele é aberto online, então
abrir offline um cliente nunca aberto antes devolve três listas vazias vindas do cache.

> **AVISO**
> Lista vazia do cache **não** é "nenhuma venda". A tela dizia "Nenhuma venda registrada"
> e oferecia "Nova venda" para um cliente que tinha carnê no outro aparelho — e o dono
> lançaria a mesma venda de novo. Agora `confianca` vem de `confiancaDaLista` (o mesmo de
> `src/lib/sync.ts`, sem mudança) e, com lista vazia e confiança `parcial`, a tela troca o
> vazio por um aviso. "Nova venda" continua disponível e o formulário repete o aviso:
> **avisa, não bloqueia**, porque bloquear impediria vender offline num aparelho que nunca
> sincronizou, que é justamente o caso de uso.

A memória de "já li este carnê do servidor neste aparelho" é **por cliente**, não por
coleção inteira como a do `ClientesProvider`: os listeners são por `clientId`, e ter baixado
o carnê da Maria não diz nada sobre o do João. Fica em
`localStorage['crediario:carnes-sincronizados:<businessId>']`, um JSON com a lista de
`clientId`. Um cliente entra na lista quando as **três** coleções dele estão ao mesmo tempo
com `fromCache: false` — `sales` do servidor com `installments` ainda do cache não é carnê
baixado. Grava uma vez por cliente e por assinatura, em `try/catch`; a cópia em estado
existe para o `useMemo` reagir, e a leitura inicial é no inicializador do `useState`, pelo
mesmo motivo do `ClientesProvider`. `fromCache` sozinho não serve de alarme pela mesma razão
de `src/lib/sync.ts`: offline é o caso comum, e um carnê já baixado não pode virar aviso.

> **AVISO**
> `doCache` é **por coleção**, na mesma chave por cliente do `prontos`. A versão anterior
> guardava um `doCache` só, sobrescrito pelo último listener que disparasse: `payments` do
> servidor apagava o `fromCache: true` de `installments`. Enquanto só o `estadoSync` do
> carnê o lia (nenhum selo consome esse), a mentira não aparecia; agora `confianca` depende
> dele, e um `doCache` falso daria `confiavel` e esconderia o aviso com parcelas ainda vindas
> do cache. O `doCache` do carnê é verdadeiro se qualquer uma das três coleções do cliente
> aberto estiver no cache ou ainda sem snapshot.

O outro lado é o cache **parcial**: a venda chegou, parte das parcelas não. `montarCarne`
somava só o que chegou e podia chamar de **quitada** uma venda com parcelas em aberto no
servidor. Por isso a contagem vem de `venda.numeroParcelas`, nunca de `parcelas.length`:
`completa` é `parcelas presentes >= numeroParcelas`, e venda não cancelada e incompleta
nunca é quitada — a situação vira "Incompleta neste aparelho" e a tela avisa, acima dos
indicadores, que o saldo pode estar menor do que o real. Venda cancelada fica fora desse
aviso: já não entra no saldo.

— referente a src/data/useCarne.ts

## src/data/ClientesProvider.tsx

O único `onSnapshot` do app. Montado no `AppShell`, para que a lista, o formulário e o selo
de sincronização compartilhem a mesma assinatura — é o que mantém o projeto dentro do plano
Spark. `orderBy('numero')` usa o índice automático de campo único; `firestore.indexes.json`
continua vazio de propósito.

> **AVISO**
> `{ includeMetadataChanges: true }` **não é opcional**. Sem ele o snapshot não dispara
> quando a única mudança é `hasPendingWrites` virando `false`, e o selo fica preso em
> "Alterações pendentes" para sempre depois de sincronizar. O bug não aparece online e
> rápido: aparece depois de uma escrita offline que sincroniza mais tarde.

> **AVISO**
> **Nunca `await` num `setDoc`/`updateDoc` deste projeto.** Offline a Promise fica pendente
> por tempo indeterminado — ela não rejeita, só não resolve —, e `await` trava o formulário
> sem mensagem nenhuma. O cache local já foi atualizado de forma síncrona antes disso, então
> a tela pode fechar na hora. Chamar sem `await`, com `.catch()`.

> **AVISO**
> A rejeição chega tarde e faz **rollback silencioso**: se o servidor recusar a escrita
> (regra), o SDK desfaz o documento no cache e o cliente some da lista dias depois, sem
> aviso. Por isso o `.catch()` empilha em `falhas`, que a tela renderiza.
>
> **O `falhas` só cobre o caso de app aberto.** Cadastro offline com o app fechado antes da
> sincronização tem a rejeição processada sem ninguém escutando: o documento é revertido e
> nem o `.catch()` roda. Isso fica invisível até a coleção `erros` da etapa 6.

`serverTimestamp()` materializa como `null` no cache local até o servidor confirmar — por
isso `criadoEm` e `atualizadoEm` são `Timestamp | null` no tipo `Cliente`. Tratar como
`Timestamp` puro quebra na primeira escrita offline.

`id` e `pendente` no tipo `Cliente` são derivados do snapshot, não campos do documento:
`pendente` é `metadata.hasPendingWrites`, e é o que a lista usa para marcar o que ainda não
subiu.

A chave `crediario:sincronizou:<businessId>` no `localStorage` é a memória de já ter lido do
servidor neste aparelho, gravada na primeira vez que chega um snapshot com
`fromCache: false`. É o que alimenta `confiancaDaLista` — ver a armadilha do
`src/lib/sync.ts` para por que `fromCache` sozinho não basta.

O efeito não chama `setState` de forma síncrona: `carregando` já nasce `true` e
`jaSincronizou` é lido no inicializador do `useState`. Além de satisfazer o
`react-hooks/set-state-in-effect`, evita um passe de render extra a cada montagem.

— referente a src/data/ClientesProvider.tsx, arquivo inteiro

## src/lib/exportacao.ts

A exportação **não é conveniência: é o único backup que os dados vão ter.** Não há
importação de planilha, não há credencial administrativa, e os ~700 clientes do caderno vão
existir só no Firestore. Tratar este arquivo como acessório é o caminho para descobrir, no
pior dia possível, que não havia backup nenhum.

> **AVISO**
> `situacaoExportacao` **bloqueia** quando a confiança da lista é `desconhecida` e **grita**
> quando é `parcial`. É a mesma `ConfiancaDaLista` do formulário, e aqui ela pesa mais:
> exportar de um aparelho que nunca sincronizou produz um arquivo com 3 dos 700 clientes,
> com cara de backup completo. **Backup silenciosamente incompleto é pior que backup
> nenhum**, porque a pessoa para de procurar.

Dois detalhes do CSV que parecem frescura e não são:

- **BOM UTF-8 (`﻿`) no início.** Sem ele o Excel em pt-BR abre o arquivo em ANSI e
  "João" vira "JoÃ£o" em toda a planilha.
- **Separador `;`, não vírgula.** O Excel configurado em pt-BR usa ponto e vírgula como
  separador de lista; com vírgula ele joga a linha inteira numa coluna só.

`arquivado` sai como `sim`/`não` no CSV porque quem lê é o dono. Isso torna o CSV um
documento de leitura, não fonte de restauração — para restaurar é o JSON, e a tela diz isso.

O JSON monta o objeto **campo a campo em vez de espalhar o cliente**. O tipo `Cliente` carrega
`pendente`, que é estado de tela derivado de `metadata.hasPendingWrites` e não tem o que
fazer dentro de um backup. O `id` entra de propósito: é o identificador do documento, e uma
restauração futura precisa dele. O envelope tem `versao` para que um formato novo seja um
ramo na leitura, não uma adivinhação.

`criadoEm` e `atualizadoEm` viram `null` quando a escrita ainda não subiu — é o mesmo
`serverTimestamp()` que só materializa no servidor. O arquivo registra `null` em vez de
inventar data, e a tela avisa quantos cadastros estão nessa situação.

**Desde a versão 2 do envelope (13/10/2026) o JSON leva o carnê.** O formato passou de
`crediario-clientes` para `crediario-backup`, `quantidade` virou `quantidades`
(`clientes`, `vendas`, `parcelas`, `pagamentos`) e o arquivo passou a se chamar
`crediario-backup-AAAA-MM-DD.json`. Um backup só de clientes devolveria os nomes e perderia
quem deve quanto — justamente o que não existe em lugar nenhum fora do Firestore. O CSV
continua só de clientes: é documento de leitura, não de restauração.

Vendas, parcelas e pagamentos entram **crus**, ao contrário dos clientes: `{ id, ...campos }`
com tudo o que o documento tiver, passado por `serializar`, que só troca o que tem
`toDate()` (Timestamp) por ISO. Campo desconhecido entra sem ninguém mexer aqui — `cancelada`,
dias de visita, o que vier. Montar campo a campo, como nos clientes, faria o backup perder em
silêncio todo campo novo até alguém lembrar deste arquivo.

> **AVISO**
> A confiança do carnê pesa sobre o JSON do mesmo jeito que a dos clientes:
> `situacaoDoBackup` **bloqueia** com `desconhecida` e **grita** com `parcial`. Bloqueia
> também quando a leitura do carnê deu erro — sem isso, um `permission-denied` em `sales`
> produziria um backup de clientes com zero vendas e cara de completo, e o aparelho que já
> sincronizou alguma vez ainda diria `confiavel`. `conferenciaDoCarne` soma o
> `numeroParcelas` das vendas e compara com as parcelas presentes: diferença em qualquer
> direção vira alerta, porque falta parcela (carnê incompleto) ou falta venda (parcela
> órfã). O CSV não depende de nada disso.

— referente a src/lib/exportacao.ts e src/components/clientes/ExportarClientes.tsx

> **AVISO**
> O `URL.revokeObjectURL` do download roda com atraso de propósito. Revogar na mesma volta
> do `click()` cancela o download antes de começar em alguns navegadores — o link fica
> válido por um segundo e só então é liberado.

## src/data/useCarneDaEmpresa.ts

O carnê da **empresa inteira**, para o backup e, depois, para o Financeiro. Um listener por
coleção pedida, sobre a coleção **inteira** de `businesses/{businessId}`: sem `where`, sem
`orderBy`. Coleção sem filtro usa o índice automático, e o `firestore.indexes.json` continua
vazio de propósito.

> **AVISO — custo no plano Spark**
> Cada vez que o hook monta online, ele lê as coleções pedidas **inteiras**. Exemplo: 300
> vendas de 10 parcelas e 1.500 pagamentos são 300 + 3.000 + 1.500 = **4.800 leituras** por
> abertura do diálogo de exportação — perto de 10% da cota diária grátis de 50 mil. Para um
> backup ocasional é aceitável; numa tela quente, aberta dezenas de vezes por dia, não é.
> Por isso: (1) o hook só fica montado enquanto o componente que o usa está montado, e o
> `ExportarClientes` só é montado aberto; (2) o hook recebe **quais** coleções ouvir, e o
> Financeiro vai pedir só `sales` e `payments` — `installments` é de longe a maior das
> três, e o Financeiro não precisa dela.

`colecoes` precisa ser **constante de módulo** (`CARNE_COMPLETO`, ou outra no mesmo
molde). Ela é dependência do efeito: uma lista literal escrita no JSX nasce nova a cada
render, e o efeito derrubaria e refaria os listeners em laço — cada volta, uma leitura nova.

Pelo mesmo motivo do `useCarne` (ver o primeiro AVISO daquela seção), carregamento **não** é
contador regressivo nem estado único: com `includeMetadataChanges: true` os listeners são
independentes, e `sales` pode disparar três vezes antes de `payments` disparar uma. O estado
guarda, **por coleção**, se ela já chegou e o `fromCache` do último snapshot dela.
`carregando` é "alguma ainda não chegou"; `doCache` é "alguma veio do cache".

A memória de já ter lido do servidor fica em
`crediario:carne-sincronizou:<businessId>:<coleções>` no `localStorage`, gravada uma vez,
quando **todas** as coleções pedidas já entregaram um snapshot com `fromCache: false`. A
chave leva a lista de coleções porque provar `sales` e `payments` (Financeiro) não prova
`installments` (backup). O valor inicial é lido no inicializador do `useState`, e todo
acesso ao `localStorage` vai em `try/catch` — aba anônima e armazenamento bloqueado lançam.

Erro de leitura grava a mensagem em `erro` e marca **todas** as coleções pedidas como
chegadas, como o `useCarne` faz: sem isso a tela ficaria em "carregando" para sempre. Quem
consome decide o que fazer com o erro — o backup bloqueia (ver a seção do
`src/lib/exportacao.ts`).

Os documentos saem **crus** (`{ id, dados: d.data() }`), sem os conversores do `useCarne`.
É de propósito: o backup precisa de todo campo que existir, inclusive os que ainda não têm
tipo. `pendente` não entra no documento; `pendentes` é a contagem de
`metadata.hasPendingWrites` somada entre as coleções.

O efeito não chama `setState` de forma síncrona (`react-hooks/set-state-in-effect`): o
estado é marcado com a chave `businessId + coleções`, e o que pertence a outra chave é
ignorado na leitura — trocar de empresa volta a "carregando" em vez de mostrar o carnê
anterior.

— referente a src/data/useCarneDaEmpresa.ts

## src/lib/rotas.ts

Rota é por **dia do mês** e seus fatos pertencem ao cliente: `diasDeVisita`,
`rotaDesde`, `ordemPorDia`, `ordemDoDia` e as marcas de visita. Este módulo usa o tipo
estrutural `ClienteNaRota`, sem Firestore ou tela, e devolve alterações para quem grava.
`montarDiasDeVisita` aceita apenas inteiros de 1 a 31 sem repetição e ordena uma cópia.

**Pendente é derivado, nunca gravado.** `agendaRecente` escolhe a maior data até hoje
entre os dias de visita no mês atual e no anterior. Sem Visitado cobrindo essa agenda,
o cliente segue pendente no dia seguinte, inclusive na virada do mês. Ausente registra
só a tentativa e não encerra a pendência; `ausenteHoje` vale apenas na data da marca.
Visitado hoje continua na lista, na mesma posição. Desfazer volta `ultimoVisitado` para
`visitadoAnterior` (um nível); marcar duas vezes no mesmo dia preserva esse retorno.

**Ausente depois de Visitado no mesmo dia não faz nada (C1).** `marcarAusente` devolve
uma alteração vazia quando `ultimoVisitado === hoje`. Isso impede a combinação
"visitado e ausente hoje" e preserva a visita, que `desmarcar` desfaz em um nível.

**`rotaDesde` corta agendas anteriores a ela.** Colocar um cliente no dia 5 em 10 de
outubro não cria uma pendência de 5 de outubro. A data igual a `rotaDesde` conta.
Datas são strings civis `'YYYY-MM-DD'`, comparadas como strings; não há hora na rota.
`dataDaVisita` recebe mês de 1 a 12 e converte para o mês de 0 a 11 de `diasNoMes`.
Dia 31 em mês curto cai no último dia do mês, como no vencimento. Se 30 e 31 caem
juntos em 30 de novembro, a agenda usa o dia 30. **Quando vários dias caem na mesma
data (C2), ganha o dia da data se estiver configurado; senão, ganha o menor dia
configurado entre os candidatos.** O dia da data é também o menor dos candidatos
quando está configurado, porque os demais foram limitados para baixo. Assim, em
28/02/2027, `[29, 31]` e `[31, 29]` usam 29; `[28, 31]` usa 28. Um dia 31 sozinho
continua usando 31. O desempate nunca inventa um dia fora de `diasDeVisita` e não
depende da ordem dos dias ou dos meses percorridos, preservando a chave de `ordemPorDia`.

**A ordem não é recalculada por endereço ou nome.** No dia agendado, a chave vem de
`ordemPorDia[String(dia)]`; sem ela, vem de `BASE_SEM_ORDEM + numero`, usando o número
fixo da planilha. Atrasados sem ordem temporária entram depois da maior chave calculada,
por data agendada e depois número, separados por `PASSO`. Arrastar um atrasado produz
`ordemDoDia = { data: hoje, valor }`, que só vale naquela data; arrastar alguém do dia
altera a ordem daquele dia do mês.

**O bloco de atrasados soltos é intransponível (B1).** Solto é o atrasado sem
`ordemDoDia` com `data === hoje`; o bloco fica no fim, do mais antigo para o mais novo.
Ao arrastar um cliente do dia ou um atrasado com posição para dentro ou depois desse
bloco, o item é encaixado antes dele: a nova chave fica um `PASSO` depois da última
chave fixa restante, ou é `PASSO` se não houver nenhuma. A chave de um solto também
não serve como vizinho na borda do trecho fixo. Mover um solto dentro do bloco não
grava nada; mover para cima do bloco grava uma posição de hoje entre os vizinhos fixos.
As chaves dos soltos são calculadas de novo em cada montagem: persistir esses números
em `ordemPorDia` levaria uma posição temporária para os meses seguintes.

**Ordem fracionária evita regravar os vizinhos.** Um arraste devolve uma alteração:
a média das chaves dos novos vizinhos, ou um `PASSO` antes/depois na borda. Se a média
não fica estritamente entre os vizinhos, acabou a precisão numérica: só então a lista
é rebalanceada na ordem nova com `PASSO * (i + 1)`. Na rota de hoje, cada item
rebalanceado mantém seu destino: ordem por dia para os do dia, temporária para os
atrasados, incluindo os soltos. Posição sem mudança não produz escrita. As funções
não modificam as listas nem os clientes recebidos.

**O rebalanceamento de hoje leva o dia inteiro (C3).** `arrasteNaRotaDeHoje` recebe
`todos`, além dos itens de hoje. Sem precisão, primeiro rebalanceia a lista de hoje
na ordem já ajustada pelo B1. Para cada `diaAgendado` dos clientes do dia nessa lista,
acrescenta os clientes de `rotaDoDia(todos, dia)` que ficaram fora de hoje, na ordem
atual deles, com `PASSO * (n + j + 1)`: `n` é o tamanho da lista de hoje e `j` recomeça
em zero em cada dia. Isso inclui, por exemplo, clientes com `rotaDesde` futura e evita
deixar parte do dia na escala antiga, embaralhando os meses seguintes. Arraste simples
continua devolvendo uma alteração; `arrasteNaRotaDoDia` mantém seu contrato.

— referente a src/lib/rotas.ts e src/lib/rotas.test.ts

## src/lib/parcelas.ts

Onde a resposta do dono sobre pagamento parcial vira código. Todo o carnê é derivado daqui;
nada de situação de parcela é gravado no Firestore.

A venda cancelada continua listada, mas fica fora do saldo, das parcelas vencidas e da
determinação de "quitado" do cliente: `saldoDoCliente` considera apenas as vendas não
canceladas. O resumo da venda cancelada zera saldo e encargos e não a marca como quitada;
suas parcelas continuam derivadas para exibição, com a cobertura dos pagamentos preservada.
Cancelar a venda não estorna pagamentos: eles continuam no livro de pagamentos.

> **AVISO**
> `alocarPagamentos` **soma os pagamentos num bolo e cobre da parcela mais antiga para a mais
> nova** — não existe "este pagamento é da parcela 4". É a única forma de representar o que o
> dono descreveu: *"pagou 50, vai ficar 250, pagou mais 50, vai ficar 200, e sempre contando o
> atraso"*. Uma parcela coberta pela metade continua **vencida**, contando do vencimento
> original, e é `situacaoDaParcela` que garante isso.
>
> A ordem é por **vencimento**, não pela ordem em que os documentos chegaram do Firestore, e
> há teste com a lista embaralhada para travar isso.

`alocarPagamentos` abate **só o principal**: `valorCentavos - encargoCentavos`. Sem isso, um
pagamento que inclui juros abateria dívida que não foi paga, e o saldo desceria mais rápido
que a realidade.

**Duas suposições que o dono ainda não confirmou.** As duas estão registradas em
`versaoCalculo: 1`, gravado e imutável na venda — é o que permite mudar a fórmula depois sem
migrar carnê nenhum, porque a versão diz qual regra gerou cada venda.

1. **A primeira parcela cai no mês seguinte ao da venda**, no dia combinado. Venda em 19/04
   com vencimento dia 19 gera a primeira em 19/05.
2. **A sobra da divisão vai para a última parcela.** R$ 100,00 em 3 vira 33,33 / 33,33 /
   33,34, e a soma bate exatamente com o total — há teste para isso.

Dia 31 encolhe para o último dia do mês curto (`vencimentoDaParcela` em `src/lib/data.ts`).
Sem isso, `new Date(2026, 1, 31)` viraria 3 de março em silêncio, e o carnê nasceria com
vencimento fora do mês.

> ⚠️ **Terceira suposição, e é a mais discutível:** multa e juros incidem sobre o que **falta**
> da parcela, não sobre o valor cheio. Quem pagou metade de uma parcela vencida simula
> encargo sobre a metade. É a leitura mais defensável — *"você ainda me deve 50, e é sobre
> isso que corre"* —, mas o dono não foi perguntado. Trocar para o valor cheio é uma linha.

Encargo é **simulação, nunca cobrança**: sem taxa configurada, `simularEncargos` devolve
zero, e `resumoDaVenda` separa `abertoCentavos` de `encargosCentavos` para a tela poder
mostrar só o principal por padrão. Ver as regras financeiras no `CLAUDE.md`.

— referente a src/lib/parcelas.ts

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
> `validarCliente` **bloqueia** CPF com dígito verificador errado, com a mensagem *"Digite
> um CPF válido."* — decidido pelo Victor em 21/09/2026, revertendo a postura de 03/09 que
> só avisava.
>
> O caso que manda é o CPF digitado errado **sem ninguém perceber**: meses depois o dono
> precisa do CPF na hora e descobre que o que está gravado não serve, e aí tem que procurar
> o cliente de novo para pedir a mesma informação. Erro visível no instante da digitação,
> com o cliente ainda na frente dele, custa um segundo; erro silencioso custa uma visita.
>
> **Campo vazio continua aceito** — `cpf` é opcional. Essa é a saída para o caso em que o
> papel traz um CPF que de fato não fecha: deixar em branco de propósito é diferente de
> gravar errado sem saber. CPF incompleto tem mensagem própria, para não mandar o dono
> procurar um dígito trocado quando o que falta é dígito.

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

O id vem de `crypto.getRandomValues`, sem alternativa. Existia um caminho com
`Math.random()` para o caso de a API faltar; ele saiu em 21/09/2026, depois de o SonarQube
marcá-lo como ponto a revisar (S2245). Não era risco — o id nunca autoriza nada —, mas era
**código morto**: `getRandomValues` está em todo navegador desde 2011 e, ao contrário de
`crypto.subtle`, não exige contexto seguro. Alternativa para um caso impossível é alternativa
que nunca foi testada.

O `localStorage` pode estourar (aba anônima, armazenamento bloqueado), então há fallback em
memória: o id deixa de sobreviver ao recarregamento, mas o cadastro não para. Perder a
continuidade do diagnóstico é aceitável; travar o cadastro do dono, não.

— referente a src/lib/dispositivo.ts

## src/lib/dispositivo.ts — nota antiga

`atualizadoPor` é diagnóstico de dispositivo, nunca autorização — ver a armadilha do
`atualizadoPor` mais abaixo. Oito caracteres hexadecimais cabem folgado no limite de 64 da
regra.

O `localStorage` pode estourar (aba anônima, armazenamento bloqueado), então há fallback em
memória: o id deixa de sobreviver ao recarregamento, mas o cadastro não para. Perder a
continuidade do diagnóstico é aceitável; travar o cadastro do dono, não.

— referente a src/lib/dispositivo.ts

## Apontamentos do SonarQube recusados de propósito

O projeto passa por varreduras do SonarQube. A maioria dos apontamentos foi aplicada — os
quatro abaixo **não**, e cada um tem motivo. Sem este registro, a próxima varredura encontra
os mesmos alertas e alguém os "conserta", piorando o código.

**`S7718` — parâmetro de `catch` deveria se chamar `error_`.** Este projeto é escrito em
português por convenção: `dados`, `anterior`, `carregando`, `falhas`, `erro`, `causa`.
Renomear só os parâmetros de `catch` para inglês com underscore deixaria um punhado de
identificadores fora do padrão do resto. É regra configurável — **desligar, não obedecer**.

**`S6772` — espaçamento ambíguo entre elementos inline.** Casos como um ícone e um texto
separados por quebra de linha. O raciocínio da regra está certo em geral, mas nesses pontos
**o pai é um flex com `gap`**: o espaçamento é explícito no layout, não no texto. Pior,
inserir `{' '}` criaria um item flex a mais e o `gap` passaria a ser aplicado dos dois lados
dele — a "correção" quebraria o alinhamento. Se for preciso silenciar, o certo é `{/* */}`,
nunca `{' '}`.

**`S6747` — "Unknown property" em arquivos `.tsx`.** São dezenas, e todas são bug do
analisador. Os nomes de propriedade que ele reporta — `'g-white"'`, `'-h-[90dvh'`, `'}
   '`
— são **fatias de strings de `className` cortadas em posições deslocadas**, e não batem com
as próprias coordenadas reportadas. Não há o que consertar.

**`S2245` em `src/lib/data.ts`.** Esse arquivo não tem gerador aleatório nenhum; as
coordenadas apontam para `src/lib/dispositivo.ts`. Atribuição errada do relatório.

> **Antes de agir sobre uma varredura, confira contra qual commit ela rodou.** Em 21/09 uma
> lista inteira reapareceu porque o scan tinha rodado na `main`, que ainda não tinha os PRs
> abertos. Metade do trabalho seria refazer o que já estava feito.

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

**Sair exige confirmação**, porque entrar de novo exige internet. O `<dialog>` mora no
próprio componente, para que celular e desktop tenham a mesma proteção. Ao abrir, lê
`navigator.onLine`: se for `false`, mostra também o aviso de que só será possível entrar
quando a conexão voltar. É uma leitura no momento da abertura, não um acompanhamento da
rede enquanto o diálogo está aberto.

"Continuar conectado" recebe o foco inicial; fechar ou apertar `Esc` mantém a sessão.
Só confirmar "Sair" chama `sair()`, sem `await` e com o `.catch()` de falha preservado.

— referente a src/components/layout/SignOutButton.tsx, arquivo inteiro

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

Desde 21/09/2026 isso é `await import('./App')` no topo do módulo, dentro de `try/catch`, e não mais cadeia de `.then().catch()`. O comportamento é o mesmo; o que muda é a leitura. Top-level await torna o módulo assíncrono, o que aqui não custa nada porque `main.tsx` é o ponto de entrada e ninguém o importa.

— referente a src/main.tsx, arquivo inteiro

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
>   npm run preview:treino

— referente a vite.config.ts, linhas 54–64

O bloco `build` separa o que vem de `node_modules` em dois chunks próprios, por
`build.rolldownOptions.output.codeSplitting.groups`: `firebase` (`@firebase/*` e
`firebase`, prioridade 2) e `vendor` (todo o resto de `node_modules`, prioridade 1). A
prioridade maior faz o Firebase ganhar do `vendor` — sem ela, os módulos do Firebase
cairiam no grupo genérico. O regex usa `[\\/]` e não `/` porque no Windows o caminho do
módulo vem com `\`, e a doc do rolldown pede os dois separadores. `manualChunks` está
depreciado no Vite 8 (o rolldown o ignora quando `codeSplitting` existe), por isso não é
usado. O código do app, inclusive `src/lib/firebase.ts`, continua no chunk do `App` — é o
que mantém o `import('./App')` do `src/main.tsx` rejeitando quando a config falta, e com
isso a `SetupError`.

O ganho, medido em 24/09/2026: antes, `App-*.js` tinha 777 kB (Firebase, react-router,
lucide e o app juntos) e `index-*.js` 184 kB (React), e qualquer mudança no app trocava o
hash do `App` inteiro. Depois: `App` 89 kB, `vendor` 243 kB, `firebase` 642 kB, `index`
2,7 kB. Com uma troca de texto em `ClientesPage.tsx`, `firebase-*.js` e `vendor-*.js`
mantiveram o mesmo nome e só `App-*.js` e `index-*.js` mudaram (o `index` porque guarda o
nome com hash do `App`) — numa atualização comum, o aparelho baixa ~92 kB em vez de
~960 kB. O aviso de chunk acima de 500 kB continua, agora só no `firebase-*.js`; o limite
(`chunkSizeWarningLimit`) não foi aumentado de propósito.

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

## 1. Unicidade de `numero` — 🟢 com dono desde 21/09/2026

Uma regra enxerga o documento sendo escrito e nada mais. Para saber se já existe outro
cliente com `numero: 7` seria preciso varrer a coleção, e regra não varre. `get()` lê um
documento de caminho conhecido, custa uma leitura faturada, e não resolve o caso real:
**dois dispositivos offline podem criar o número 7 ao mesmo tempo e ambos passam**, cada
um contra um cache que não conhece o outro.

**Implementado em 21/09/2026** em `clienteComNumero` (`src/lib/cliente.ts`), consumido por
`validarCliente` e exibido ao vivo no campo de número do formulário. Verificado no roteiro
de aceite do mesmo dia: número repetido recusa, número de arquivado aceita.

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

## 7. Dígito verificador de CPF — 🟢 com dono desde 21/09/2026

Regras não têm laço nem aritmética suficiente para calcular dígito verificador. A regra
limita tamanho de `cpfDigits` e nada mais.

Dono: `situacaoCpf` em `src/lib/cpf.ts`, consumida por `validarCliente`, que **bloqueia o
salvamento** quando o dígito não fecha. Sem importação, todo CPF entra digitado pelo dono,
um a um — o que faz da validação no formulário a única que vai existir. Ver o AVISO na
seção do `src/lib/cliente.ts` para o porquê de bloquear em vez de avisar.

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

## Bloqueador de anúncios × canal do Firestore

Encontrado no teste manual da etapa 5, em 22/09/2026, num Brave com os escudos ligados.
O console mostrava:

```
POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel
  ?...&TYPE=terminate&...   net::ERR_BLOCKED_BY_CLIENT
```

**`ERR_BLOCKED_BY_CLIENT` não vem do servidor nem do nosso código** — é o navegador, ou
uma extensão dele, recusando a requisição antes de ela sair. Naquele caso era a chamada
`TYPE=terminate`, que o SDK faz ao fechar o canal de long-polling, e nada se perdeu: os
dados já tinham subido, conferidos no Console do Firebase.

Fica registrado porque a conclusão fácil é errada nos dois sentidos:

- **Não é bug do app, então não saia caçando no código.** Se o erro for só no `terminate`,
  é cosmético.
- **Mas também não é inofensivo por definição.** O Firestore web fala por um canal
  persistente com `googleapis.com`. Um bloqueador mais agressivo, ou uma rede corporativa
  com filtro, pode recusar o canal inteiro — e aí o sintoma é o app parecer offline para
  sempre, com o selo de sincronização preso, sem nenhum erro que aponte para a causa.

O que fazer quando aparecer: conferir **qual** requisição foi bloqueada. Só `terminate` é
ruído. `Listen/channel` ou `Write/channel` bloqueados significam que aquele aparelho não
sincroniza, e a saída é o usuário liberar o domínio — não há conserto possível no código,
porque a recusa acontece antes da rede.

## src/lib/venda.ts — a regra recusa, mas offline ninguém fica sabendo

Encontrado em 22/09/2026, conferindo à mão os documentos que o código monta contra o
`firestore.rules` já publicado. Não apareceu em teste nenhum e não apareceria: em teste
a escrita é síncrona e o erro volta na hora.

**R$ 0,03 em 12 parcelas.** `gerarParcelas` faz `floor(3/12) = 0`, então onze parcelas
nascem com `valorCentavos: 0`. A regra de `installments` exige `valorCentavos > 0`, então
o servidor recusa — **mas só quando a sincronização acontecer.**

Offline, o caminho é este: o lote entra no cache, a tela mostra o carnê completo, o dono
fecha o app e vai para a próxima visita. Horas depois, com a rede de volta, o Firestore
recusa e o carnê some. O `catch` do `commit()` registra a falha, mas ninguém está olhando,
e o dono já saiu da casa do cliente achando que lançou.

Corrigido com validação no formulário (`erroDasParcelas` recusa `numero > centavos`), e o
motivo vale mais do que o caso:

**Ano 9999 também tem esta armadilha.** `9999-06-01` é uma data civil válida, mas em 12
parcelas gera vencimentos no ano 10000, recusados pelo formato de quatro dígitos da regra
de `installments`. Como venda e parcelas vão num `writeBatch`, a recusa derruba **o lote
inteiro**, não apenas a parcela inválida.

`erroDaDataVenda`, usada por `validarVenda`, confere o último vencimento com
`vencimentoDaParcela` e recusa na data da venda se ele não passar em `ehDataCivil`.
Só faz essa checagem quando número de parcelas e dia de vencimento estão nas faixas
válidas, para não atribuir à data um erro de outro campo. Uma venda em novembro de 9999
com uma parcela ainda cabe; em dezembro, nem uma cabe. O conserto fica na validação do
formulário, sem mudar `gerarParcelas`, `data.ts` ou a regra.

> **Offline transforma erro de validação em erro silencioso e atrasado.** A recusa do
> servidor chega longe, no tempo e no espaço, de quem digitou. Por isso **toda restrição
> que a regra impõe precisa existir também no formulário** — não como duplicação
> defensiva, mas porque a regra sozinha só protege o banco, não o usuário.

Checagem prática ao mexer em `montarCamposVenda` ou `montarCamposPagamento`: abra o
`firestore.rules`, leia `tiposValidos()` da coleção, e confira campo a campo se o
formulário recusa antes o que a regra recusaria depois. As fixtures de
`tests/regras/ambiente.ts` (`vendaValida`, `parcelaValida`, `pagamentoValido`) são o
espelho do que o código deve produzir — mas **nada automatiza essa comparação**, porque
`vitest.rules.config.ts` deliberadamente não importa de `src/`. É conferência manual,
e está registrada aqui por isso.

## src/data/useCarne.ts — a venda e as parcelas vão num lote só

`registrarVenda` usa `writeBatch`, não vários `setDoc`. Não é preferência de estilo.

Meia venda gravada — o cabeçalho sem as parcelas, ou as parcelas sem o cabeçalho — é pior
do que venda nenhuma. `montarCarne` cruza os três listeners por `saleId`: uma venda sem
parcelas vira um carnê de zero parcelas com saldo zero, que a tela mostra como **quitada**.
Não existe sinal na interface que denuncie isso, e o dono acreditaria.

Com o lote, offline a coisa toda fica na fila e sobe inteira ou não sobe. Verificado no
bloco 8 da bateria de 22/09: criado offline, navegador fechado e reaberto ainda offline,
sincronizado em 2 s ao religar, e as 2 de 2 parcelas chegaram.

## src/components/layout/useTelaLarga.ts — CSS não resolve, e o custo é leitura

O painel lateral só existe no desktop. A tentação é `hidden lg:block`.

**Isso esconde o componente mas o monta.** `PainelDoCliente` chama `useCarne`, que sobe
**três listeners** do Firestore. Com CSS, todo celular que abrisse a lista de clientes
pagaria a leitura do carnê de um cliente que ninguém abriu — e a lista auto-seleciona o
primeiro, então aconteceria sempre, em toda sessão.

Por isso a decisão é em JS (`useSyncExternalStore` sobre `matchMedia`), e o painel
simplesmente não é renderizado abaixo de 1024px. O mesmo gancho decide se o clique na
lista seleciona o painel ou navega para `/clientes/:id` — o que CSS também não faria.

Primeira versão usava `useEffect` + `setState` e o ESLint recusou
(`react-hooks/set-state-in-effect`), com razão: é exatamente o caso que
`useSyncExternalStore` existe para resolver.

## .env.development e .env.treino

O Vite carrega `.env.[modo]` por cima do `.env`. Os dois arquivos trocam só
`VITE_BUSINESS_ID`, para `loja-treino`; a config do Firebase continua vindo do `.env`.

- `.env.development` vale para `npm run dev`.
- `.env.treino` vale para `vite build --mode treino`, que é o que `npm run preview:treino`
  roda. É build de produção de verdade — `NODE_ENV=production`, service worker, precache —
  e só a empresa muda. Por isso é o único jeito local de testar PWA e offline.

Os dois gravam no **Firestore real**, com as mesmas regras e o mesmo usuário, só que sob
`businesses/loja-treino`. Não é emulador. O que eles evitam é sujar
`businesses/loja-principal`, a empresa que o dono precisa receber vazia — foi exatamente
assim que os testes de 21 e 22/09 deixaram dado lá: sem claim no token, o `AuthProvider`
usa `VITE_BUSINESS_ID`, e o `.env` diz `loja-principal`.

O script `preview` saiu de propósito. Depois de `npm run build` ele serviria um bundle que
grava em `loja-principal`.

A porta é 4174, não 4173. Em `localhost:4173` mora o service worker de builds antigos que
gravavam em `loja-principal`, com a fila offline deles. Outra porta é outra origem: sem
esse worker e sem aquela fila.

Os dois arquivos são versionados de propósito — não têm segredo. O `.gitignore` ignora
`.env` e `*.local`, não `.env.[modo]`.

> **AVISO**
> Um `.env.development.local` ou `.env.treino.local` com `loja-principal` desfaz o
> isolamento em silêncio: o `.local` do modo vence o arquivo do modo, e nada no build
> avisa. Para conferir, procure a empresa no bundle: depois de `npx vite build --mode
> treino`, `loja-treino` tem que aparecer em `dist/assets/*.js` e `loja-principal` não.

## src/lib/ambiente.ts e src/components/FaixaDeTreino.tsx

A faixa "Ambiente de treino — nada do que for lançado aqui é real." decide pela
**empresa**, não pelo `MODE`. Na Vercel o Preview é build de produção: `import.meta.env.MODE`
vale `'production'` tanto no Preview quanto na Production. O que difere entre os dois é só
`VITE_BUSINESS_ID`.

A regra é `ehProducao`: produção é `VITE_BUSINESS_ID === 'loja-principal'` **e** emuladores
desligados. Todo o resto mostra a faixa. A pergunta é "isto é produção?", e não "isto é
treino?", de propósito: configuração errada — empresa com erro de digitação, espaço sobrando,
maiúscula, variável ausente — faz a faixa **aparecer**, nunca sumir. A comparação é exata
pelo mesmo motivo.

Emulador conta como não-produção, mesmo com `loja-principal`: o dado vai para o emulador,
não para a empresa real.

A Production da Vercel **mostra a faixa até a entrega**, porque fica sem `VITE_BUSINESS_ID`
até o dono começar. É esperado, não é defeito.

A faixa fica em `App.tsx`, como primeiro filho do `BrowserRouter` e fora do `AppShell`, para
aparecer também no login.

> **AVISO**
> A faixa lê a variável do **build**. Hoje isso equivale a ler a empresa em uso, porque
> ninguém tem o claim `businessId` (só o Admin SDK grava claim, e o projeto não usa) e o
> `AuthProvider` cai no `VITE_BUSINESS_ID`. No dia em que existir claim, o `AuthProvider`
> passa a preferi-lo — e a faixa precisa passar a ler a empresa resolvida do contexto de
> auth, senão um usuário com claim `loja-principal` num build de treino veria a faixa
> gravando em produção, ou o contrário.

## vercel.json e a Vercel

**O rewrite só pega caminho sem ponto.** `"/((?!.*\\.).*)"` manda para `/index.html` o que
não tem `.` no caminho: as rotas do app (`/clientes`, `/clientes/:id`, `/rotas`,
`/financeiro`, `/login`) e os IDs do Firestore não têm ponto. Se o rewrite pegasse tudo, um
asset inexistente — um `/assets/App-antigo.js` pedido por um `index.html` velho — voltaria
como HTML com status 200, e com o cabeçalho `immutable` esse HTML ficaria um ano no
navegador no lugar do JavaScript: tela branca, sem erro que aponte a causa. Com o filtro,
dá 404.

**Os cabeçalhos.** `/assets/*` tem hash no nome, então recebe
`public, max-age=31536000, immutable`: o nome muda quando o conteúdo muda. Todo o resto
(`/`, `index.html`, `sw.js`, `manifest.webmanifest`, `workbox-*.js`, ícones) recebe
`no-cache`. Um `sw.js` ou `index.html` velho em cache prende o aparelho na versão antiga, e
o aviso de atualização do `PwaPrompt` depende de o navegador buscar o `sw.js` de novo.

**Preview é build de produção.** `NODE_ENV=production`, service worker e precache, igual à
Production. O que difere entre os dois ambientes vem só de variável — por isso a faixa de
treino decide pela empresa e não pelo `MODE` (ver `src/lib/ambiente.ts` acima).

**Cada deploy é uma origem.** Cada deploy tem URL própria, e cada URL tem cache, fila
offline, service worker e login próprios. Um teste offline feito numa URL de deploy some no
push seguinte. Testar offline só no branch `treino`, que tem endereço estável, ou em
`localhost:4174` (`npm run preview:treino`).

**Variável nova só vale no próximo deploy.** O Vite embute `VITE_*` no bundle em tempo de
build; mudar no painel não altera o que já foi publicado. É preciso *Redeploy*.

**Production fica sem `VITE_BUSINESS_ID` até a entrega.** Sem empresa, a URL de produção
não tem onde gravar, e `loja-principal` só recebe dado quando o dono começar. Cadastrar a
variável antes disso reabre exatamente o problema que o `.env.development` e o `.env.treino`
fecharam: teste gravando na empresa que o dono precisa receber vazia.

**A proteção de deploy (Vercel Authentication) fica desligada**, para o iPhone abrir o
treino sem conta da Vercel. Os previews ficam públicos, mas só mostram o login; quem
protege os dados são as regras do Firestore, não o sigilo da URL.
