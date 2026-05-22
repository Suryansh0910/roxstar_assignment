import { useEffect, useRef } from 'react'
import styles from './WheelCanvas.module.css'

const COLORS = [
  '#FF3B3B', '#2979FF', '#FFD700', '#00C853',
  '#FF6D00', '#9C27B0', '#FF4081', '#00BCD4',
  '#8BC34A', '#FF5722',
]

export default function WheelCanvas({ participants, spinning }) {
  const canvasRef = useRef(null)
  const rotRef = useRef(0)
  const rafRef = useRef(null)
  const prevSpinRef = useRef(false)

  const active = participants.filter(p => !p.eliminated_at)
  const segments = active.length > 0 ? active : [{ username: '🎡' }]

  function draw(rot) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    const cx = W / 2, cy = H / 2
    const r = Math.min(cx, cy) - 10
    const arc = (2 * Math.PI) / segments.length

    ctx.clearRect(0, 0, W, H)

    segments.forEach((p, i) => {
      const start = rot + i * arc
      const end = start + arc
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, start, end)
      ctx.closePath()
      ctx.fillStyle = COLORS[i % COLORS.length]
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 3
      ctx.stroke()

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(start + arc / 2)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${segments.length > 7 ? 11 : 13}px Nunito, sans-serif`
      ctx.shadowColor = 'rgba(0,0,0,0.5)'
      ctx.shadowBlur = 4
      const name = p.username?.length > 10 ? p.username.slice(0, 9) + '…' : (p.username ?? '?')
      ctx.fillText(name, r - 12, 5)
      ctx.restore()
    })

    // Center hub
    ctx.beginPath()
    ctx.arc(cx, cy, 28, 0, 2 * Math.PI)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.strokeStyle = '#FFD700'
    ctx.lineWidth = 4
    ctx.stroke()

    ctx.font = '18px serif'
    ctx.textAlign = 'center'
    ctx.fillText('🎡', cx, cy + 7)
  }

  useEffect(() => {
    if (spinning && !prevSpinRef.current) {
      // Start continuous spin
      let last = null
      const tick = (now) => {
        if (last) rotRef.current += (now - last) * 0.0018
        last = now
        draw(rotRef.current)
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } else if (!spinning && prevSpinRef.current) {
      // Stop spin and do a final dramatic spin
      cancelAnimationFrame(rafRef.current)
      const startRot = rotRef.current
      const extra = Math.PI * 2 * (6 + Math.random() * 4)
      const duration = 2800
      const start = performance.now()
      const final = (now) => {
        const t = Math.min((now - start) / duration, 1)
        const ease = 1 - Math.pow(1 - t, 3)
        rotRef.current = startRot + extra * ease
        draw(rotRef.current)
        if (t < 1) rafRef.current = requestAnimationFrame(final)
      }
      rafRef.current = requestAnimationFrame(final)
    } else if (!spinning) {
      draw(rotRef.current)
    }
    prevSpinRef.current = spinning
  }, [spinning, segments.length])

  // Redraw when participants change
  useEffect(() => {
    if (!spinning) draw(rotRef.current)
  }, [participants])

  // Initial draw
  useEffect(() => {
    draw(rotRef.current)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div className={styles.wrapper}>
      <canvas ref={canvasRef} width={340} height={340} className={styles.canvas} />
      <div className={`${styles.pointer} ${spinning ? styles.pointerSpin : ''}`}>▼</div>
    </div>
  )
}
