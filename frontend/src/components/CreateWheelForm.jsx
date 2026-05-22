import { useState } from 'react'
import styles from './CreateWheelForm.module.css'

export default function CreateWheelForm({ onCreate }) {
  const [form, setForm] = useState({ entry_fee: 100, winner_pool_pct: 70, admin_pool_pct: 20, app_pool_pct: 10 })
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: Number(e.target.value) }))

  const total = form.winner_pool_pct + form.admin_pool_pct + form.app_pool_pct
  const invalid = Math.abs(total - 100) > 0.01

  const submit = async (e) => {
    e.preventDefault()
    if (invalid) return
    setLoading(true)
    try { await onCreate(form) } finally { setLoading(false) }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <h3 className={styles.title}>🎪 Create New Game</h3>

      <div className={styles.field}>
        <label className={styles.label}>Entry Fee (coins)</label>
        <input className={styles.input} type="number" min="10" value={form.entry_fee} onChange={set('entry_fee')} />
      </div>

      <div className={styles.pctRow}>
        <PctField label="🏆 Winner %" value={form.winner_pool_pct} onChange={set('winner_pool_pct')} />
        <PctField label="👑 Admin %" value={form.admin_pool_pct} onChange={set('admin_pool_pct')} />
        <PctField label="🏛️ App %" value={form.app_pool_pct} onChange={set('app_pool_pct')} />
      </div>

      <div className={`${styles.pctTotal} ${invalid ? styles.bad : styles.good}`}>
        Total: {total}% {invalid ? '⚠️ Must equal 100%' : '✅'}
      </div>

      <button className={styles.btn} type="submit" disabled={loading || invalid}>
        {loading ? '⏳ Creating...' : '🎡 Launch Wheel!'}
      </button>
    </form>
  )
}

function PctField({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</label>
      <input
        style={{ width: '100%', padding: '10px 12px', border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: '0.95rem', background: '#FAFAFE', color: 'var(--text)' }}
        type="number" min="0" max="100" value={value} onChange={onChange}
      />
    </div>
  )
}
