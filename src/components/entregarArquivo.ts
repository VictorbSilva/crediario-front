export function entregarArquivo(arquivo: File): Promise<void> {
  const noIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  if (noIOS && typeof navigator.canShare === 'function' && navigator.canShare({ files: [arquivo] })) {
    return navigator.share({ files: [arquivo], title: arquivo.name }).catch((erro) => {
      if (erro?.name !== 'AbortError' && erro?.name !== 'InvalidStateError') {
        baixarComLink(arquivo)
      }
    })
  }

  baixarComLink(arquivo)
  return Promise.resolve()
}

export function baixarComLink(arquivo: File): void {
  const endereco = URL.createObjectURL(arquivo)
  const link = document.createElement('a')

  link.href = endereco
  link.download = arquivo.name
  document.body.appendChild(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(endereco), 60_000)
}
