/**
 * O jsdom tem `<dialog>`, mas não `showModal()` nem `close()`. Quatro telas do
 * app abrem diálogo pelo `ref` num efeito, e sem isto a montagem já lança.
 *
 * Só o que os componentes usam: `showModal` abre, `close` fecha e dispara o
 * evento `close` — é por ele que o React chama o `onClose` do componente.
 */
export function instalarDialogo(): void {
  const prototipo = HTMLDialogElement.prototype

  prototipo.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }

  prototipo.close = function close(this: HTMLDialogElement) {
    if (!this.open) return
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}
