// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toBlob } from 'html-to-image'
import type { EntradaDocumentoDaVenda } from '@/lib/carne'
import type { ParcelaComEstado } from '@/lib/parcelas'
import { DocumentoDaVenda } from './DocumentoDaVenda'

vi.mock('html-to-image', () => ({ toBlob: vi.fn() }))

const DADOS: Omit<EntradaDocumentoDaVenda, 'loja'> = {
  cliente: { numero: 12, nome: 'Ana', cpf: '123.456.789-00', telefone: '11988888888', endereco: 'Rua A' },
  venda: { dataVenda: '2026-10-01', valorTotalCentavos: 10001, numeroParcelas: 2, valorParcelaCentavos: 5000,
    itens: [{ quantidade: 1, descricao: 'Panela', valorUnitarioCentavos: 10001 }] },
  parcelas: [1, 2].map((numero) => ({ parcela: { numero, vencimento: `2026-${10 + numero}-10`, valorCentavos: numero === 1 ? 5000 : 5001 } } as ParcelaComEstado)),
}
const png = () => new Blob(['png'], { type: 'image/png' })
const preparar = async () => { await act(async () => { await Promise.resolve() }) }
let compartilhar: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.stubEnv('VITE_LOJA_NOME', 'Loja de treino')
  vi.stubEnv('VITE_LOJA_CNPJ', '')
  vi.stubEnv('VITE_LOJA_TELEFONE', '')
  vi.mocked(toBlob).mockReset().mockResolvedValue(png())
  vi.spyOn(window, 'print').mockImplementation(() => undefined)
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone')
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue('iPhone')
  compartilhar = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'canShare', { value: vi.fn(() => true), configurable: true })
  Object.defineProperty(navigator, 'share', { value: compartilhar, configurable: true })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  Reflect.deleteProperty(navigator, 'canShare')
  Reflect.deleteProperty(navigator, 'share')
})

