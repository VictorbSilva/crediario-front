import { afterEach, describe, expect, it, vi } from 'vitest'

const CHAVE = 'crediario:dispositivo'

// O módulo guarda o id em memória; cada teste carrega uma cópia nova.
async function carregar() {
  vi.resetModules()
  return (await import('./dispositivo')).identificarDispositivo
}

function armazenamento(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial))
  const falso = {
    getItem: vi.fn((chave: string) => dados.get(chave) ?? null),
    setItem: vi.fn((chave: string, valor: string) => {
      dados.set(chave, valor)
    }),
  }
  vi.stubGlobal('localStorage', falso)
  return falso
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('identificarDispositivo', () => {
  it('devolve 8 caracteres hexadecimais, dentro do limite de atualizadoPor', async () => {
    const identificarDispositivo = await carregar()
    const id = identificarDispositivo()

    expect(id).toMatch(/^[0-9a-f]{8}$/)
    expect(id.length).toBeLessThanOrEqual(64)
  })

  it('byte pequeno vira dois dígitos: o id tem sempre 8 caracteres', async () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((bytes) => {
      ;(bytes as Uint8Array).set([0, 1, 15, 255])
      return bytes
    })
    armazenamento()
    const identificarDispositivo = await carregar()

    expect(identificarDispositivo()).toBe('00010fff')
  })

  it('o id guardado neste aparelho vale para sempre', async () => {
    armazenamento({ [CHAVE]: 'abcd1234' })
    const identificarDispositivo = await carregar()

    expect(identificarDispositivo()).toBe('abcd1234')
  })

  it('o id sorteado fica guardado, para a próxima abertura do app', async () => {
    const falso = armazenamento()
    const identificarDispositivo = await carregar()

    const id = identificarDispositivo()

    expect(falso.setItem).toHaveBeenCalledWith(CHAVE, id)
    const deNovo = await carregar()
    expect(deNovo()).toBe(id)
  })

  it('sem localStorage (aba anônima, bloqueio), devolve sempre o mesmo id nesta sessão', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('SecurityError')
      },
    })
    const identificarDispositivo = await carregar()

    const id = identificarDispositivo()
    expect(id).toMatch(/^[0-9a-f]{8}$/)
    expect(identificarDispositivo()).toBe(id)
  })
})
