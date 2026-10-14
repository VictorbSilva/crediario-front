import { useId, useState } from 'react'
import type { SubmitEvent } from 'react'
import { Campo } from '@/components/ui/Campo'
import { ModalDeFormulario } from '@/components/ui/ModalDeFormulario'
import { Nota } from '@/components/ui/Nota'
import { useClientes } from '@/data/useClientes'
import {
  ENTRADA_CLIENTE_VAZIA,
  LIMITES_CLIENTE,
  entradaDoCliente,
  validarCliente,
  validarEdicaoCliente,
} from '@/lib/cliente'
import type { EntradaCliente } from '@/lib/cliente'
import { avisoDeConferencia } from '@/lib/sync'
import type { Cliente } from '@/types/cliente'

export function FormularioCliente({
  cliente,
  aoFechar,
}: Readonly<{ cliente?: Cliente; aoFechar: () => void }>) {
  const { clientes, confianca, criarCliente, editarCliente } = useClientes()

  const [clienteInicial] = useState(cliente)
  const [entrada, setEntrada] = useState<EntradaCliente>(() =>
    cliente ? entradaDoCliente(cliente) : ENTRADA_CLIENTE_VAZIA,
  )
  const [tocados, setTocados] = useState<Partial<Record<keyof EntradaCliente, boolean>>>({})
  const [tentouSalvar, setTentouSalvar] = useState(false)
  const [semEmpresa, setSemEmpresa] = useState(false)

  const base = useId()

  const erros = cliente
    ? validarEdicaoCliente(entrada)
    : validarCliente(entrada, clientes, confianca)
  const aviso = cliente ? null : avisoDeConferencia(confianca)

  function mostrar(campo: keyof EntradaCliente): string | undefined {
    const erro = erros[campo]
    if (!erro) return undefined
    if (tentouSalvar || tocados[campo]) return erro
    if (campo === 'numero' && entrada.numero.trim() !== '') return erro
    return undefined
  }

  function mudar(campo: keyof EntradaCliente) {
    return (valor: string) => setEntrada((atual) => ({ ...atual, [campo]: valor }))
  }

  function sair(campo: keyof EntradaCliente) {
    return () => setTocados((atual) => ({ ...atual, [campo]: true }))
  }

  function enviar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    setTentouSalvar(true)
    if (Object.keys(erros).length > 0) return

    if (clienteInicial) {
      if (!editarCliente(clienteInicial, entrada)) {
        setSemEmpresa(true)
        return
      }
    } else criarCliente(entrada)
    aoFechar()
  }

  return (
    <ModalDeFormulario
      titulo={cliente ? 'Editar cliente' : 'Novo cliente'}
      subtitulo={
        cliente
          ? `#${cliente.numero} — o número não muda depois do cadastro.`
          : 'O número é o mesmo da lista de papel.'
      }
      rotuloDeEnvio={cliente ? 'Salvar alterações' : 'Salvar cliente'}
      idDoTitulo={base + '-titulo'}
      aoEnviar={enviar}
      aoFechar={aoFechar}
    >
      {aviso ? <Nota tom="alerta">{aviso}</Nota> : null}
      {semEmpresa ? (
        <Nota tom="alerta">
          Não foi possível salvar: nenhuma empresa está vinculada a esta conta.
        </Nota>
      ) : null}

      {cliente ? null : (
        <Campo
          id={base + '-numero'}
          rotulo="Número"
          valor={entrada.numero}
          maxLength={9}
          inputMode="numeric"
          focoInicial
          obrigatorio
          erro={mostrar('numero')}
          dica="Conferido contra a lista deste aparelho, não contra o servidor."
          aoMudar={mudar('numero')}
          aoSair={sair('numero')}
        />
      )}

      <Campo
        id={base + '-nome'}
        rotulo="Nome"
        valor={entrada.nome}
        maxLength={LIMITES_CLIENTE.nome}
        focoInicial={cliente !== undefined}
        obrigatorio
        erro={mostrar('nome')}
        aoMudar={mudar('nome')}
        aoSair={sair('nome')}
      />

      <Campo
        id={base + '-telefone'}
        rotulo="Telefone"
        valor={entrada.telefone}
        maxLength={LIMITES_CLIENTE.telefone}
        inputMode="tel"
        erro={mostrar('telefone')}
        aoMudar={mudar('telefone')}
        aoSair={sair('telefone')}
      />

      <Campo
        id={base + '-cpf'}
        rotulo="CPF"
        valor={entrada.cpf}
        maxLength={LIMITES_CLIENTE.cpf}
        inputMode="numeric"
        erro={mostrar('cpf')}
        dica="Se preencher, precisa ser um CPF válido. Em branco também serve."
        aoMudar={mudar('cpf')}
        aoSair={sair('cpf')}
      />

      <Campo
        id={base + '-endereco'}
        rotulo="Endereço"
        valor={entrada.endereco}
        maxLength={LIMITES_CLIENTE.endereco}
        erro={mostrar('endereco')}
        aoMudar={mudar('endereco')}
        aoSair={sair('endereco')}
      />

      <Campo
        id={base + '-observacao'}
        rotulo="Observação"
        valor={entrada.observacao}
        maxLength={LIMITES_CLIENTE.observacao}
        multilinha
        erro={mostrar('observacao')}
        aoMudar={mudar('observacao')}
        aoSair={sair('observacao')}
      />
    </ModalDeFormulario>
  )
}
