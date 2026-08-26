import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { SetupError } from './components/SetupError'

const elementoRaiz = document.getElementById('root')

if (!elementoRaiz) {
  throw new Error('Elemento #root não encontrado no index.html.')
}

const root = createRoot(elementoRaiz)

import('./App')
  .then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((error: unknown) => {
    console.error(error)
    root.render(
      <StrictMode>
        <SetupError erro={error} />
      </StrictMode>,
    )
  })
