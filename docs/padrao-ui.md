# Padrão de UI

Este documento registra os padrões de tela já aprovados. Ele vale junto com as convenções de
estilo do `CLAUDE.md`: só classes Tailwind, tokens em `tailwind.config.js` (`brand`, `success`,
`warning`, `danger`), nenhum `.css` novo e nenhuma variante `dark:`, porque o app só tem tema
claro.

## Equipe

Desenho aprovado pelo Victor em 19/11/2026: https://claude.ai/artifact/MtjAdpDW7CAi4hC72w1TW1

**Toda mudança na tela Equipe segue esta seção.** Se o desenho mudar, esta seção muda junto, no
mesmo commit.

### Permissão nova

Permissão nova entra em `DESCRICAO_DAS_PERMISSOES` (`src/lib/equipe.ts`), com `rotulo`,
`descricao`, `grupo` (`'ver'` ou `'fazer'`) e, se for arriscada, `risco: true`. Ela também ganha
um ícone em `ICONES_DAS_PERMISSOES` (`src/components/equipe/iconesDePermissoes.ts`), que é um
`Record` de todas as chaves e não compila sem ele. **Nunca entra como caixinha solta.** A linha,
o grupo, as etiquetas e os perfis Cobrador e Gerente saem dessa lista sozinhos.

A chave nova também precisa existir no tipo `Permissoes` e na regra de `membros`, mas isso é
dado, não UI: ver `docs/armadilhas.md`.

### Título de seção

`text-xs font-bold uppercase tracking-wider text-slate-600`. Exemplo: "Permissões", no topo do
`SeletorDePermissoes`.

### Cartão

`rounded-xl border border-slate-200 bg-white overflow-hidden`, com as linhas separadas por
`divide-y divide-slate-100`. Cada grupo ("Pode ver", "Pode fazer") tem um cartão, com um
subtítulo acima em `text-[13px] font-semibold text-slate-600`. Grupo sem permissão não aparece.

### Linha de permissão

`LinhaDePermissao`, `min-h-16 px-3.5 py-3`, da esquerda para a direita:

- ícone num quadrado `h-9 w-9 rounded-lg bg-slate-100 text-slate-700`;
- título `text-sm font-semibold` e, embaixo, a descrição `text-[13px] text-slate-500`;
- o `Interruptor`, à direita.

Tocar em qualquer parte da linha alterna. A linha é um `<label>` em volta do interruptor: o
toque no texto ou no ícone vira um clique no botão, e o toque no próprio botão não se repete.

### Tom de risco

Para permissão com `risco: true`: fundo da linha `bg-danger-soft`, título e descrição
`text-danger` e o ícone num quadrado `bg-white text-danger`. Hoje só "Cancelar vendas e
pagamentos" usa esse tom.

### "Sempre liberado"

Uma faixa fixa, sem interruptor, entre os perfis e os grupos: ícone `Lock`, título "Sempre
liberado" e o texto "Clientes, Rotas e o carnê de cada cliente". Classes:
`rounded-xl border border-brand-100 bg-brand-50`, título em `text-brand-800` e texto em
`text-brand-700`.

### Interruptor

`src/components/ui/Interruptor.tsx`: `<button type="button" role="switch" aria-checked>`, 48×28
(`h-7 w-12`), com trilho `bg-brand-600` ligado e `bg-slate-300` desligado. A bolinha é branca, de
22 px, e vai para a direita quando liga. O foco aparece com
`focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2`. As props são
`ligado`, `aoMudar`, `idDoRotulo` (vira o `aria-labelledby`) e `desabilitado`.

### Perfis

Um grupo de três botões com `aria-pressed`: Cobrador, Gerente e Personalizado, em
`grid grid-cols-3 gap-1 rounded-xl bg-slate-200 p-1`. O botão ativo fica em
`bg-white font-bold shadow-sm`. O perfil ativo vem de `perfilDe(permissoes)`: tudo desligado é
Cobrador, tudo ligado é Gerente e qualquer mistura é Personalizado. Cobrador e Gerente aplicam
`permissoesDoPerfil`. Personalizado não muda nada: é o que sobra quando se mexe num interruptor.

### Etiquetas

`EtiquetasDePermissoes`, no cartão do membro, abaixo do e-mail. Cada permissão ligada vira uma
etiqueta
`inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700`,
com o ícone da permissão em 14 px. Sem nenhuma ligada, aparece só o texto "Sem permissões
extras", em `py-1 text-xs font-semibold text-slate-500`, sem contorno nem fundo e alinhado à
esquerda do cartão. O contorno tracejado do desenho saiu a pedido do Victor, em 19/11/2026.

### Cartão da lista

Um cartão por membro, `flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5`,
de cima para baixo:

- `Avatar` de 40 px (`h-10 w-10`) com `iniciaisDe(nome)`, destacado quando ativo; ao lado, o
  nome em `text-[15px] font-semibold` (cinza, `text-slate-600`, quando desativado), o
  `StatusPill` Ativo (sucesso) ou Desativado (neutro), "Pendente" (marca) quando há gravação
  sem confirmação, e o e-mail em `text-[13px] text-slate-500 truncate`;
- `EtiquetasDePermissoes`, só para quem está ativo;
- um único botão secundário "Gerenciar", alinhado à direita, com texto `text-brand-600` e
  `aria-label` "Gerenciar {nome}", para o leitor de tela saber de quem é cada botão.

Desativar, reativar e mudar permissões ficam todos dentro do card "Gerenciar funcionário",
nunca soltos no cartão.

### Botões

