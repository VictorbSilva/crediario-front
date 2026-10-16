// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { CarneDaEmpresa } from '@/data/useCarneDaEmpresa'
import type { ConfiancaDaLista } from '@/lib/sync'
import { instalarDialogo } from '@/test/dialogo'
import type { Cliente } from '@/types/cliente'
import { ExportarClientes } from './ExportarClientes'

const simulado = vi.hoisted(() => ({
  lista: {
    clientes: [] as Cliente[],
    arquivados: [] as Cliente[],
    confianca: 'confiavel' as ConfiancaDaLista,
    pendentes: 0,
  },
  carne: {} as CarneDaEmpresa,
}))

vi.mock('@/data/useClientes', () => ({ useClientes: () => simulado.lista }))
vi.mock('@/data/useCarneDaEmpresa', () => ({
  CARNE_COMPLETO: ['sales', 'installments', 'payments'],
  useCarneDaEmpresa: () => simulado.carne,
}))

function cliente(id: string, numero: number, extras: Partial<Cliente> = {}): Cliente {
  return {
    id, numero, nome: `Cliente ${numero}`, nomeBusca: `cliente ${numero}`, cadastradoEm: '2026-09-03',
    criadoEm: null, atualizadoEm: null, atualizadoPor: 'x', pendente: false, ...extras,
  }
}

const ANA = cliente('ana', 12)
const BIA = cliente('bia', 13, { arquivado: true })
const CAIO = cliente('caio', 14)

function carne(extras: Partial<CarneDaEmpresa> = {}): CarneDaEmpresa {
  return {
    vendas: [
      { id: 'v1', dados: { clientId: 'ana', numeroParcelas: 2, campoNovo: 'vai junto' } },
      { id: 'v2', dados: { clientId: 'caio', numeroParcelas: 1 } },
    ],
    parcelas: [
      { id: 'p1', dados: { saleId: 'v1' } },
      { id: 'p2', dados: { saleId: 'v1' } },
      { id: 'p3', dados: { saleId: 'v2' } },
    ],
    pagamentos: [{ id: 'pg1', dados: { saleId: 'v1', valorCentavos: 5000 } }],
    carregando: false,
    pendentes: 0,
    confianca: 'confiavel',
    erro: null,
    ...extras,
  }
}

type Entrega = { href: string; download: string; noDocumento: boolean }

let entregas: Entrega[]
let arquivos: File[]
let revogar: Mock<(url: string) => void>
let aoFechar: Mock<() => void>

function aparelho({ ua = 'Mozilla/5.0 (Windows NT 10.0)', plataforma = 'Win32', toques = 0 } = {}) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua)
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(plataforma)
  // O jsdom não tem maxTouchPoints; a propriedade é criada e removida no afterEach.
  Object.defineProperty(navigator, 'maxTouchPoints', { value: toques, configurable: true })
}

const IPHONE = { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', plataforma: 'iPhone', toques: 5 }

function compartilhamento(pode: boolean, share: () => Promise<void> = () => Promise.resolve()) {
  const canShare = vi.fn(() => pode)
  const compartilhar = vi.fn(share)
  Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true })
  Object.defineProperty(navigator, 'share', { value: compartilhar, configurable: true })
  return { canShare, compartilhar }
}

function botao(nome: RegExp): HTMLButtonElement {
  return screen.getByRole('button', { name: nome }) as HTMLButtonElement
}

const JSON_ = /Backup completo/
const CSV = /Planilha para conferir/

async function esvaziarFila() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  instalarDialogo()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(new Date(2026, 9, 15, 9, 30))
  simulado.lista = { clientes: [ANA, BIA, CAIO], arquivados: [BIA], confianca: 'confiavel', pendentes: 0 }
  simulado.carne = carne()
  aparelho()
  entregas = []
  arquivos = []
  revogar = vi.fn()
  aoFechar = vi.fn()
  URL.createObjectURL = vi.fn((arquivo: Blob) => {
    arquivos.push(arquivo as File)
    return `blob:arquivo-${arquivos.length}`
  })
  URL.revokeObjectURL = revogar
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    entregas.push({ href: this.href, download: this.download, noDocumento: this.isConnected })
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'canShare')
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'maxTouchPoints')
})

