// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toBlob } from 'html-to-image'
import type { EntradaRecibo } from '@/lib/carne'
import { instalarDialogo } from '@/test/dialogo'
import { ReciboDoPagamento } from './ReciboDoPagamento'

vi.mock('html-to-image', () => ({ toBlob: vi.fn() }))

const DADOS: Omit<EntradaRecibo, 'loja'> = {
  cliente: { numero: 12, nome: 'Ana' },
  venda: { dataVenda: '2026-09-01', valorTotalCentavos: 30000 },
  entrada: { data: '2026-11-01', valorCentavos: 5000, forma: 'pix' },
  abertoAntesCentavos: 15000, proximaCobranca: '2026-11-06',
}

const png = () => new Blob(['png de teste'], { type: 'image/png' })
let compartilhar: ReturnType<typeof vi.fn>
let clicarNoLink: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  instalarDialogo()
  vi.stubEnv('VITE_LOJA_NOME', 'Loja de treino')
  vi.stubEnv('VITE_LOJA_CNPJ', '')
  vi.stubEnv('VITE_LOJA_TELEFONE', '')
  vi.mocked(toBlob).mockReset().mockResolvedValue(png())
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone')
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue('iPhone')
  compartilhar = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'canShare', { value: vi.fn(() => true), configurable: true })
  Object.defineProperty(navigator, 'share', { value: compartilhar, configurable: true })
  URL.createObjectURL = vi.fn(() => 'blob:recibo')
  URL.revokeObjectURL = vi.fn()
  clicarNoLink = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  Reflect.deleteProperty(navigator, 'canShare')
  Reflect.deleteProperty(navigator, 'share')
})

async function preparar() {
  await act(async () => { await Promise.resolve() })
}

