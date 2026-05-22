import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import styles from './AuthPage.module.css'

export default function AuthPage() {
  const [tab, setTab] = useState('login')
  const { login, register, user } = useAuth()
  const navigate = useNavigate()

  if (user) { navigate('/'); return null }

  return (
    <div className={styles.page}>
      <div className={styles.banner}>
        <div className={styles.lights} />
        <h1 className={styles.title}>🎡 ROXSTAR</h1>
        <p className={styles.subtitle}>Spin Wheel Championship</p>
        <div className={styles.lights} />
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'login' ? styles.activeTab : ''}`} onClick={() => setTab('login')}>Login</button>
        <button className={`${styles.tab} ${tab === 'register' ? styles.activeTab : ''}`} onClick={() => setTab('register')}>Sign Up</button>
      </div>

      {tab === 'login'
        ? <LoginForm onLogin={async (e, p) => { await login(e, p); navigate('/') }} />
        : <RegisterForm onRegister={async (u, e, p, k) => { await register(u, e, p, k); navigate('/') }} />
      }
    </div>
  )
}

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (ev) => {
    ev.preventDefault()
    setLoading(true)
    try {
      await onLogin(email, password)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <input className={styles.input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input className={styles.input} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
      <button className={styles.btnPrimary} type="submit" disabled={loading}>
        {loading ? '⏳ Entering...' : '🎟️ Enter the Carnival'}
      </button>
    </form>
  )
}

function RegisterForm({ onRegister }) {
  const [form, setForm] = useState({ username: '', email: '', password: '', adminKey: '' })
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (ev) => {
    ev.preventDefault()
    setLoading(true)
    try {
      await onRegister(form.username, form.email, form.password, form.adminKey)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <input className={styles.input} placeholder="Username" value={form.username} onChange={set('username')} required />
      <input className={styles.input} type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
      <input className={styles.input} type="password" placeholder="Password" value={form.password} onChange={set('password')} required />
      <input className={styles.input} placeholder="Admin Key (optional)" value={form.adminKey} onChange={set('adminKey')} />
      <button className={styles.btnPrimary} type="submit" disabled={loading}>
        {loading ? '⏳ Joining...' : '🎪 Join the Fun!'}
      </button>
    </form>
  )
}