describe('ExportarClientes — o que a tela diz antes de exportar', () => {
  it('resume a lista e o carnê, no singular e no plural', () => {
    render(<ExportarClientes aoFechar={aoFechar} />)

    // O ponto final no padrão impede que "1 pagamentos" passe por "1 pagamento".
    expect(screen.getByText(/3 clientes, sendo 1 arquivado · 2 vendas · 1 pagamento\./)).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Exportar clientes' })).toBeTruthy()

    cleanup()
    simulado.lista = { ...simulado.lista, clientes: [ANA], arquivados: [] }
    simulado.carne = carne({ vendas: [carne().vendas[0]], pagamentos: [] })
    render(<ExportarClientes aoFechar={aoFechar} />)
    expect(screen.getByText(/^1 cliente · 1 venda · 0 pagamentos\./)).toBeTruthy()
  })

  it('com o carnê ainda carregando, não chuta a contagem de vendas', () => {
    simulado.carne = carne({ carregando: true, confianca: 'desconhecida' })
    render(<ExportarClientes aoFechar={aoFechar} />)

    expect(screen.getByText(/^3 clientes, sendo 1 arquivado\. Arquivados entram no arquivo\./)).toBeTruthy()
  })

  it('lista de clientes carregando bloqueia os dois arquivos', () => {
    simulado.lista = { ...simulado.lista, confianca: 'desconhecida' }
    render(<ExportarClientes aoFechar={aoFechar} />)

    expect(screen.getByText('A lista de clientes ainda está carregando. Espere terminar para exportar.')).toBeTruthy()
    expect(botao(JSON_).disabled).toBe(true)
    expect(botao(CSV).disabled).toBe(true)
  })

  it('sem nenhum cliente, não há o que exportar', () => {
    simulado.lista = { ...simulado.lista, clientes: [], arquivados: [] }
    render(<ExportarClientes aoFechar={aoFechar} />)

    expect(screen.getByText('Não há nenhum cliente para exportar ainda.')).toBeTruthy()
    expect(botao(CSV).disabled).toBe(true)
  })

  it('lista parcial deixa exportar, mas grita que pode faltar cliente', () => {
    simulado.lista = { ...simulado.lista, confianca: 'parcial', pendentes: 2 }
    render(<ExportarClientes aoFechar={aoFechar} />)

    expect(screen.getByText('Confira antes de guardar este arquivo')).toBeTruthy()
    expect(screen.getByText(/pode sair com apenas parte dos clientes.*2 cadastros ainda não subiram/)).toBeTruthy()
    expect(botao(JSON_).disabled).toBe(false)
    expect(botao(CSV).disabled).toBe(false)
  })

  it('carnê carregando bloqueia só o backup completo: a planilha não depende dele', () => {
    simulado.carne = carne({ carregando: true, confianca: 'desconhecida' })
    render(<ExportarClientes aoFechar={aoFechar} />)

    expect(screen.getByText(/As vendas e os pagamentos ainda estão carregando/)).toBeTruthy()
    expect(botao(JSON_).disabled).toBe(true)
    expect(botao(CSV).disabled).toBe(false)
  })

  it('erro de leitura do carnê bloqueia o backup, mesmo num aparelho que já sincronizou', () => {
    simulado.carne = carne({ erro: 'Não foi possível carregar o carnê da empresa.' })
    render(<ExportarClientes aoFechar={aoFechar} />)

    expect(screen.getByText(/^Não foi possível carregar o carnê da empresa\. O backup completo fica bloqueado/)).toBeTruthy()
    expect(botao(JSON_).disabled).toBe(true)
    expect(botao(CSV).disabled).toBe(false)
  })

  it('parcela faltando no aparelho vira alerta no backup', () => {
    simulado.carne = carne({ parcelas: carne().parcelas.slice(0, 2) })
    render(<ExportarClientes aoFechar={aoFechar} />)

    expect(screen.getByText('Confira o carnê antes de guardar o backup')).toBeTruthy()
    expect(screen.getByText(/As vendas somam 3 parcelas, mas só 2 estão neste aparelho: falta 1/)).toBeTruthy()
    expect(botao(JSON_).disabled).toBe(false)
  })

  it('tudo sincronizado e conferido, sem alerta nenhum', () => {
    render(<ExportarClientes aoFechar={aoFechar} />)

    expect(screen.queryByText(/Confira/)).toBeNull()
  })
})

