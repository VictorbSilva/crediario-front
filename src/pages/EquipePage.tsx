import { useEffect, useId, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import { Plus } from 'lucide-react'
import { EtiquetasDePermissoes } from '@/components/equipe/EtiquetasDePermissoes'
import { SeletorDePermissoes } from '@/components/equipe/SeletorDePermissoes'
import { Campo } from '@/components/ui/Campo'
import { EmptyState } from '@/components/ui/EmptyState'
import { ModalDeFormulario } from '@/components/ui/ModalDeFormulario'
import { Nota } from '@/components/ui/Nota'
import { StatusPill } from '@/components/ui/StatusPill'
import { useEquipe } from '@/data/useEquipe'
import type { Equipe } from '@/data/useEquipe'
import type { Permissoes } from '@/lib/acesso'
import { LIMITES_MEMBRO, validarNovoMembro } from '@/lib/equipe'
import type { EntradaNovoMembro, Membro } from '@/lib/equipe'

const ENTRADA_VAZIA: EntradaNovoMembro = {
  nome: '',
  email: '',
  senha: '',
  permissoes: { financeiro: false, caixaDoDia: false, exportar: false },
}

type CampoDeTexto = 'nome' | 'email' | 'senha'

const BOTAO_SECUNDARIO =
  'min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50'

function FormularioNovoFuncionario({
  cadastrar,
  aoFechar,
}: Readonly<{ cadastrar: Equipe['cadastrar']; aoFechar: () => void }>) {
  const base = useId()
  const [entrada, setEntrada] = useState<EntradaNovoMembro>(ENTRADA_VAZIA)
  const [tocados, setTocados] = useState<Partial<Record<CampoDeTexto, boolean>>>({})
  const [tentouSalvar, setTentouSalvar] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)

  const erros = validarNovoMembro(entrada)

  function mostrar(campo: CampoDeTexto): string | undefined {
    return tentouSalvar || tocados[campo] ? erros[campo] : undefined
  }

  function mudar(campo: CampoDeTexto) {
    return (valor: string) => setEntrada((atual) => ({ ...atual, [campo]: valor }))
  }

  function sair(campo: CampoDeTexto) {
    return () => setTocados((atual) => ({ ...atual, [campo]: true }))
  }

  function enviar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    setTentouSalvar(true)
    if (Object.keys(erros).length > 0) return

    // A única ação do app que espera o servidor: sem a conta criada, não há uid onde
    // gravar o membro. A mensagem de erro volta para cá e o formulário fica aberto.
    setEnviando(true)
    setFalha(null)
    void cadastrar(entrada).then((mensagem) => {
      setEnviando(false)
      if (mensagem) setFalha(mensagem)
      else aoFechar()
    })
  }

  return (
    <ModalDeFormulario
      titulo="Novo funcionário"
      subtitulo="Cria a conta com que o funcionário entra no app."
      rotuloDeEnvio={enviando ? 'Criando conta…' : 'Criar conta'}
      idDoTitulo={base + '-titulo'}
      aoEnviar={enviar}
      aoFechar={aoFechar}
    >
      <Nota tom="info">
        Criar a conta precisa de internet. Depois, o funcionário pode trocar a senha pelo
        “Esqueci minha senha”, na tela de entrada.
      </Nota>
      {falha ? <Nota tom="alerta">{falha}</Nota> : null}

      <Campo
        id={base + '-nome'}
        rotulo="Nome"
        valor={entrada.nome}
        maxLength={LIMITES_MEMBRO.nome}
        focoInicial
        obrigatorio
        erro={mostrar('nome')}
        aoMudar={mudar('nome')}
        aoSair={sair('nome')}
      />

      <Campo
        id={base + '-email'}
        rotulo="E-mail"
        valor={entrada.email}
        maxLength={LIMITES_MEMBRO.email}
        inputMode="email"
        obrigatorio
        erro={mostrar('email')}
        aoMudar={mudar('email')}
        aoSair={sair('email')}
      />

      <Campo
        id={base + '-senha'}
        rotulo="Senha"
        valor={entrada.senha}
        tipo="password"
        obrigatorio
        erro={mostrar('senha')}
        aoMudar={mudar('senha')}
        aoSair={sair('senha')}
      />

      <SeletorDePermissoes
        permissoes={entrada.permissoes}
        aoMudar={(permissoes) => setEntrada((atual) => ({ ...atual, permissoes }))}
      />
    </ModalDeFormulario>
  )
}

