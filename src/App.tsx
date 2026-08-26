import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { RequireAuth } from '@/auth/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import { PwaPrompt } from '@/components/pwa/PwaPrompt'
import { ClientesPage } from '@/pages/ClientesPage'
import { FinanceiroPage } from '@/pages/FinanceiroPage'
import { LoginPage } from '@/pages/LoginPage'
import { RotasPage } from '@/pages/RotasPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/clientes" replace />} />
              <Route path="/clientes" element={<ClientesPage />} />
              <Route path="/rotas" element={<RotasPage />} />
              <Route path="/financeiro" element={<FinanceiroPage />} />
              <Route path="*" element={<Navigate to="/clientes" replace />} />
            </Route>
          </Route>
        </Routes>
        <PwaPrompt />
      </AuthProvider>
    </BrowserRouter>
  )
}
