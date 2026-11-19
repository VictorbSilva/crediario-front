import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { RequireAuth } from '@/auth/RequireAuth'
import { FaixaDeTreino } from '@/components/FaixaDeTreino'
import { AppShell } from '@/components/layout/AppShell'
import { PwaPrompt } from '@/components/pwa/PwaPrompt'
import { useAcesso } from '@/data/useAcesso'
import { veFinanceiro } from '@/lib/acesso'
import { ClientePage } from '@/pages/ClientePage'
import { ClientesPage } from '@/pages/ClientesPage'
import { EquipePage } from '@/pages/EquipePage'
import { FinanceiroPage } from '@/pages/FinanceiroPage'
import { LoginPage } from '@/pages/LoginPage'
import { RotasPage } from '@/pages/RotasPage'

// Quem não vê Financeiro nem pelo menu não deve abri-lo digitando o endereço.
function GuardaDoFinanceiro() {
  return veFinanceiro(useAcesso()) ? <FinanceiroPage /> : <Navigate to="/clientes" replace />
}

// Pelo mesmo motivo, a equipe só abre para o dono, mesmo digitando o endereço.
function GuardaDaEquipe() {
  const acesso = useAcesso()
  return acesso.estado === 'liberado' && acesso.dono ? <EquipePage /> : <Navigate to="/clientes" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <FaixaDeTreino />
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/clientes" replace />} />
              <Route path="/clientes" element={<ClientesPage />} />
              <Route path="/clientes/:id" element={<ClientePage />} />
              <Route path="/rotas" element={<RotasPage />} />
              <Route path="/financeiro" element={<GuardaDoFinanceiro />} />
              <Route path="/equipe" element={<GuardaDaEquipe />} />
              <Route path="*" element={<Navigate to="/clientes" replace />} />
            </Route>
          </Route>
        </Routes>
        <PwaPrompt />
      </AuthProvider>
    </BrowserRouter>
  )
}
