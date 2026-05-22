import styles from './EventFeed.module.css'

const typeMap = {
  join:      styles.join,
  eliminate: styles.eliminate,
  win:       styles.win,
  start:     styles.start,
  info:      styles.info,
}

export default function EventFeed({ feed }) {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>📢 Live Feed</h3>
      <div className={styles.list}>
        {feed.length === 0
          ? <p className={styles.empty}>Events will appear here…</p>
          : feed.map(item => (
            <div key={item.ts} className={`${styles.item} ${typeMap[item.type] ?? styles.info}`}>
              {item.text}
            </div>
          ))
        }
      </div>
    </div>
  )
}
