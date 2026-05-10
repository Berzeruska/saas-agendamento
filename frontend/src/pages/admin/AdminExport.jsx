import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminAPI } from '../../services/api'
import './Admin.css'

export default function AdminExport() {
  const navigate = useNavigate()
  const [exportando, setExportando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')

  async function exportarCSV() {
    setExportando(true)
    setErro('')
    setSucesso(false)
    try {
      const { data } = await adminAPI.exportCSV()
      // Cria um link temporário para download do ZIP
      const url = URL.createObjectURL(new Blob([data], { type: 'application/zip' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `backup_${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      a.remove()
      setSucesso(true)
    } catch (err) {
      setErro(err.message)
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="pagina admin-pagina">
      <header className="pagina-titulo">
        <button className="auth-voltar" onClick={() => navigate('/admin')}>← Painel</button>
        <h2>Exportar Dados</h2>
      </header>

      <div className="stack animar-entrada">
        <div className="card">
          <p className="admin-secao-label">BACKUP COMPLETO (CSV)</p>
          <p style={{ color: 'var(--cor-texto-fraco)', fontSize: '0.9rem', marginTop: 'var(--espaco-sm)', marginBottom: 'var(--espaco-lg)' }}>
            Baixa um arquivo ZIP com 4 planilhas CSV:
          </p>
          <div className="stack" style={{ marginBottom: 'var(--espaco-lg)' }}>
            {[
              { icon: '👥', label: 'clientes.csv',      desc: 'Nome, telefone, email, data de cadastro' },
              { icon: '📅', label: 'agendamentos.csv',   desc: 'Data, hora, serviço, cliente, status, notas' },
              { icon: '💰', label: 'financeiro.csv',     desc: 'Pedidos, valores, métodos de pagamento' },
              { icon: '📦', label: 'estoque.csv',        desc: 'Produtos, preços, quantidades' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', gap: 'var(--espaco-md)', alignItems: 'center', padding: 'var(--espaco-sm)' }}>
                <span style={{ fontSize: '1.4rem' }}>{item.icon}</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.label}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--cor-texto-fraco)' }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {sucesso && <div className="alerta alerta-sucesso" style={{ marginBottom: 'var(--espaco-md)' }}>✓ Download iniciado!</div>}
          {erro && <div className="alerta alerta-erro" style={{ marginBottom: 'var(--espaco-md)' }}>{erro}</div>}

          <button className="btn btn-primario" onClick={exportarCSV} disabled={exportando}>
            {exportando ? <><div className="spinner" /> Gerando arquivo...</> : '💾 Baixar backup ZIP'}
          </button>
        </div>

        <div className="card" style={{ background: 'color-mix(in srgb, var(--cor-aviso) 5%, var(--cor-fundo-card))' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--cor-aviso)' }}>
            ⚠️ Os arquivos CSV contém dados dos seus clientes. Guarde com segurança e não compartilhe com terceiros.
          </p>
        </div>
      </div>
    </div>
  )
}