function FormularioPermissoes({
  membro,
  aoSalvar,
  aoFechar,
}: Readonly<{ membro: Membro; aoSalvar: (permissoes: Permissoes) => void; aoFechar: () => void }>) {
  const base = useId()
  const [permissoes, setPermissoes] = useState<Permissoes>(() => ({ ...membro.permissoes }))

  function enviar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    aoSalvar(permissoes)
    aoFechar()
  }

  return (
    <ModalDeFormulario
      titulo="Permissões"
      subtitulo={membro.nome}
      rotuloDeEnvio="Salvar permissões"
      idDoTitulo={base + '-titulo'}
      aoEnviar={enviar}
      aoFechar={aoFechar}
    >
      <SeletorDePermissoes permissoes={permissoes} aoMudar={setPermissoes} />
    </ModalDeFormulario>
  )
}

/** Mesmo padrão do `ConfirmarCancelamentoVenda`: um `<dialog>` aberto pelo `ref`, nada de `window.confirm`. */
function ConfirmarDesativacao({
  membro,
  aoConfirmar,
  aoFechar,
}: Readonly<{ membro: Membro; aoConfirmar: () => void; aoFechar: () => void }>) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const base = useId()

  useEffect(() => {
    dialogo.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialogo}
      onClose={aoFechar}
      aria-labelledby={base + '-titulo'}
      aria-describedby={base + '-descricao'}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto rounded-2xl bg-white p-5 backdrop:bg-slate-900/40"
    >
      <h2 id={base + '-titulo'} className="text-lg font-semibold text-slate-900">
        Desativar {membro.nome}?
      </h2>
      <p id={base + '-descricao'} className="mt-1 text-sm text-slate-600">
        {membro.nome} deixa de acessar os dados da loja. A conta não é apagada: dá para
        reativar depois.
      </p>

      <div className="mt-5 flex flex-col gap-2">
        <button type="button" autoFocus onClick={aoFechar} className={BOTAO_SECUNDARIO}>
          Voltar
        </button>
        <button
          type="button"
          onClick={() => {
            aoConfirmar()
            aoFechar()
          }}
          className="min-h-11 rounded-lg bg-danger px-4 text-sm font-semibold text-white"
        >
          Desativar
        </button>
      </div>
    </dialog>
  )
}

export function EquipePage() {
  const { membros, carregando, erro, cadastrar, alterarPermissoes, definirAtivo } = useEquipe()

  const [cadastrando, setCadastrando] = useState(false)
  const [editando, setEditando] = useState<Membro | null>(null)
  const [desativando, setDesativando] = useState<Membro | null>(null)

  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Equipe</h1>
          <p className="mt-1 text-sm text-slate-500">Funcionários que entram no app da loja.</p>
        </div>
        <button
          type="button"
          onClick={() => setCadastrando(true)}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <Plus size={17} aria-hidden />
          Novo funcionário
        </button>
      </div>

      {erro ? (
        <div className="mb-4">
          <Nota tom="alerta">{erro}</Nota>
        </div>
      ) : null}

      {carregando ? (
        <EmptyState>Carregando a equipe…</EmptyState>
      ) : membros.length === 0 ? (
        <EmptyState>Nenhum funcionário cadastrado ainda. Comece pelo botão “Novo funcionário”.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {membros.map((membro) => (
            <li key={membro.uid} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{membro.nome}</span>
                    <StatusPill tom={membro.ativo ? 'sucesso' : 'neutro'}>
                      {membro.ativo ? 'Ativo' : 'Desativado'}
                    </StatusPill>
                    {membro.pendente ? <StatusPill tom="marca">Pendente</StatusPill> : null}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-slate-500">{membro.email}</div>
                  <div className="mt-2">
                    <EtiquetasDePermissoes permissoes={membro.permissoes} />
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => setEditando(membro)} className={BOTAO_SECUNDARIO}>
                    Permissões
                  </button>
                  {membro.ativo ? (
                    <button
                      type="button"
                      onClick={() => setDesativando(membro)}
                      className="min-h-11 rounded-lg border border-danger/30 bg-white px-4 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
                    >
                      Desativar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => definirAtivo(membro.uid, true)}
                      className={BOTAO_SECUNDARIO}
                    >
                      Reativar
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {cadastrando ? (
        <FormularioNovoFuncionario cadastrar={cadastrar} aoFechar={() => setCadastrando(false)} />
      ) : null}
      {editando ? (
        <FormularioPermissoes
          membro={editando}
          aoSalvar={(permissoes) => alterarPermissoes(editando.uid, permissoes)}
          aoFechar={() => setEditando(null)}
        />
      ) : null}
      {desativando ? (
        <ConfirmarDesativacao
          membro={desativando}
          aoConfirmar={() => definirAtivo(desativando.uid, false)}
          aoFechar={() => setDesativando(null)}
        />
      ) : null}
    </>
  )
}