describe('ReciboDoPagamento', () => {
  it('prepara o PNG antes do toque e compartilha o File de forma síncrona no clique', async () => {
    let concluir!: (blob: Blob) => void
    vi.mocked(toBlob).mockReturnValueOnce(new Promise((resolve) => { concluir = resolve }))
    render(<ReciboDoPagamento dados={DADOS} aoFechar={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: 'Recibo de pagamento' })).toBeTruthy()
    const preparando = screen.getByRole('button', { name: 'Preparando a imagem…' }) as HTMLButtonElement
    expect(preparando.disabled).toBe(true)
    fireEvent.click(preparando)
    expect(compartilhar).not.toHaveBeenCalled()
    const cartao = screen.getByText('#12 · Ana').closest('article')
    expect(toBlob).toHaveBeenCalledExactlyOnceWith(cartao, {
      pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true,
    })
    expect(cartao?.textContent).toContain('Loja de treino')
    expect(cartao?.textContent).toContain('Restante desta venda: R$\u00a0100,00')
    expect(cartao?.textContent).toContain('Próxima cobrança: 06/11/2026')
    expect(cartao?.querySelector('button')).toBeNull()

    await act(async () => { concluir(png()) })
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar' }))
    expect(compartilhar).toHaveBeenCalledTimes(1)
    const entrega = compartilhar.mock.calls[0][0]
    expect(entrega.title).toBe('recibo-12-2026-11-01.png')
    expect(entrega.files).toHaveLength(1)
    expect(entrega.files[0]).toBeInstanceOf(File)
    expect(entrega.files[0].type).toBe('image/png')
    expect(entrega.files[0].size).toBe(png().size)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    await preparar()
  })

  it('cancelar a folha mantém o recibo e libera outro toque, sem baixar', async () => {
    compartilhar.mockRejectedValueOnce(Object.assign(new Error('cancelou'), { name: 'AbortError' }))
    render(<ReciboDoPagamento dados={DADOS} aoFechar={vi.fn()} />)
    await preparar()
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar' }))
    await preparar()
    expect(screen.getByRole('dialog', { name: 'Recibo de pagamento' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Compartilhar' }) as HTMLButtonElement).disabled).toBe(false)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('não abre duas folhas de compartilhamento enquanto a primeira está pendente', async () => {
    let concluir!: () => void
    compartilhar.mockReturnValueOnce(new Promise<void>((resolve) => { concluir = resolve }))
    render(<ReciboDoPagamento dados={DADOS} aoFechar={vi.fn()} />)
    await preparar()
    const botao = screen.getByRole('button', { name: 'Compartilhar' }) as HTMLButtonElement
    fireEvent.click(botao)
    fireEvent.click(botao)
    expect(compartilhar).toHaveBeenCalledOnce()
    expect(botao.disabled).toBe(true)
    await act(async () => { concluir() })
    expect(botao.disabled).toBe(false)
  })

  it('a imagem de um recibo fechado não habilita o compartilhamento do seguinte', async () => {
    let concluirAntigo!: (blob: Blob) => void
    let concluirNovo!: (blob: Blob) => void
    vi.mocked(toBlob)
      .mockReturnValueOnce(new Promise((resolve) => { concluirAntigo = resolve }))
      .mockReturnValueOnce(new Promise((resolve) => { concluirNovo = resolve }))
    const antigo = render(<ReciboDoPagamento dados={DADOS} aoFechar={vi.fn()} />)
    antigo.unmount()
    render(<ReciboDoPagamento dados={{ ...DADOS, cliente: { numero: 13, nome: 'Bia' } }} aoFechar={vi.fn()} />)
    await act(async () => { concluirAntigo(png()) })
    expect((screen.getByRole('button', { name: 'Preparando a imagem…' }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { concluirNovo(png()) })
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar' }))
    expect(compartilhar.mock.calls[0][0].files[0].name).toBe('recibo-13-2026-11-01.png')
    await preparar()
  })

  it('mostra CNPJ e telefone cadastrados mesmo sem nome da loja', async () => {
    vi.stubEnv('VITE_LOJA_NOME', '')
    vi.stubEnv('VITE_LOJA_CNPJ', ' CNPJ de teste ')
    vi.stubEnv('VITE_LOJA_TELEFONE', ' telefone de teste ')
    render(<ReciboDoPagamento dados={DADOS} aoFechar={vi.fn()} />)
    await preparar()
    expect(screen.getByText('CNPJ: CNPJ de teste')).toBeTruthy()
    expect(screen.getByText('Telefone: telefone de teste')).toBeTruthy()
  })

  it('no notebook o PNG baixa com seu nome', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Windows NT 10.0')
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32')
    render(<ReciboDoPagamento dados={DADOS} aoFechar={vi.fn()} />)
    await preparar()
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar' }))
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ name: 'recibo-12-2026-11-01.png' }))
    expect(clicarNoLink).toHaveBeenCalledOnce()
    expect(compartilhar).not.toHaveBeenCalled()
    await preparar()
  })

  it.each(['erro', 'nulo'])('falha de imagem (%s) mantém o recibo disponível para print', async (modo) => {
    if (modo === 'erro') vi.mocked(toBlob).mockRejectedValueOnce(new Error('falhou'))
    else vi.mocked(toBlob).mockResolvedValueOnce(null)
    render(<ReciboDoPagamento dados={DADOS} aoFechar={vi.fn()} />)
    await preparar()
    expect(screen.getByText('Não deu para gerar a imagem. Tire um print desta tela.')).toBeTruthy()
    expect(screen.getByText('#12 · Ana')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Compartilhar' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('sem dados da loja, o topo fica só com o título; Fechar encerra o recibo', async () => {
    vi.stubEnv('VITE_LOJA_NOME', '')
    const aoFechar = vi.fn()
    render(<ReciboDoPagamento dados={{ ...DADOS, proximaCobranca: undefined }} aoFechar={aoFechar} />)
    await preparar()
    expect(screen.queryByText('Loja de treino')).toBeNull()
    expect(screen.queryByText(/^CNPJ:/)).toBeNull()
    expect(screen.queryByText(/^Telefone:/)).toBeNull()
    expect(screen.queryByText(/^Próxima cobrança:/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(aoFechar).toHaveBeenCalledOnce()
  })
})
