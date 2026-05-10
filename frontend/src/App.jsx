import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { CartProvider } from './contexts/CartContext'
import { ClienteGuard, AdminGuard } from './components/guards/RouteGuard'
import { config } from './config/index.js'

import Welcome    from './pages/Welcome'
import Login      from './pages/Login'
import Register   from './pages/Register'
import ClientHome from './pages/ClientHome'
import Booking    from './pages/Booking'
import Briefing   from './pages/Briefing'
import Products   from './pages/Products'
import Payment    from './pages/Payment'
import History    from './pages/History'

import AdminLogin      from './pages/admin/AdminLogin'
import AdminDashboard  from './pages/admin/AdminDashboard'
import AdminSchedule   from './pages/admin/AdminSchedule'
import AdminClients    from './pages/admin/AdminClients'
import AdminStock      from './pages/admin/AdminStock'
import AdminFinancial  from './pages/admin/AdminFinancial'
import AdminServices   from './pages/admin/AdminServices'
import AdminExport     from './pages/admin/AdminExport'
import AdminBriefings  from './pages/admin/AdminBriefings'

export default function App() {
  const isBriefingMode = config.camposExtras === 'briefing'

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Públicas */}
          <Route path="/"            element={<Welcome />} />
          <Route path="/login"       element={<Login />} />
          <Route path="/registro"    element={<Register />} />
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Cliente */}
          <Route path="/home" element={<ClienteGuard><CartProvider><ClientHome /></CartProvider></ClienteGuard>} />
          <Route path="/agendar" element={<ClienteGuard><CartProvider><Booking /></CartProvider></ClienteGuard>} />
          <Route path="/briefing" element={<ClienteGuard><Briefing /></ClienteGuard>} />
          <Route path="/produtos" element={<ClienteGuard><CartProvider><Products /></CartProvider></ClienteGuard>} />
          <Route path="/pagamento" element={<ClienteGuard><CartProvider><Payment /></CartProvider></ClienteGuard>} />
          <Route path="/historico" element={<ClienteGuard><History /></ClienteGuard>} />

          {/* Admin */}
          <Route path="/admin"                element={<AdminGuard><AdminDashboard /></AdminGuard>} />
          <Route path="/admin/agenda"         element={<AdminGuard><AdminSchedule /></AdminGuard>} />
          <Route path="/admin/clientes"       element={<AdminGuard><AdminClients /></AdminGuard>} />
          <Route path="/admin/estoque"        element={<AdminGuard><AdminStock /></AdminGuard>} />
          <Route path="/admin/financeiro"     element={<AdminGuard><AdminFinancial /></AdminGuard>} />
          <Route path="/admin/servicos"       element={<AdminGuard><AdminServices /></AdminGuard>} />
          <Route path="/admin/exportar"       element={<AdminGuard><AdminExport /></AdminGuard>} />
          {isBriefingMode && (
            <Route path="/admin/briefings" element={<AdminGuard><AdminBriefings /></AdminGuard>} />
          )}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