- Primário: `bg-brand-600`, texto branco.
- Secundário: `border border-slate-200 bg-white`.
- Perigo: `border border-red-200 text-danger`.
- Desabilitado (envio do modal): `disabled:bg-slate-200 disabled:text-slate-600`.

### Toque

Todo alvo de toque tem no mínimo 44 px de altura (`min-h-11`). A linha de permissão tem 64 px
(`min-h-16`).

### Modal

Os modais da Equipe usam `ModalDeFormulario`: tela cheia no celular e caixa no computador,
com o rodapé fixo e o botão de salvar sempre visível, acima da barra do iPhone. Sem as props
opcionais abaixo, ele é o mesmo de todos os formulários do app: X "Fechar sem salvar" no topo e
"Cancelar" mais o botão de envio no rodapé.

| Prop | O que faz |
| --- | --- |
| `envioDesabilitado` | Desabilita só o botão de envio. Cancelar e o X continuam fechando. |
| `rodape` | Conteúdo no rodapé fixo, acima dos botões (aviso de internet, "Alterações não salvas."). |
| `acoes` | Substitui "Cancelar" e o botão de envio. Botões aqui são `type="button"`. |
| `rotuloDeFechar` | O `aria-label` do X. O padrão é "Fechar sem salvar". |
| `cabecalho` | Conteúdo abaixo do título, ainda na faixa branca do topo. |

O miolo fica dentro de um `<form>`: todo botão que não envia é `type="button"`.

### Novo funcionário

- Seção "Acesso" (título de seção) com um cartão branco
  (`rounded-xl border border-slate-200 bg-white p-4`) com Nome, E-mail e `CampoDeSenha`. Abaixo,
  o `SeletorDePermissoes`.
- `CampoDeSenha` (`src/components/equipe/CampoDeSenha.tsx`): rótulo "Senha", botão de olho
  dentro do campo ("Mostrar a senha" e "Esconder a senha", alternando `type` entre password e
  text) e botão "Gerar" ao lado, com `RefreshCw`, que preenche com `gerarSenha()` e mostra a
  senha. A dica é "Mínimo de 6 caracteres. No fim, você vê a senha de novo para enviar a ele.".
  Continua `autoComplete="new-password"` mesmo visível, para o navegador não preencher a senha
  salva do dono, e sem maiúscula automática, correção nem verificação ortográfica.
- No `rodape`, o ícone `Wifi` com "Criar a conta precisa de internet.", em
  `text-[13px] text-slate-500`. Sem internet (`useEstaOnline`), o texto vira "Sem internet agora.
  Conecte para criar a conta." e o envio fica desabilitado com o rótulo "Sem internet".

### Conta criada

Criada a conta, o mesmo `<dialog>` troca o conteúdo: o `FormularioNovoFuncionario` devolve o
mesmo `ModalDeFormulario` na mesma posição, e o React reaproveita o diálogo aberto.

- Título "Conta criada" e o nome como subtítulo; `rotuloDeFechar="Fechar"`; `acoes` com um só
  botão secundário "Concluir", de largura inteira.
- Miolo `ContaCriada` (`src/components/equipe/ContaCriada.tsx`): `CircleCheck` num círculo
  `h-14 w-14 rounded-full bg-success-soft text-success`, o título "A conta de {primeiro nome}
  está pronta", o aviso de que a senha só aparece desta vez, um cartão com E-mail e Senha
  (cada um com botão de copiar só com ícone, de 44 px), a caixa cinza "Mensagem pronta"
  (`bg-slate-100 whitespace-pre-line`), o link primário "Enviar pelo WhatsApp" e o botão
  secundário "Copiar mensagem".
- Todos os botões são `type="button"`, porque estão dentro do `<form>`.
- Copiar usa `navigator.clipboard.writeText` e o botão mostra "Copiado" por 2 s. Se falhar, ou
  se o navegador não tiver a área de transferência, aparece "Não deu para copiar. Selecione o
  texto e copie.".

### Gerenciar funcionário

- Título "Gerenciar funcionário" e, no `cabecalho`, o `CabecalhoDoMembro`
  (`src/components/equipe/CabecalhoDoMembro.tsx`): `Avatar` de 48 px (`h-12 w-12 text-base`),
  destacado quando ativo, o nome em `text-base font-semibold`, o `StatusPill`, "Pendente" e o
  e-mail em `text-[13px] text-slate-500 truncate`. O card recebe o membro da lista, então o
  cabeçalho acompanha o servidor com o card aberto; os interruptores guardam o que foi mexido.
- O miolo é o `SeletorDePermissoes`. "Salvar alterações" fica com `envioDesabilitado` enquanto
  `mesmasPermissoes(atuais, do membro)`, e o `rodape` diz "Nenhuma alteração para salvar." ou
  "Alterações não salvas.", em `text-xs text-slate-500`.
- Membro ativo: seção "Zona de risco", com o título de seção em `text-danger` e um cartão
  `rounded-xl border border-red-200 bg-white p-3.5`: "Desativar o acesso de {primeiro nome}", o
  texto em `text-[13px] text-slate-500` e o botão de perigo "Desativar acesso", que abre a
  confirmação. Ver `docs/armadilhas.md`, src/pages/EquipePage.tsx.
- Membro desativado: no lugar da zona de risco, a seção "Acesso desativado", com o texto
  "{primeiro nome} não entra no app. Ao reativar, volta com as permissões marcadas acima." e o
  botão secundário "Reativar acesso".
- Desativar e reativar gravam e fecham o card. Se os interruptores foram mexidos, as permissões
  são gravadas antes, para a mudança não se perder sem aviso.
