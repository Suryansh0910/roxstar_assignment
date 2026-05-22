import { useEffect, useState } from 'react'
import styles from './WheelControls.module.css'

const COLORS_BG = [
  '#FF3B3B22', '#2979FF22', '#FFD70022', '#00C85322',
  '#FF6D0022', '#9C27B022', '#FF408122', '#00BCD422',
]
const COLORS_BORDER = [
  '#FF3B3B', '#2979FF', '#FFD700', '#00C853',
  '#FF6D00', '#9C27B0', '#FF4081', '#00BCD4',
]

export default function WheelControls({ wheel, isParticipant, isAdmin, userId, onJoin, onManualStart }) {
  const [timeLeft, setTimeLeft] = useState(null)
  const isWaiting = wheel?.status === 'waiting'
  const isSpinning = wheel?.status === 'spinning'

  useEffect(() => {
    if (!isWaiting || !wheel?.scheduled_start_at) return
    const tick = () => {
      const diff = new Date(wheel.scheduled_start_at).getTime() - Date.now()
      setTimeLeft(Math.max(0, Math.ceil(diff / 1000)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [wheel?.scheduled_start_at, isWaiting])

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className={styles.wrapper}>
      {/* Status bar */}
      <div className={styles.statusBar}>
        <span className={`${styles.chip} ${isSpinning ? styles.chipSpin : isWaiting ? styles.chipWait : styles.chipDone}`}>
          {isSpinning ? '🔴 LIVE' : isWaiting ? '⏳ Waiting' : '✅ Done'}
        </span>
        {isWaiting && timeLeft !== null && (
          <span className={styles.timer}>
            {timeLeft > 0 ? `Auto-start in ${fmt(timeLeft)}` : 'Starting…'}
          </span>
        )}
      </div>

      {/* Prize pools */}
      <div className={styles.pools}>
        <PoolCard icon="🏆" label="Prize Pool" value={wheel?.winner_pool_amt} color={0} />
        <PoolCard icon="🎟️" label="Entry Fee" value={wheel?.entry_fee} color={1} />
        <PoolCard icon="👥" label="Players" value={wheel?.total_count ?? 0} color={2} />
      </div>

      {/* Actions */}
      {isWaiting && !isParticipant && (
        <div className={styles.joinZone}>
          <button className={styles.btnJoin} onClick={onJoin}>
            🎟️ Join Game!
          </button>
          <p className={styles.feeNote}>Entry fee: <strong>{wheel?.entry_fee} coins</strong></p>
        </div>
      )}

      {isParticipant && isWaiting && (
        <div className={styles.joinedBadge}>✅ You're in the game!</div>
      )}

      {isAdmin && isWaiting && (
        <button className={styles.btnForce} onClick={onManualStart}>
          ▶️ Force Start Now
        </button>
      )}
    </div>
  )
}

function PoolCard({ icon, label, value, color }) {
  return (
    <div className={styles.poolCard} style={{ background: COLORS_BG[color], borderTopColor: COLORS_BORDER[color] }}>
      <span className={styles.poolIcon}>{icon}</span>
      <span className={styles.poolLabel}>{label}</span>
      <span className={styles.poolValue}>{value?.toLocaleString() ?? 0}</span>
    </div>
  )
}
