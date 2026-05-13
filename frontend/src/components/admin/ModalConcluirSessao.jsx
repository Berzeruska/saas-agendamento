import { useState } from 'react'
import { createPortal } from 'react-dom'
import { productsAPI, adminAPI, briefingsAPI } from '../../services/api'

export default function ModalConcluirSessao({ briefing, produtos, onConcluir, onFechar }) {
  const [qtdUsada, setQtdUsada] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState('')

  async function pular() {
    setSalvando(true)
    setErro('')
    try {
      await briefingsAPI.concluir(briefing.id)
      onConcluir()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  async function registrar() {
    setSalvando(true)
    setErro('')
    try {
      const itens = produtos.filter(p => (qtdUsada[p.id] || 0) > 0)
      for (const prod of itens) {
        const qty     = qtdUsada[prod.id]
        const novaQtd = Math.max(0, prod.quantidade - qty)
        await productsAPI.updateStock(prod.id, novaQtd)
        await adminAPI.registrarGasto({
          valor:       qty * Number(prod.preco),
          descricao:   prod.nome,
          briefing_id: briefing.id,
        })
      }
      await briefingsAPI.concluir(briefing.id)
      onConcluir()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: 16,
      }}
      onClick={e => e.target === e.currentTarget && !salvando && onFechar()}
    >
      <div style={{
        background: 'var(--cor-fundo-card)',
        borderRadius: 20,
        width: '100%', maxWidth: 440,
        maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Cabeçalho */}
        <div style={{ padding: '24px 24px 20px' }}>
          <p style={{
            fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.28em',
            color: 'var(--cor-texto-fraco)', marginBottom: 10,
          }}>
            CONCLUIR SESSÃO
          </p>
          <p style={{
            fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.02em',
            color: 'var(--cor-acento)', lineHeight: 1.15, marginBottom: 6,
            fontFamily: 'var(--fonte-display)',
          }}>
            {briefing.clientes?.nome}
          </p>
          {(briefing.estilo || briefing.local_corpo) && (
            <p style={{ fontSize: '0.82rem', color: 'var(--cor-texto-fraco)' }}>
              {briefing.estilo || 'Tattoo'}{briefing.local_corpo ? ` · ${briefing.local_corpo}` : ''}
            </p>
          )}
        </div>

        <div style={{ height: 1, background: 'var(--cor-borda)' }} />

        {/* Lista de materiais com scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 0' }}>
          <p style={{
            fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.22em',
            color: 'var(--cor-texto-fraco)', marginBottom: 16,
          }}>
            MATERIAIS UTILIZADOS{' '}
            <span style={{ fontWeight: 400, letterSpacing: 0, fontSize: '0.7rem' }}>(opcional)</span>
          </p>

          {produtos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '12px 0 20px' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--cor-texto-fraco)', marginBottom: 4 }}>
                Nenhum material cadastrado.
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--cor-texto-fraco)' }}>
                Adicione itens em{' '}
                <span style={{ color: 'var(--cor-acento)', fontWeight: 600 }}>Materiais</span>.
              </p>
            </div>
          ) : (
            <div style={{ marginBottom: 8 }}>
              {produtos.map((prod, i) => (
                <div key={prod.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 3 }}>
                        {prod.nome}
                      </p>
                      <p style={{ fontSize: '0.68rem', color: 'var(--cor-texto-fraco)' }}>
                        Em estoque: {prod.quantidade} · R$ {Number(prod.preco).toFixed(2)}/un
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setQtdUsada(prev => ({
                          ...prev,
                          [prod.id]: Math.max(0, (prev[prod.id] || 0) - 1),
                        }))}
                        style={{
                          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                          background: 'var(--cor-fundo-input)',
                          border: '1px solid var(--cor-borda)',
                          color: 'var(--cor-texto)', fontSize: '1.2rem', lineHeight: 1,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >−</button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={qtdUsada[prod.id] ?? 0}
                        onChange={e => {
                          const raw = e.target.value.replace(/\D/g, '')
                          const v   = parseInt(raw, 10)
                          setQtdUsada(prev => ({
                            ...prev,
                            [prod.id]: isNaN(v) ? 0 : Math.min(prod.quantidade, v),
                          }))
                        }}
                        style={{
                          width: 52, height: 34, textAlign: 'center',
                          background: 'var(--cor-fundo-input)',
                          border: '1px solid var(--cor-borda)',
                          borderRadius: 8, color: 'var(--cor-texto)',
                          fontSize: '1rem', fontWeight: 700,
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setQtdUsada(prev => ({
                          ...prev,
                          [prod.id]: Math.min(prod.quantidade, (prev[prod.id] || 0) + 1),
                        }))}
                        style={{
                          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                          background: 'var(--cor-acento)',
                          border: 'none',
                          color: '#fff', fontSize: '1.2rem', lineHeight: 1,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >+</button>
                    </div>
                  </div>
                  {i < produtos.length - 1 && (
                    <div style={{ height: 1, background: 'var(--cor-borda)' }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé com botões */}
        <div style={{ padding: '16px 24px 24px', borderTop: '1px solid var(--cor-borda)' }}>
          {erro && (
            <div className="alerta alerta-erro" style={{ marginBottom: 12 }}>{erro}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {produtos.length > 0 && (
              <button
                className="btn btn-primario"
                style={{ fontSize: '0.78rem', letterSpacing: '0.12em', padding: '14px' }}
                onClick={registrar}
                disabled={salvando}
              >
                {salvando ? '...' : 'REGISTRAR USO'}
              </button>
            )}
            <button
              className="btn btn-ghost"
              style={{ fontSize: '0.78rem', letterSpacing: '0.12em', padding: '14px' }}
              onClick={pular}
              disabled={salvando}
            >
              {salvando ? '...' : 'PULAR'}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  )
}