describe('DocumentoDaVenda', () => {
  it('abre fora do root, apresenta a venda completa e imprime sem os botões', async () => {
    const fechar = vi.fn()
    const { container } = render(<DocumentoDaVenda dados={DADOS} aoFechar={fechar} />)
    await preparar()
    const camada = screen.getByRole('dialog', { name: 'Comprovante de venda' })
    expect(container.contains(camada)).toBe(false)
    expect(camada.parentElement).toBe(document.body)
    expect(camada.className).toContain('fixed')
    expect(camada.className).toContain('overflow-y-auto')
    const artigo = within(camada).getByRole('article')
    expect(artigo.textContent).toContain('Loja de treino')
    expect(artigo.textContent).toContain('#12 · Ana')
    expect(artigo.textContent).toContain('CPF: 123.456.789-00')
    expect(artigo.textContent).toContain('Contato: 11988888888')
    expect(artigo.textContent).toContain('Rua A')
    expect(artigo.textContent).toContain('Data da venda: 01/10/2026')
    expect(within(artigo).getAllByRole('table')).toHaveLength(2)
    expect(artigo.textContent).toContain('2/210/12/2026R$\u00a050,01')
    expect(artigo.textContent).toContain('Declaro que comprei os itens acima e estou ciente dos vencimentos.')
    expect(within(artigo).getByText('Assinatura do cliente')).toBeTruthy()
    expect(within(artigo).getByText('Data: ___/___/______')).toBeTruthy()
    expect(within(artigo).queryByRole('button')).toBeNull()
    expect(screen.queryByText(/^CNPJ:/)).toBeNull()
    expect(screen.queryByText(/^Telefone:/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir' }))
    expect(window.print).toHaveBeenCalledOnce()
    for (const botao of within(camada).getAllByRole('button')) expect(botao.closest('.print\\:hidden')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(fechar).toHaveBeenCalledOnce()
  })

  it('prepara o PNG antes do toque e chama share na mesma volta do clique', async () => {
    let concluir!: (blob: Blob) => void
    vi.mocked(toBlob).mockReturnValueOnce(new Promise((resolve) => { concluir = resolve }))
    render(<DocumentoDaVenda dados={DADOS} aoFechar={vi.fn()} />)
    const botao = screen.getByRole('button', { name: 'Compartilhar imagem' }) as HTMLButtonElement
    expect(botao.disabled).toBe(true)
    fireEvent.click(botao)
    expect(compartilhar).not.toHaveBeenCalled()
    expect(toBlob).toHaveBeenCalledExactlyOnceWith(screen.getByRole('article'), { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true })
    await act(async () => { concluir(png()) })
    expect(botao.disabled).toBe(false)
    fireEvent.click(botao)
    expect(compartilhar).toHaveBeenCalledOnce()
    const arquivo = compartilhar.mock.calls[0][0].files[0]
    expect(arquivo).toBeInstanceOf(File)
    expect(arquivo.name).toBe('venda-12-2026-10-01.png')
    expect(arquivo.type).toBe('image/png')
    expect(arquivo.size).toBe(png().size)
    await preparar()
  })

  it('espera a venda e todas as parcelas, sem gerar nem compartilhar uma tabela parcial', async () => {
    const { rerender } = render(<DocumentoDaVenda dados={null} aoFechar={vi.fn()} />)
    expect(screen.getByText('Carregando os vencimentos…')).toBeTruthy()
    expect(toBlob).not.toHaveBeenCalled()
    rerender(<DocumentoDaVenda dados={{ ...DADOS, parcelas: DADOS.parcelas.slice(0, 1) }} aoFechar={vi.fn()} />)
    expect(screen.getByText('Carregando os vencimentos…')).toBeTruthy()
    expect(screen.queryByRole('table', { name: 'Vencimentos' })).toBeNull()
    expect(toBlob).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Imprimir' }) as HTMLButtonElement).disabled).toBe(true)
    rerender(<DocumentoDaVenda dados={DADOS} aoFechar={vi.fn()} />)
    await preparar()
    expect(screen.queryByText('Carregando os vencimentos…')).toBeNull()
    expect(screen.getByRole('table', { name: 'Vencimentos' })).toBeTruthy()
    expect(toBlob).toHaveBeenCalledOnce()
  })

  it('uma imagem antiga não habilita compartilhar depois que os dados mudam', async () => {
    let concluir!: (blob: Blob) => void
    const { rerender } = render(<DocumentoDaVenda dados={DADOS} aoFechar={vi.fn()} />)
    await preparar()
    vi.mocked(toBlob).mockReturnValueOnce(new Promise((resolve) => { concluir = resolve }))
    rerender(<DocumentoDaVenda dados={{ ...DADOS, cliente: { numero: 13, nome: 'Bia' } }} aoFechar={vi.fn()} />)
    expect((screen.getByRole('button', { name: 'Compartilhar imagem' }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { concluir(png()) })
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar imagem' }))
    expect(compartilhar.mock.calls[0][0].files[0].name).toBe('venda-13-2026-10-01.png')
    await preparar()
  })

  it.each(['erro', 'nulo'])('falha ao gerar PNG (%s) preserva a impressão', async (modo) => {
    if (modo === 'erro') vi.mocked(toBlob).mockRejectedValueOnce(new Error('falhou'))
    else vi.mocked(toBlob).mockResolvedValueOnce(null)
    render(<DocumentoDaVenda dados={DADOS} aoFechar={vi.fn()} />)
    await preparar()
    expect(screen.getByText('Não deu para gerar a imagem. Use a impressão ou tire um print desta tela.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Compartilhar imagem' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir' }))
    expect(window.print).toHaveBeenCalledOnce()
  })

  it('venda antiga tem só total e vencimentos; loja sem nome mostra CNPJ e telefone', async () => {
    vi.stubEnv('VITE_LOJA_NOME', '')
    vi.stubEnv('VITE_LOJA_CNPJ', '12.345.678/0001-90')
    vi.stubEnv('VITE_LOJA_TELEFONE', '11999999999')
    render(<DocumentoDaVenda dados={{ ...DADOS, venda: { ...DADOS.venda, itens: undefined } }} aoFechar={vi.fn()} />)
    await preparar()
    expect(screen.getByText('CNPJ: 12.345.678/0001-90')).toBeTruthy()
    expect(screen.getByText('Telefone: 11999999999')).toBeTruthy()
    expect(screen.queryByRole('table', { name: 'Itens da venda' })).toBeNull()
    expect(screen.getByText(/Total:/).textContent).toContain('R$\u00a0100,01')
  })
})
