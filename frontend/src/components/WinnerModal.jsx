import { useEffect, useRef } from 'react'
import styles from './WinnerModal.module.css'

const CONFETTI_COLORS = ['#FF3B3B','#FFD700','#2979FF','#00C853','#FF6D00','#9C27B0','#FF4081']

export default function WinnerModal({ winner, currentUserId, onClose }) {
  const containerRef = useRef(null)
  const isMe = winner?.id === currentUserId

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    for (let i = 0; i < 60; i++) {
      const el = document.createElement('div')
      el.className = styles.confettiPiece
      el.style.cssText = `
        left: ${Math.random() * 100}%;
        background: ${CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]};
        width: ${6 + Math.random() * 8}px;
        height: ${6 + Math.random() * 8}px;
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        animation-delay: ${Math.random() * 0.8}s;
        animation-duration: ${2.5 + Math.random() * 1.5}s;
      `
      container.appendChild(el)
    }
    return () => { while (container.firstChild) container.removeChild(container.firstChild) }
  }, [])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.box} onClick={e => e.stopPropagation()}>
        <div className={styles.confettiContainer} ref={containerRef} />
        <div className={styles.crown}>👑</div>
        <h2 className={styles.winnerTitle}>
          {isMe ? 'YOU WIN!!! 🎉' : 'WINNER!'}
        </h2>
        <p className={styles.winnerName}>{winner?.username}</p>
        <p className={styles.prize}>
          {isMe ? '🤑' : '🏆'} {winner?.prize?.toLocaleString()} coins
        </p>
        {isMe && <p className={styles.congrats}>Congrats! Coins added to your wallet.</p>}
        <button className={styles.btn} onClick={onClose}>🎉 Awesome!</button>
      </div>
    </div>
  )
}
