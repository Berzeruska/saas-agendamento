const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export const DEFAULT_CONFIG = {
  nome: 'Sistema de Agendamento',
  tagline: '',
  icone: '📅',
  slug: null,
  cores: {
    acento:       '#6366f1',
    acentoClaro:  '#818cf8',
    acentoEscuro: '#4338ca',
    sombraAcento: 'rgba(99,102,241,0.25)',
    bgAcento:     'rgba(99,102,241,0.04)',
  },
  termos: {
    servico:           'serviço',
    Servico:           'Serviço',
    servicos:          'serviços',
    Servicos:          'Serviços',
    agendar:           'Agendar',
    notas_placeholder: 'Observações (opcional)',
    notas_label:       'Observações',
    historico_titulo:  'Meu histórico',
    home_titulo:       'Bem-vindo',
    home_subtitulo:    'O que deseja fazer?',
    servicos_exemplo:  'tipo, categoria...',
  },
  camposExtras: false,
  duracaoPadrao: 30,
  horariosFuncionamento: { inicio: '09:00', fim: '18:00', intervalos: 30 },
}

// Config reativa — começa com o padrão e é sobrescrita pelo carregamento
export const config = { ...DEFAULT_CONFIG }

export function getTenantSlug() {
  // Env var tem prioridade — funciona em dev e em produção (Vercel, etc.)
  if (import.meta.env.VITE_TENANT_SLUG) return import.meta.env.VITE_TENANT_SLUG

  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return new URLSearchParams(window.location.search).get('tenant') || null
  }
  // Fallback: extrai slug do subdomínio (ex: meutenant.meudominio.com)
  const parts = hostname.split('.')
  return parts.length >= 3 ? parts[0] : null
}

export async function loadTenantConfig() {
  const slug = getTenantSlug()
  const headers = { 'Content-Type': 'application/json' }
  if (slug) headers['X-Tenant-Slug'] = slug

  try {
    const res = await fetch(`${API_URL}/api/tenant/config`, { headers })
    if (!res.ok) return
    const data = await res.json()
    // Merge profundo: mantém fallback para campos ausentes
    Object.assign(config, data)
    if (data.cores) Object.assign(config.cores, data.cores)
    if (data.termos) Object.assign(config.termos, data.termos)
    if (data.horariosFuncionamento) Object.assign(config.horariosFuncionamento, data.horariosFuncionamento)
  } catch {
    // API indisponível — mantém config padrão
  }
}

export function applyTheme() {
  const root = document.documentElement
  const { cores } = config
  root.style.setProperty('--cor-acento',        cores.acento)
  root.style.setProperty('--cor-acento-claro',  cores.acentoClaro)
  root.style.setProperty('--cor-acento-escuro', cores.acentoEscuro)
  root.style.setProperty('--sombra-acento',     cores.sombraAcento)
  root.style.setProperty('--bg-acento',         cores.bgAcento)
  document.title = config.nome
}
