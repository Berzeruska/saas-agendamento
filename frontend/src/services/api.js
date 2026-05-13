import axios from 'axios'
import { getTenantSlug } from '../config/index.js'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Injeta JWT e X-Tenant-Slug em toda requisição
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  const slug = getTenantSlug()
  if (slug) config.headers['X-Tenant-Slug'] = slug

  return config
})

// Trata erros globais: extrai mensagem do backend e converte erros técnicos
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const backendMsg = err.response?.data?.error
    if (backendMsg) return Promise.reject(new Error(backendMsg))

    // Erros de rede sem resposta do servidor
    if (!err.response) return Promise.reject(new Error('Sem conexão com o servidor. Verifique sua internet.'))

    const status = err.response.status
    if (status === 500) return Promise.reject(new Error('Algo deu errado. Tente novamente.'))
    if (status === 429) return Promise.reject(new Error('Muitas tentativas. Aguarde um momento.'))
    if (status === 401) return Promise.reject(new Error('Sessão expirada. Faça login novamente.'))
    if (status === 403) return Promise.reject(new Error('Sem permissão para esta ação.'))

    return Promise.reject(new Error(err.response?.data?.error || err.message || 'Algo deu errado.'))
  }
)

// ── Auth ──────────────────────────────────────────────────

export const authAPI = {
  register: (data)       => api.post('/api/auth/register', data),
  login: (data)          => api.post('/api/auth/login', data),
  adminLogin: (data)     => api.post('/api/auth/admin/login', data),
}

// ── Serviços ──────────────────────────────────────────────

export const servicesAPI = {
  list: ()               => api.get('/api/services'),
  create: (data)         => api.post('/api/services', data),
  update: (id, data)     => api.put(`/api/services/${id}`, data),
  remove: (id)           => api.delete(`/api/services/${id}`),
}

// ── Agendamentos ──────────────────────────────────────────

export const appointmentsAPI = {
  slots: (date)              => api.get('/api/appointments/slots', { params: { date } }),
  addSlots: (data)           => api.post('/api/appointments/slots', data),
  deleteSlot: (id)           => api.delete(`/api/appointments/slots/${id}`),
  create: (data)             => api.post('/api/appointments', data),
  adminCreate: (data)        => api.post('/api/appointments/admin', data),
  mine: ()                   => api.get('/api/appointments/mine'),
  byDay: (date)              => api.get('/api/appointments/day', { params: { date } }),
  updateStatus: (id, status) => api.put(`/api/appointments/${id}/status`, { status }),
  cancel: (id)               => api.delete(`/api/appointments/${id}`),
}

// ── Produtos ──────────────────────────────────────────────

export const productsAPI = {
  list: ()               => api.get('/api/products'),
  create: (data)         => api.post('/api/products', data),
  update: (id, data)     => api.put(`/api/products/${id}`, data),
  updateStock: (id, qty) => api.put(`/api/products/${id}/stock`, { quantidade: qty }),
  remove: (id)           => api.delete(`/api/products/${id}`),
}

// ── Pedidos ───────────────────────────────────────────────

export const ordersAPI = {
  create: (data)         => api.post('/api/orders', data),
  list: ()               => api.get('/api/orders'),
  confirm: (id)          => api.put(`/api/orders/${id}/confirm`),
}

// ── Admin ─────────────────────────────────────────────────

export const adminAPI = {
  dashboard: ()            => api.get('/api/admin/dashboard'),
  clients: ()              => api.get('/api/admin/clients'),
  clientProfile: (id)      => api.get(`/api/admin/clients/${id}/profile`),
  clientBriefings: (id)    => api.get(`/api/admin/clients/${id}/briefings`),
  updateNotes: (id, n)     => api.put(`/api/admin/clients/${id}/notes`, { notas: n }),
  toggleClient: (id)       => api.put(`/api/admin/clients/${id}/toggle`),
  exportCSV: ()            => api.get('/api/admin/export/csv', { responseType: 'blob' }),
  financeiro: (mes, ano)   => api.get('/api/admin/financeiro', { params: { mes, ano } }),
  registrarGasto: (dados)  => api.put('/api/admin/materiais/gasto', dados),
  listGastos: (mes, ano)   => api.get('/api/admin/materiais/gastos', { params: { mes, ano } }),
}

// ── Briefings ─────────────────────────────────────────────

export const briefingsAPI = {
  uploadFoto: (formData)           => api.post('/api/briefings/upload-foto', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  create: (formData)               => api.post('/api/briefings', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  createJSON: (data)               => api.post('/api/briefings', data),
  mine: ()                         => api.get('/api/briefings/mine'),
  list: (status)                   => api.get('/api/briefings', { params: status ? { status } : {} }),
  confirmar: (id, data)            => api.put(`/api/briefings/${id}/proposta`, data),
  reagendar: (id, data)            => api.put(`/api/briefings/${id}/reagendar`, data),
  cancelar: (id)                   => api.delete(`/api/briefings/${id}`),
  concluir: (id)                   => api.put(`/api/briefings/${id}/concluir`),
  historico: ()                    => api.get('/api/briefings/historico'),
  agendaDia: (date)                => api.get('/api/briefings/agenda', { params: { date } }),
  agendaMes: (mes, ano)            => api.get('/api/briefings/agenda/mes', { params: { mes, ano } }),
  responderProposta: (id, aceitar) => api.put(`/api/briefings/${id}/resposta`, { aceitar }),
  registrarValor:    (id, valor)   => api.put(`/api/briefings/${id}/valor`, { valor }),
  confirmarPagamento:(id)          => api.put(`/api/briefings/${id}/pagamento`),
}
