import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { PwaPrompt } from '@/components/pwa/PwaPrompt'
import { ClientesPage } from '@/pages/ClientesPage'
import { FinanceiroPage } from '@/pages/FinanceiroPage'
import { RotasPage } from '@/pages/RotasPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/clientes" replace />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/rotas" element={<RotasPage />} />
          <Route path="/financeiro" element={<FinanceiroPage />} />
          <Route path="*" element={<Navigate to="/clientes" replace />} />
        </Route>
      </Routes>
      <PwaPrompt />
    </BrowserRouter>
  )
}
