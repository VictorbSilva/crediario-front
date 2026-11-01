import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Cliente } from '@/types/cliente'
import { ListaDeClientes } from './ListaDeClientes'

describe('ListaDeClientes — endereço', () => {
  it.each([
    [{ rua: 'Rua A', bairro: 'Centro', cidade: 'Recife' }, 'Rua A · Centro · Recife'],
    [{ endereco: 'Rua antiga' }, 'Rua antiga'],
    [{}, 'Sem endereço'],
  ] as const)('exibe endereço novo, legado ou indicação de ausência: %j', (endereco, esperado) => {
    const cliente: Cliente = {
      id: 'ana', numero: 1, nome: 'Ana', nomeBusca: 'ana', cadastradoEm: '2026-10-31',
      criadoEm: null, atualizadoEm: null, atualizadoPor: 'x', pendente: false, ...endereco,
    }
    expect(renderToStaticMarkup(<ListaDeClientes encontrados={[cliente]} cadastrados={1}
      carregando={false} aoSelecionar={() => undefined} />)).toContain(esperado)
  })
})
