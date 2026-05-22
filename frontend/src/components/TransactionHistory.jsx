import { useEffect, useState } from 'react'
import api from '../utils/api'
import styles from './TransactionHistory.module.css'

const typeLabel = {
  entry_fee: '🎟️ Entry Fee',
  winner_payout: '🏆 Win!',
  admin_payout: '👑 Admin Cut',
  refund: '↩️ Refund',
  initial_grant: '🎁 Welcome Bonus',
}

export default function TransactionHistory() {
  const [txns, setTxns] = useState([])

  const load = () => api.get('/wheel/transactions').then(r => setTxns(r.data.transactions)).catch(() => {})

  useEffect(() => { load() }, [])

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>💳 My Transactions</h3>
        <button className={styles.refresh} onClick={load}>↻</button>
      </div>
      <div className={styles.list}>
        {txns.length === 0
          ? <p className={styles.empty}>No transactions yet</p>
          : txns.map(tx => (
            <div key={tx.id} className={styles.item}>
              <span className={styles.desc}>{typeLabel[tx.type] ?? tx.type}</span>
              <span className={`${styles.amt} ${tx.amount > 0 ? styles.pos : styles.neg}`}>
                {tx.amount > 0 ? '+' : ''}{tx.amount}
              </span>
            </div>
          ))
        }
      </div>
    </div>
  )
}
