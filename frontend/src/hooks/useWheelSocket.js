import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'

export function useWheelSocket(token, onEvent) {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!token) return
    const socket = io('http://localhost:3001', {
      auth: { token },
      transports: ['websocket'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('wheel:get_state')
    })
    socket.on('disconnect', () => setConnected(false))

    const events = ['wheel:state', 'wheel:none', 'wheel:started', 'wheel:elimination', 'wheel:winner', 'wheel:aborted']
    events.forEach(ev => socket.on(ev, (data) => onEvent(ev, data)))

    return () => socket.disconnect()
  }, [token])

  const emit = useCallback((ev, data) => socketRef.current?.emit(ev, data), [])

  return { emit, connected }
}
