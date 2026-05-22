import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import styles from './Header.module.css'

export default function Header({ user }) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/auth') }

  return (
    <header className={styles.header}>
      <span className={styles.logo}>🎡 Roxstar</span>
      <div className={styles.coinBadge}>
        <span>🪙</span>
        <span className={styles.coinAmt}>{user?.coins?.toLocaleString() ?? 0}</span>
        <span className={styles.coinLabel}>coins</span>
      </div>
      <div className={styles.right}>
        {user?.role === 'admin' && <span className={styles.adminBadge}>👑 Admin</span>}
        <span className={styles.username}>@{user?.username}</span>
        <button className={styles.exitBtn} onClick={handleLogout}>Exit 🚪</button>
      </div>
    </header>
  )
}
