import { useState, useRef, useEffect } from 'react'

export default function HelpBox({ texto }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!aberto) return
    function onClique(e) {
      if (ref.current && !ref.current.contains(e.target)) setAberto(false)
    }
    document.addEventListener('mousedown', onClique)
    return () => document.removeEventListener('mousedown', onClique)
  }, [aberto])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      <button
        onClick={() => setAberto(v => !v)}
        style={{
          width: 22, height: 22,
          borderRadius: '50%',
          border: '1px solid color-mix(in srgb, var(--cor-acento) 45%, transparent)',
          background: aberto
            ? 'color-mix(in srgb, var(--cor-acento) 20%, transparent)'
            : 'color-mix(in srgb, var(--cor-acento) 8%, transparent)',
          color: 'var(--cor-acento)',
          fontSize: '0.68rem',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="Ajuda"
      >
        ?
      </button>

      {aberto && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: 270,
          background: 'color-mix(in srgb, var(--cor-acento) 12%, var(--cor-fundo-card))',
          border: '1px solid color-mix(in srgb, var(--cor-acento) 35%, transparent)',
          borderRadius: 8,
          padding: '12px 14px',
          zIndex: 600,
          boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <p style={{ fontSize: '0.82rem', lineHeight: 1.55, color: 'var(--cor-texto)', flex: 1 }}>
              {texto}
            </p>
            <button
              onClick={() => setAberto(false)}
              style={{
                background: 'none', border: 'none',
                color: 'var(--cor-texto-fraco)', cursor: 'pointer',
                fontSize: '0.85rem', padding: 0, flexShrink: 0, lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
