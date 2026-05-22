import styles from './PlayersList.module.css'

const AVATAR_COLORS = ['#FF3B3B','#2979FF','#FFD700','#00C853','#FF6D00','#9C27B0','#FF4081','#00BCD4']

export default function PlayersList({ participants, currentUserId }) {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>🎪 Players <span className={styles.count}>{participants.length}</span></h3>
      <div className={styles.list}>
        {participants.length === 0
          ? <p className={styles.empty}>No players yet…</p>
          : participants.map((p, i) => (
            <PlayerItem key={p.user_id} p={p} color={AVATAR_COLORS[i % AVATAR_COLORS.length]} isMe={p.user_id === currentUserId} />
          ))
        }
      </div>
    </div>
  )
}

function PlayerItem({ p, color, isMe }) {
  const eliminated = !!p.eliminated_at
  const isWinner = !!p.is_winner

  return (
    <div className={`${styles.item} ${eliminated ? styles.eliminated : ''} ${isWinner ? styles.winner : ''}`}>
      <div className={styles.info}>
        <div className={styles.avatar} style={{ background: eliminated ? '#ccc' : color }}>
          {p.username?.[0]?.toUpperCase() ?? '?'}
        </div>
        <span className={styles.name}>
          {p.username}
          {isMe && <span className={styles.youTag}> you</span>}
        </span>
      </div>
      <span className={styles.status}>
        {isWinner ? '👑' : eliminated ? '💀' : '🎮'}
      </span>
    </div>
  )
}
