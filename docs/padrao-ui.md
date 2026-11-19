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
`text-danger` e o ícone num quadrado `bg-white text-danger`. Hoje nenhuma permissão usa esse tom.
A primeira será a de cancelar.

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
com o ícone da permissão em 14 px. Sem nenhuma ligada, aparece uma etiqueta tracejada,
`border border-dashed border-slate-300 text-slate-500`, com "Sem permissões extras".

### Botões

- Primário: `bg-brand-600`, texto branco.
- Secundário: `border border-slate-200 bg-white`.
- Perigo: `border border-red-200 text-danger`.

### Toque

Todo alvo de toque tem no mínimo 44 px de altura (`min-h-11`). A linha de permissão tem 64 px
(`min-h-16`).

### Modal

Os dois modais da Equipe usam `ModalDeFormulario`: tela cheia no celular e caixa no
computador, com o rodapé fixo e o botão de salvar sempre visível, acima da barra do iPhone.