describe('ExportarClientes — download no computador e no Android', () => {
  it('o backup completo leva clientes e o carnê cru, com o nome e o tipo certos', async () => {
    render(<ExportarClientes aoFechar={aoFechar} />)

    fireEvent.click(botao(JSON_))

    expect(entregas).toEqual([{ href: 'blob:arquivo-1', download: 'crediario-backup-2026-10-15.json', noDocumento: true }])
    const [arquivo] = arquivos
    expect(arquivo.name).toBe('crediario-backup-2026-10-15.json')
    expect(arquivo.type).toBe('application/json')
    const backup = JSON.parse(await arquivo.text())
    expect(backup.formato).toBe('crediario-backup')
    expect(backup.quantidades).toEqual({ clientes: 3, vendas: 2, parcelas: 3, pagamentos: 1 })
    expect(backup.clientes.map((c: { id: string }) => c.id)).toEqual(['ana', 'bia', 'caio'])
    // Campo que o app ainda não conhece entra mesmo assim.
    expect(backup.vendas[0]).toEqual({ id: 'v1', clientId: 'ana', numeroParcelas: 2, campoNovo: 'vai junto' })
    // O link existe só durante o clique.
    expect(document.querySelector('a[download]')).toBeNull()
  })

  it('a planilha sai com BOM, separador ponto e vírgula, nome e tipo de CSV', async () => {
    render(<ExportarClientes aoFechar={aoFechar} />)

    fireEvent.click(botao(CSV))

    const [arquivo] = arquivos
    expect(arquivo.name).toBe('crediario-clientes-2026-10-15.csv')
    expect(arquivo.type).toBe('text/csv;charset=utf-8')
    const bytes = new Uint8Array(await arquivo.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect((await arquivo.text()).split('\r\n')[0]).toContain(';')
  })

  it('a URL do arquivo só é revogada 60 s depois: revogar cedo cancela o download', () => {
    render(<ExportarClientes aoFechar={aoFechar} />)
    fireEvent.click(botao(CSV))

    vi.advanceTimersByTime(59_999)
    expect(revogar).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(revogar).toHaveBeenCalledWith('blob:arquivo-1')
  })

  it('o diálogo fecha quando a entrega termina', async () => {
    render(<ExportarClientes aoFechar={aoFechar} />)
    fireEvent.click(botao(JSON_))

    await esvaziarFila()

    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  it('Android com compartilhamento de arquivo continua baixando: a folha é só do iOS', () => {
    aparelho({ ua: 'Mozilla/5.0 (Linux; Android 14)', plataforma: 'Linux armv8l', toques: 5 })
    const { compartilhar } = compartilhamento(true)
    render(<ExportarClientes aoFechar={aoFechar} />)

    fireEvent.click(botao(CSV))

    expect(compartilhar).not.toHaveBeenCalled()
    expect(entregas).toHaveLength(1)
  })

  it.each([0, 1])('Mac de verdade (MacIntel com %i ponto de toque) baixa, mesmo podendo compartilhar', (toques) => {
    aparelho({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', plataforma: 'MacIntel', toques })
    const { compartilhar } = compartilhamento(true)
    render(<ExportarClientes aoFechar={aoFechar} />)

    fireEvent.click(botao(CSV))

    expect(compartilhar).not.toHaveBeenCalled()
    expect(entregas).toHaveLength(1)
  })

  it('terminada uma entrega, os botões destravam e aceitam outra', async () => {
    render(<ExportarClientes aoFechar={aoFechar} />)
    fireEvent.click(botao(CSV))
    await esvaziarFila()

    expect(botao(JSON_).disabled).toBe(false)
    fireEvent.click(botao(JSON_))

    expect(entregas.map((e) => e.download)).toEqual([
      'crediario-clientes-2026-10-15.csv', 'crediario-backup-2026-10-15.json',
    ])
  })
})

describe('ExportarClientes — folha de compartilhamento no iOS', () => {
  it('no iPhone, entrega pela folha com o arquivo e o nome, sem link de download', async () => {
    aparelho(IPHONE)
    const { canShare, compartilhar } = compartilhamento(true)
    render(<ExportarClientes aoFechar={aoFechar} />)

    fireEvent.click(botao(JSON_))

    expect(compartilhar).toHaveBeenCalledTimes(1)
    const [{ files, title }] = compartilhar.mock.calls[0] as unknown as [{ files: File[]; title: string }]
    expect(title).toBe('crediario-backup-2026-10-15.json')
    expect(files[0].name).toBe('crediario-backup-2026-10-15.json')
    expect(canShare).toHaveBeenCalledWith({ files })
    expect(entregas).toEqual([])
    await esvaziarFila()
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  it('iPad em modo desktop (MacIntel com toque) também usa a folha', () => {
    aparelho({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', plataforma: 'MacIntel', toques: 5 })
    const { compartilhar } = compartilhamento(true)
    render(<ExportarClientes aoFechar={aoFechar} />)

    fireEvent.click(botao(CSV))

    expect(compartilhar).toHaveBeenCalledTimes(1)
  })

  it('iOS que não sabe compartilhar arquivo, ou sem a API, cai no download', () => {
    aparelho(IPHONE)
    compartilhamento(false)
    render(<ExportarClientes aoFechar={aoFechar} />)
    fireEvent.click(botao(CSV))
    expect(entregas).toHaveLength(1)

    cleanup()
    Reflect.deleteProperty(navigator, 'canShare')
    render(<ExportarClientes aoFechar={aoFechar} />)
    fireEvent.click(botao(CSV))
    expect(entregas).toHaveLength(2)
  })

  it.each(['AbortError', 'InvalidStateError'])('%s (cancelou, ou já há uma folha aberta) não vira download', async (nome) => {
    aparelho(IPHONE)
    compartilhamento(true, () => Promise.reject(new DOMException('x', nome)))
    render(<ExportarClientes aoFechar={aoFechar} />)

    fireEvent.click(botao(CSV))
    await esvaziarFila()

    expect(entregas).toEqual([])
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['NotAllowedError', new DOMException('x', 'NotAllowedError')],
    ['rejeição sem erro', undefined],
  ])('%s na folha cai no download, para o arquivo não se perder', async (_nome, falha) => {
    aparelho(IPHONE)
    compartilhamento(true, () => Promise.reject(falha))
    render(<ExportarClientes aoFechar={aoFechar} />)

    fireEvent.click(botao(CSV))
    await esvaziarFila()

    expect(entregas).toHaveLength(1)
    expect(entregas[0].download).toBe('crediario-clientes-2026-10-15.csv')
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  it('durante a entrega os dois botões travam, e clique repetido não entrega duas vezes', async () => {
    aparelho(IPHONE)
    let concluir: () => void = () => undefined
    const { compartilhar } = compartilhamento(true, () => new Promise<void>((resolver) => {
      concluir = resolver
    }))
    render(<ExportarClientes aoFechar={aoFechar} />)

    // Dois cliques na mesma volta, antes de o React redesenhar o botão desabilitado.
    act(() => {
      botao(CSV).click()
      botao(CSV).click()
      botao(JSON_).click()
    })

    expect(compartilhar).toHaveBeenCalledTimes(1)
    expect(botao(CSV).disabled).toBe(true)
    expect(botao(JSON_).disabled).toBe(true)
    expect(aoFechar).not.toHaveBeenCalled()

    await act(async () => concluir())
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  it('entrega que termina depois de o diálogo fechar não fecha outro diálogo', async () => {
    aparelho(IPHONE)
    let concluir: () => void = () => undefined
    compartilhamento(true, () => new Promise<void>((resolver) => {
      concluir = resolver
    }))
    const { unmount } = render(<ExportarClientes aoFechar={aoFechar} />)
    fireEvent.click(botao(CSV))

    unmount()
    await act(async () => concluir())

    expect(aoFechar).not.toHaveBeenCalled()
  })
})

describe('ExportarClientes — fechar', () => {
  it('o X, o botão do rodapé e o Esc do diálogo fecham', () => {
    render(<ExportarClientes aoFechar={aoFechar} />)
    const [x, rodape] = screen.getAllByRole('button', { name: 'Fechar' })

    fireEvent.click(x)
    fireEvent.click(rodape)
    act(() => (document.querySelector('dialog') as HTMLDialogElement).close())

    expect(aoFechar).toHaveBeenCalledTimes(3)
    expect(entregas).toEqual([])
  })
})
