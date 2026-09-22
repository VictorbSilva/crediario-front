import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { SetupError } from './components/SetupError'

const elementoRaiz = document.getElementById('root')

if (!elementoRaiz) {
  throw new Error('Elemento #root não encontrado no index.html.')
}

const root = createRoot(elementoRaiz)

try {
  const { default: App } = await import('./App')
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (erro: unknown) {
  console.error(erro)
  root.render(
    <StrictMode>
      <SetupError erro={erro} />
    </StrictMode>,
  )
}
