const CHAVE = 'crediario:dispositivo'

let emMemoria: string | null = null

function sortearId(): string {
  const bytes = new Uint8Array(4)
  const aleatorio = globalThis.crypto

  if (aleatorio && typeof aleatorio.getRandomValues === 'function') {
    aleatorio.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }

  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function ler(): string | null {
  try {
    return localStorage.getItem(CHAVE)
  } catch {
    return null
  }
}

function gravar(id: string): void {
  try {
    localStorage.setItem(CHAVE, id)
  } catch {
    emMemoria = id
  }
}

export function identificarDispositivo(): string {
  const guardado = ler()
  if (guardado) return guardado
  if (emMemoria) return emMemoria

  const novo = sortearId()
  emMemoria = novo
  gravar(novo)
  return novo
}
