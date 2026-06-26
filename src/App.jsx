import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

/* ─── Helpers ─────────────────────────────────────────── */
const toDate = (str) => str ? new Date(str + 'T00:00:00') : null

const fmt = (d) => {
  if (!d) return ''
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const fmtISO = (d) => {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

const isSameDay = (a, b) => {
  if (!a || !b) return false
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

const today = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
const yesterday = () => {
  const d = today()
  d.setDate(d.getDate() - 1)
  return d
}

// KEY LOGIC: ciclo pertenece a la fecha de INICIO (date_start)
const cycleDate = (cycle) => toDate(cycle.date_start)

const numId = (cycles) => {
  const max = cycles.reduce((acc, c) => Math.max(acc, c.num_id || 0), 4400)
  return max + 1
}

/* ─── Map DB row → app object ─────────────────────────── */
const fromDB = (row) => ({
  id:        row.id,
  numId:     row.num_id,
  dateStart: row.date_start,
  dateEnd:   row.date_end,
  amountIn:  parseFloat(row.amount_in),
  amountOut: parseFloat(row.amount_out),
  tasa:      parseFloat(row.tasa),
  profit:    parseFloat(row.profit),
  pct:       parseFloat(row.pct),
  status:    row.status,
})

const toDB = (cycle) => ({
  id:         cycle.id,
  num_id:     cycle.numId,
  date_start: cycle.dateStart,
  date_end:   cycle.dateEnd,
  amount_in:  cycle.amountIn,
  amount_out: cycle.amountOut,
  tasa:       cycle.tasa,
  profit:     cycle.profit,
  pct:        cycle.pct,
  status:     cycle.status,
})

/* ─── Main App ─────────────────────────────────────────── */
export default function App() {
  const [cycles, setCycles]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editCycle, setEditCycle] = useState(null)
  const [ctxMenu, setCtxMenu]   = useState(null)
  const ctxRef = useRef(null)

  /* ─── Load from Supabase ─────────────────────────────── */
  useEffect(() => {
    fetchCycles()
  }, [])

  const fetchCycles = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('cycles')
      .select('*')
      .order('date_start', { ascending: false })

    if (error) {
      console.error('Error cargando ciclos:', error)
    } else {
      setCycles((data || []).map(fromDB))
    }
    setLoading(false)
  }

  // Close ctx menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* ─── Computed stats ── KEY: usa cycleDate(c) = dateStart ─ */
  const todayCycles     = cycles.filter(c => isSameDay(cycleDate(c), today()))
  const yesterdayCycles = cycles.filter(c => isSameDay(cycleDate(c), yesterday()))

  const sum = (arr) => arr.reduce((a, c) => a + (c.profit || 0), 0)

  const gananciaTodayUSDT = sum(todayCycles)

  const gananciaWeek = (() => {
    const d = today()
    const dayOfWeek = d.getDay() // 0=Domingo, 1=Lunes, ..., 6=Sábado
    const sunday = new Date(d)
    sunday.setDate(d.getDate() - dayOfWeek)
    sunday.setHours(0, 0, 0, 0)
    return sum(cycles.filter(c => cycleDate(c) >= sunday))
  })()

  const gananciaMes = (() => {
    const m = today().getMonth()
    const y = today().getFullYear()
    return sum(cycles.filter(c => {
      const d = cycleDate(c)
      return d && d.getMonth() === m && d.getFullYear() === y
    }))
  })()

  const volDiario = todayCycles.reduce((a, c) => a + (c.amountIn || 0), 0)
  const tasa      = cycles.length ? cycles[0].tasa : 19.75
  const tasaBs    = (gananciaTodayUSDT * tasa).toFixed(2)

  /* ─── Filtered cycles for table ─────────────────────── */
  const filteredCycles = (() => {
    if (activeTab === 'hoy')   return todayCycles
    if (activeTab === 'ayer')  return yesterdayCycles
    if (activeTab === 'semana') {
      const d = today()
      const dayOfWeek = d.getDay() // 0=Domingo, 1=Lunes, ..., 6=Sábado
      const sunday = new Date(d)
      sunday.setDate(d.getDate() - dayOfWeek)
      sunday.setHours(0, 0, 0, 0)
      return cycles.filter(c => cycleDate(c) >= sunday)
    }
    return [...cycles].sort((a, b) => new Date(b.dateStart) - new Date(a.dateStart))
  })()

  /* ─── Group by date ─────────────────────────────────── */
  const groupedCycles = (() => {
    const groups = {}
    filteredCycles.forEach(c => {
      const key = c.dateStart
      if (!groups[key]) groups[key] = []
      groups[key].push(c)
    })
    return Object.entries(groups).sort((a, b) => new Date(b[0]) - new Date(a[0]))
  })()

  /* ─── CRUD Actions ───────────────────────────────────── */
  const handleSave = async (data) => {
    if (editCycle) {
      const updated = { ...editCycle, ...data }
      const { error } = await supabase
        .from('cycles')
        .update(toDB(updated))
        .eq('id', editCycle.id)
      if (error) { console.error(error); return }
      setCycles(prev => prev.map(c => c.id === editCycle.id ? updated : c))
    } else {
      const newCycle = {
        id:    `cyc-${Date.now()}`,
        numId: numId(cycles),
        ...data,
      }
      const { error } = await supabase
        .from('cycles')
        .insert([toDB(newCycle)])
      if (error) { console.error(error); return }
      setCycles(prev => [newCycle, ...prev])
    }
    setShowModal(false)
    setEditCycle(null)
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('cycles').delete().eq('id', id)
    if (error) { console.error(error); return }
    setCycles(prev => prev.filter(c => c.id !== id))
    setCtxMenu(null)
  }

  const handleMoveTo = async (id, dateISO) => {
    const { error } = await supabase
      .from('cycles')
      .update({ date_start: dateISO })
      .eq('id', id)
    if (error) { console.error(error); return }
    setCycles(prev => prev.map(c => c.id === id ? { ...c, dateStart: dateISO } : c))
    setCtxMenu(null)
  }

  const handleChangeStatus = async (id, newStatus) => {
    const { error } = await supabase
      .from('cycles')
      .update({ status: newStatus })
      .eq('id', id)
    if (error) { console.error(error); return }
    setCycles(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c))
    setCtxMenu(null)
  }

  const openEdit = (cycle) => {
    setEditCycle(cycle)
    setShowModal(true)
    setCtxMenu(null)
  }

  const onRowRightClick = (e, cycle) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, cycle })
  }

  const nowStr = new Date().toLocaleDateString('es-VE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div className="app">
      {/* ─── TopNav ─── */}
      <nav className="topnav">
        <div className="topnav-brand">
          <div className="brand-icon">₿</div>
          ArbiTrack
          <span className="sub">P2P dashboard</span>
        </div>
        <div className="topnav-right">
          <div className="nav-date">📅 {nowStr}</div>
          <div className="nav-badge">
            <span className="dot-live" />
            En vivo
          </div>
        </div>
      </nav>

      <div className="main">
        {/* ─── Sidebar ─── */}
        <aside className="sidebar">
          <div className="ganancia-card">
            <div className="ganancia-label">Ganancia Hoy</div>
            <div className={`ganancia-amount ${gananciaTodayUSDT < 0 ? 'negative' : ''}`}>
              {loading ? '...' : `${gananciaTodayUSDT >= 0 ? '+' : ''}${gananciaTodayUSDT.toFixed(2)}`}
            </div>
            <div className="ganancia-bs">
              ≈ Bs.S {loading ? '...' : Number(tasaBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </div>

            <div className="action-buttons">
              <button className="action-btn" onClick={fetchCycles} title="Sincronizar">
                <span className="icon">🔄</span>
                Sincronizar
              </button>
              <button className="action-btn active" title="Soporte">
                <span className="icon">🎧</span>
                Soporte
              </button>
              <button className="action-btn" title="Rendimiento">
                <span className="icon">📊</span>
                Rendimiento
              </button>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-header"><span className="stat-icon">🔁</span> Ciclos Hoy</div>
              <div className="stat-value">{loading ? '-' : todayCycles.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-header"><span className="stat-icon">📅</span> Semana</div>
              <div className="stat-value green">
                {loading ? '-' : `${gananciaWeek >= 0 ? '+' : ''}${gananciaWeek.toFixed(2)}`}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-header"><span className="stat-icon">🗓️</span> Mes Actual</div>
              <div className="stat-value green">
                {loading ? '-' : `${gananciaMes >= 0 ? '+' : ''}${gananciaMes.toFixed(2)}`}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-header"><span className="stat-icon">📈</span> Vol. Diario</div>
              <div className="stat-value yellow">
                {loading ? '-' : `${(volDiario / 1_000_000).toFixed(2)}M`} <small>Bs</small>
              </div>
            </div>
          </div>

          <div className="tasa-card">
            <div>
              <div className="tasa-label">Tasa USDT/Bs</div>
              <div className="tasa-value">{tasa?.toFixed(4)}</div>
            </div>
            <span className="tasa-badge">USDT</span>
          </div>

          <div style={{ padding: '4px 0' }}>
            <span className="info-pill">
              ⚠️ Ciclos contabilizan por fecha de <b>inicio</b>
            </span>
          </div>
        </aside>

        {/* ─── Panel ─── */}
        <main className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">⚡ Ciclos P2P</div>
              <div className="panel-subtitle">
                {loading ? 'Cargando...' : `${cycles.length} ciclos · Clic derecho para opciones`}
              </div>
            </div>
            <button className="btn-add" onClick={() => { setEditCycle(null); setShowModal(true) }}>
              + Nuevo Ciclo
            </button>
          </div>

          <div className="summary-bar">
            <div className="summary-item">
              <div className="summary-item-label">🟢 Hoy</div>
              <div className="summary-item-val green">
                {gananciaTodayUSDT >= 0 ? '+' : ''}{gananciaTodayUSDT.toFixed(2)} USDT
              </div>
            </div>
            <div className="summary-item">
              <div className="summary-item-label">🟡 Ayer</div>
              <div className="summary-item-val" style={{ color: 'var(--yellow)' }}>
                {sum(yesterdayCycles) >= 0 ? '+' : ''}{sum(yesterdayCycles).toFixed(2)} USDT
              </div>
            </div>
            <div className="summary-item">
              <div className="summary-item-label">📊 Semana</div>
              <div className="summary-item-val green">+{gananciaWeek.toFixed(2)} USDT</div>
            </div>
            <div className="summary-item">
              <div className="summary-item-label">💵 Vol. Diario</div>
              <div className="summary-item-val usdt">
                {volDiario > 0
                  ? (volDiario / 1_000_000).toFixed(2) + 'M'
                  : '0.00M'
                } Bs
              </div>
            </div>
          </div>

          <div className="date-tabs">
            {[
              { key: 'all',    label: 'Todos',        count: cycles.length },
              { key: 'hoy',   label: 'Hoy',          count: todayCycles.length },
              { key: 'ayer',  label: 'Ayer',         count: yesterdayCycles.length },
              { key: 'semana', label: 'Esta semana',  count: null },
            ].map(t => (
              <button
                key={t.key}
                className={`date-tab ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
                {t.count !== null && <span className="tab-count">{t.count}</span>}
              </button>
            ))}
          </div>

          <div className="cycles-container">
            <div className="cycles-table-header">
              <span>#</span>
              <span>Inicio</span>
              <span>Fin</span>
              <span>Entrada (Bs)</span>
              <span>Salida (Bs)</span>
              <span>Tasa</span>
              <span>Ganancia</span>
              <span>Estado</span>
            </div>

            <div className="cycles-list">
              {loading && (
                <div className="empty-state">
                  <div className="empty-icon">⏳</div>
                  <p>Cargando ciclos desde Supabase...</p>
                </div>
              )}

              {!loading && groupedCycles.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <p>No hay ciclos para este período.</p>
                  <p style={{ marginTop: 6 }}>Haz clic en <b>+ Nuevo Ciclo</b> para agregar uno.</p>
                </div>
              )}

              {!loading && groupedCycles.map(([dateKey, dayCycles]) => {
                const d = toDate(dateKey)
                const isHoy  = isSameDay(d, today())
                const isAyer = isSameDay(d, yesterday())
                const label  = isHoy ? 'Hoy' : isAyer ? 'Ayer' : fmt(d)
                const sepClass = isHoy ? 'sep-hoy' : isAyer ? 'sep-ayer' : 'sep-old'

                return (
                  <div key={dateKey}>
                    <div className="date-separator">
                      {fmt(d)}
                      <span className={`sep-badge ${sepClass}`}>{label}</span>
                      <span style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 11 }}>
                        +{sum(dayCycles).toFixed(2)} USDT · {dayCycles.length} ciclo{dayCycles.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {dayCycles.map(cycle => (
                      <div
                        key={cycle.id}
                        className={`cycle-row ${isHoy ? 'today-row' : isAyer ? 'yesterday-row' : ''}`}
                        onContextMenu={(e) => onRowRightClick(e, cycle)}
                        onDoubleClick={() => openEdit(cycle)}
                        title="Clic derecho para opciones · Doble clic para editar"
                      >
                        <div className="cycle-id">
                          <span className="p2p-badge">P2P</span>
                          #{cycle.numId}
                        </div>
                        <div className="cycle-date">{fmt(toDate(cycle.dateStart))}</div>
                        <div className="cycle-date">{fmt(toDate(cycle.dateEnd))}</div>
                        <div className="cycle-amount">
                          Bs. {Number(cycle.amountIn).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="cycle-amount">
                          Bs. {Number(cycle.amountOut).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="cycle-tasa">{cycle.tasa?.toFixed(4)}</div>
                        <div className={`cycle-profit ${cycle.profit < 0 ? 'negative' : ''}`}>
                          {cycle.profit >= 0 ? '+' : ''}{cycle.profit?.toFixed(2)}
                          <span style={{ fontSize: 10, color: 'var(--text3)' }}>USDT</span>
                        </div>
                        <div>
                          <span className={`cycle-status status-${cycle.status?.toLowerCase()}`}>
                            {cycle.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </main>
      </div>

      {/* ─── Modal ─── */}
      {showModal && (
        <CycleModal
          cycle={editCycle}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditCycle(null) }}
        />
      )}

      {/* ─── Context Menu ─── */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="ctx-menu"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
        >
          <div className="ctx-item" onClick={() => openEdit(ctxMenu.cycle)}>
            ✏️ Editar ciclo
          </div>
          {ctxMenu.cycle.status !== 'COMPLETADO' && (
            <div
              className="ctx-item success"
              onClick={() => handleChangeStatus(ctxMenu.cycle.id, 'COMPLETADO')}
            >
              ✅ Marcar como COMPLETADO
            </div>
          )}
          {ctxMenu.cycle.status !== 'ACTIVO' && (
            <div
              className="ctx-item"
              onClick={() => handleChangeStatus(ctxMenu.cycle.id, 'ACTIVO')}
            >
              🔄 Marcar como ACTIVO
            </div>
          )}
          {!isSameDay(cycleDate(ctxMenu.cycle), yesterday()) && (
            <div
              className="ctx-item highlight"
              onClick={() => handleMoveTo(ctxMenu.cycle.id, fmtISO(yesterday()))}
            >
              🕐 Mover a Ayer
            </div>
          )}
          {!isSameDay(cycleDate(ctxMenu.cycle), today()) && (
            <div
              className="ctx-item"
              onClick={() => handleMoveTo(ctxMenu.cycle.id, fmtISO(today()))}
            >
              ⬆️ Mover a Hoy
            </div>
          )}
          <div className="ctx-divider" />
          <div className="ctx-item danger" onClick={() => handleDelete(ctxMenu.cycle.id)}>
            🗑️ Eliminar
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Modal Component ─────────────────────────────────── */
function CycleModal({ cycle, onSave, onClose }) {
  const todayISO     = fmtISO(today())
  const yesterdayISO = fmtISO(yesterday())

  const [form, setForm] = useState({
    dateStart: cycle?.dateStart || todayISO,
    dateEnd:   cycle?.dateEnd   || todayISO,
    amountIn:  cycle?.amountIn  || '',
    amountOut: cycle?.amountOut || '',
    tasa:      cycle?.tasa      || 19.75,
    profit:    cycle?.profit    || '',
    pct:       cycle?.pct       || '',
    status:    cycle?.status    || 'COMPLETADO',
  })

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  useEffect(() => {
    const inBs  = parseFloat(form.amountIn)  || 0
    const outBs = parseFloat(form.amountOut) || 0
    const tasa  = parseFloat(form.tasa)      || 1
    if (inBs && outBs && tasa) {
      const profitUSDT = (inBs - outBs) / tasa
      const pct = outBs > 0 ? ((inBs - outBs) / outBs) * 100 : 0
      setForm(prev => ({
        ...prev,
        profit: parseFloat(profitUSDT.toFixed(4)),
        pct:    parseFloat(pct.toFixed(4)),
      }))
    }
  }, [form.amountIn, form.amountOut, form.tasa])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      dateStart: form.dateStart,
      dateEnd:   form.dateEnd,
      amountIn:  parseFloat(form.amountIn),
      amountOut: parseFloat(form.amountOut),
      tasa:      parseFloat(form.tasa),
      profit:    parseFloat(form.profit),
      pct:       parseFloat(form.pct),
      status:    form.status,
    })
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">
          {cycle ? '✏️ Editar Ciclo' : '⚡ Nuevo Ciclo P2P'}
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fecha Inicio *</label>
              <input id="dateStart" className="form-input" type="date"
                value={form.dateStart}
                onChange={e => set('dateStart', e.target.value)} required />
              <div className="form-hint">💡 La ganancia se contabiliza aquí</div>
            </div>
            <div className="form-group">
              <label className="form-label">Fecha Fin</label>
              <input id="dateEnd" className="form-input" type="date"
                value={form.dateEnd}
                onChange={e => set('dateEnd', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Atajo de fecha de inicio:</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btn-cancel"
                style={{ flex: 1, fontSize: 12, padding: '7px' }}
                onClick={() => set('dateStart', yesterdayISO)}>
                🕐 Ayer ({fmt(yesterday())})
              </button>
              <button type="button" className="btn-cancel"
                style={{ flex: 1, fontSize: 12, padding: '7px' }}
                onClick={() => set('dateStart', todayISO)}>
                📅 Hoy ({fmt(today())})
              </button>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Monto Entrada (Bs)</label>
              <input id="amountIn" className="form-input" type="number" step="0.01"
                placeholder="4,209,401.49" value={form.amountIn}
                onChange={e => set('amountIn', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Monto Salida (Bs)</label>
              <input id="amountOut" className="form-input" type="number" step="0.01"
                placeholder="4,197,238.54" value={form.amountOut}
                onChange={e => set('amountOut', e.target.value)} required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tasa USDT/Bs</label>
              <input id="tasa" className="form-input" type="number" step="0.0001"
                value={form.tasa} onChange={e => set('tasa', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select id="status" className="form-input" value={form.status}
                onChange={e => set('status', e.target.value)}>
                <option value="COMPLETADO">COMPLETADO</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="ACTIVO">ACTIVO</option>
              </select>
            </div>
          </div>

          {form.profit !== '' && (
            <div style={{
              background: 'var(--green-bg)', border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 8, padding: '10px 14px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>Ganancia calculada:</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>
                +{parseFloat(form.profit).toFixed(2)} USDT
                <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 6 }}>
                  ({parseFloat(form.pct).toFixed(2)}%)
                </span>
              </span>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-save">
              {cycle ? '💾 Guardar cambios' : '⚡ Registrar Ciclo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
