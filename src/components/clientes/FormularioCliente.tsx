import { useId, useState } from 'react'
import type { SubmitEvent } from 'react'
import { Campo } from '@/components/ui/Campo'
import { ModalDeFormulario } from '@/components/ui/ModalDeFormulario'
import { Nota } from '@/components/ui/Nota'
import { useClientes } from '@/data/useClientes'
import { ENTRADA_CLIENTE_VAZIA, LIMITES_CLIENTE, validarCliente } from '@/lib/cliente'
import type { EntradaCliente } from '@/lib/cliente'
import { avisoDeConferencia } from '@/lib/sync'

export function FormularioCliente({ aoFechar }: Readonly<{ aoFechar: () => void }>) {
  const { clientes, confianca, criarCliente } = useClientes()

  const [entrada, setEntrada] = useState<EntradaCliente>(ENTRADA_CLIENTE_VAZIA)
  const [tocados, setTocados] = useState<Partial<Record<keyof EntradaCliente, boolean>>>({})
  const [tentouSalvar, setTentouSalvar] = useState(false)

  const base = useId()

  const erros = validarCliente(entrada, clientes, confianca)
  const aviso = avisoDeConferencia(confianca)

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

    criarCliente(entrada)
    aoFechar()
  }

  return (
    <ModalDeFormulario
      titulo="Novo cliente"
      subtitulo="O número é o mesmo da lista de papel."
      rotuloDeEnvio="Salvar cliente"
      idDoTitulo={base + '-titulo'}
      aoEnviar={enviar}
      aoFechar={aoFechar}
    >
      {aviso ? <Nota tom="alerta">{aviso}</Nota> : null}

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

      <Campo
        id={base + '-nome'}
        rotulo="Nome"
        valor={entrada.nome}
        maxLength={LIMITES_CLIENTE.nome}
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
