import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { appointmentsAPI, servicesAPI } from '../../services/api'
import { config } from '../../config/index.js'
import './Admin.css'

function proximosDias(n = 14) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

const FORM_VAZIO = { nome: '', telefone: '', servico_id: '', hora: '', notas: '' }

export default function AdminSchedule() {
  const navigate = useNavigate()
  const dias = proximosDias()
  const [dataSel, setDataSel] = useState(dias[0])
  const [ags, setAgs] = useState([])
  const [servicos, setServicos] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [novaForm, setNovaForm] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    servicesAPI.list()
      .then(({ data }) => setServicos(data))
      .catch(() => {})
  }, [])

  async function carregar(data) {
    setCarregando(true)
    try {
      const res = await appointmentsAPI.byDay(data)
      setAgs(res.data)
    } catch {
      setAgs([])
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar(dataSel) }, [dataSel])

  async function mudarStatus(id, status) {
    try {
      await appointmentsAPI.updateStatus(id, status)
      carregar(dataSel)
    } catch (err) {
      alert(err.message)
    }
  }

  async function criarSessao(e) {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    try {
      await appointmentsAPI.adminCreate({ ...form, data: dataSel })
      setNovaForm(false)
      setForm(FORM_VAZIO)
      carregar(dataSel)
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  function abrirNova() {
    setForm(FORM_VAZIO)
    setErro('')
    setNovaForm(true)
  }

  return (
    <div className="pagina admin-pagina">
      <header className="pagina-titulo">
        <button className="auth-voltar" onClick={() => navigate('/admin')}>← Painel</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Agenda</h2>
          <button
            className="btn btn-primario"
            style={{ width: 'auto', padding: '8px 16px' }}
            onClick={abrirNova}
          >
            + Nova sessão
          </button>
        </div>
      </header>

      {/* Formulário nova sessão */}
      {novaForm && (
        <form className="card stack animar-entrada" onSubmit={criarSessao} style={{ marginBottom: 'var(--espaco-lg)' }}>
          <p className="admin-secao-label">NOVA {config.termos.Servico.toUpperCase()}</p>

          <div className="grid-2">
            <div className="input-grupo">
              <label>Nome do cliente</label>
              <input
                className="input-campo"
                placeholder="Nome completo"
                value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                required
              />
            </div>
            <div className="input-grupo">
              <label>Telefone</label>
              <input
                className="input-campo"
                placeholder="+55 11 99999-9999"
                value={form.telefone}
                onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="input-grupo">
            <label>{config.termos.Servico}</label>
            <select
              className="input-campo"
              value={form.servico_id}
              onChange={e => setForm(p => ({ ...p, servico_id: e.target.value }))}
              required
            >
              <option value="">Selecione uma {config.termos.servico}...</option>
              {servicos.map(s => (
                <option key={s.id} value={s.id}>
                  {s.nome} — R$ {Number(s.preco).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div className="input-grupo">
            <label>Horário em {new Date(dataSel + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</label>
            <input
              className="input-campo"
              type="time"
              value={form.hora}
              onChange={e => setForm(p => ({ ...p, hora: e.target.value }))}
              required
            />
          </div>

          <div className="input-grupo">
            <label>Notas (opcional)</label>
            <textarea
              className="input-campo"
              rows={3}
              placeholder={config.termos.notas_placeholder}
              value={form.notas}
              onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
            />
          </div>

          {erro && <div className="alerta alerta-erro">{erro}</div>}

          <div className="grid-2">
            <button type="submit" className="btn btn-primario" disabled={salvando}>
              {salvando ? '...' : 'Salvar'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setNovaForm(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Seletor de dias */}
      <div className="booking-dias" style={{ marginBottom: 'var(--espaco-lg)' }}>
        {dias.map(d => (
          <button
            key={d}
            className={`booking-dia ${dataSel === d ? 'selecionado' : ''}`}
            onClick={() => setDataSel(d)}
          >
            <span className="booking-dia-semana">
              {new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase().replace('.', '')}
            </span>
            <span className="booking-dia-numero">{new Date(d + 'T00:00:00').getDate()}</span>
          </button>
        ))}
      </div>

      {carregando && <p className="carregando" style={{ color: 'var(--cor-texto-fraco)' }}>Carregando...</p>}

      {!carregando && (
        <div className="stack">
          {ags.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--espaco-xl)' }}>
              <p style={{ color: 'var(--cor-texto-fraco)' }}>
                Nenhuma {config.termos.servico} neste dia.
              </p>
              <button
                className="btn btn-secundario"
                style={{ marginTop: 'var(--espaco-md)', width: 'auto', padding: '10px 20px' }}
                onClick={abrirNova}
              >
                + Adicionar sessão
              </button>
            </div>
          )}

          {ags.map(ag => (
            <div key={ag.id} className="card admin-ag-detalhe">
              <div className="admin-ag-detalhe-topo">
                <span className="admin-ag-hora-grande">{ag.hora?.slice(0, 5)}</span>
                <span className={`badge badge-${ag.status}`}>{ag.status}</span>
              </div>
              <p style={{ fontWeight: 700 }}>{ag.clientes?.nome}</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--cor-texto-fraco)' }}>
                {ag.servicos?.nome} · R$ {Number(ag.servicos?.preco || 0).toFixed(2)}
              </p>
              {ag.clientes?.telefone && (
                <p style={{ fontSize: '0.8rem', color: 'var(--cor-texto-fraco)' }}>
                  📞 {ag.clientes.telefone}
                </p>
              )}
              {ag.notas && (
                <p style={{ fontSize: '0.8rem', background: 'var(--cor-fundo-input)', padding: '8px', borderRadius: 'var(--raio-sm)', whiteSpace: 'pre-line', marginTop: 'var(--espaco-sm)' }}>
                  {ag.notas}
                </p>
              )}

              {ag.status === 'pendente' && (
                <div className="grid-2" style={{ marginTop: 'var(--espaco-sm)' }}>
                  <button className="btn btn-primario" style={{ padding: '10px' }} onClick={() => mudarStatus(ag.id, 'confirmado')}>
                    Confirmar
                  </button>
                  <button className="btn btn-perigo" style={{ padding: '10px' }} onClick={() => mudarStatus(ag.id, 'cancelado')}>
                    Cancelar
                  </button>
                </div>
              )}
              {ag.status === 'confirmado' && (
                <button
                  className="btn btn-secundario"
                  style={{ marginTop: 'var(--espaco-sm)', padding: '10px' }}
                  onClick={() => mudarStatus(ag.id, 'concluido')}
                >
                  ✓ Marcar concluída
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
