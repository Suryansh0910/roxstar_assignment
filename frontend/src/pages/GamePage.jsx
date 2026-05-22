import { useEffect, useReducer, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useWheelSocket } from '../hooks/useWheelSocket'
import api from '../utils/api'
import Header from '../components/Header'
import WheelCanvas from '../components/WheelCanvas'
import PlayersList from '../components/PlayersList'
import EventFeed from '../components/EventFeed'
import CreateWheelForm from '../components/CreateWheelForm'
import WheelControls from '../components/WheelControls'
import WinnerModal from '../components/WinnerModal'
import TransactionHistory from '../components/TransactionHistory'
import styles from './GamePage.module.css'

const initialState = {
  wheel: null,
  participants: [],
  feed: [],
  winner: null,
  showWinner: false,
  spinning: false,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_WHEEL':
      return { ...state, wheel: action.wheel, participants: action.participants ?? state.participants }
    case 'NO_WHEEL':
      return { ...state, wheel: null, participants: [], spinning: false }
    case 'ADD_FEED':
      return { ...state, feed: [action.item, ...state.feed].slice(0, 30) }
    case 'SET_SPINNING':
      return { ...state, spinning: action.value }
    case 'SHOW_WINNER':
      return { ...state, winner: action.winner, showWinner: true, spinning: false }
    case 'CLOSE_WINNER':
      return { ...state, showWinner: false }
    default:
      return state
  }
}

export default function GamePage() {
  const { user, refreshUser } = useAuth()
  const [state, dispatch] = useReducer(reducer, initialState)
  const token = localStorage.getItem('token')

  const handleEvent = useCallback((ev, data) => {
    switch (ev) {
      case 'wheel:state':
        dispatch({ type: 'SET_WHEEL', wheel: data.wheel, participants: data.participants })
        break
      case 'wheel:none':
        dispatch({ type: 'NO_WHEEL' })
        break
      case 'wheel:started':
        dispatch({ type: 'SET_SPINNING', value: true })
        dispatch({ type: 'ADD_FEED', item: { type: 'start', text: `🎡 Wheel started with ${data.participantCount} players!`, ts: Date.now() } })
        toast('🎡 The wheel is spinning!', { icon: '🎡' })
        break
      case 'wheel:elimination':
        dispatch({ type: 'ADD_FEED', item: { type: 'eliminate', text: `💥 ${data.eliminatedUser.username} was eliminated! ${data.remainingCount} left`, ts: Date.now() } })
        refreshUser()
        break
      case 'wheel:winner':
        dispatch({ type: 'SHOW_WINNER', winner: { ...data.winner, prize: data.winnerPoolAmt } })
        dispatch({ type: 'ADD_FEED', item: { type: 'win', text: `🏆 ${data.winner.username} won ${data.winnerPoolAmt} coins!`, ts: Date.now() } })
        refreshUser()
        break
      case 'wheel:aborted':
        dispatch({ type: 'ADD_FEED', item: { type: 'info', text: `⚠️ ${data.message}`, ts: Date.now() } })
        toast.error(data.message)
        refreshUser()
        break
    }
  }, [refreshUser])

  const { emit } = useWheelSocket(token, handleEvent)

  const isParticipant = state.participants.some(p => p.user_id === user?.id)
  const wheelId = state.wheel?.id

  const handleJoin = async () => {
    try {
      await api.post(`/wheel/${wheelId}/join`)
      emit('wheel:user_joined', { wheelId })
      dispatch({ type: 'ADD_FEED', item: { type: 'join', text: `🎟️ ${user.username} joined the game!`, ts: Date.now() } })
      toast.success('You joined the game!')
      refreshUser()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to join')
    }
  }

  const handleCreate = async (formData) => {
    try {
      const { data } = await api.post('/wheel/create', formData)
      emit('wheel:created', { wheelId: data.wheel.id })
      toast.success('Wheel created! Auto-starts in 3 minutes.')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create wheel')
    }
  }

  const handleManualStart = async () => {
    try {
      await api.post(`/wheel/${wheelId}/start`)
      emit('wheel:manual_start', { wheelId })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start')
    }
  }

  return (
    <div className={styles.page}>
      <Header user={user} />

      <div className={styles.layout}>
        {/* Left: Wheel */}
        <div className={styles.wheelCol}>
          {!state.wheel ? (
            <NoWheelState isAdmin={user?.role === 'admin'} onCreate={handleCreate} />
          ) : (
            <>
              <WheelCanvas participants={state.participants} spinning={state.spinning} />
              <WheelControls
                wheel={state.wheel}
                isParticipant={isParticipant}
                isAdmin={user?.role === 'admin'}
                userId={user?.id}
                onJoin={handleJoin}
                onManualStart={handleManualStart}
              />
            </>
          )}
        </div>

        {/* Right: Feed + Players + Txns */}
        <div className={styles.sideCol}>
          <PlayersList participants={state.participants} currentUserId={user?.id} />
          <EventFeed feed={state.feed} />
          <TransactionHistory />
        </div>
      </div>

      {state.showWinner && (
        <WinnerModal
          winner={state.winner}
          currentUserId={user?.id}
          onClose={() => dispatch({ type: 'CLOSE_WINNER' })}
        />
      )}
    </div>
  )
}

function NoWheelState({ isAdmin, onCreate }) {
  return (
    <div className={styles.noWheel}>
      <div className={styles.emptyArt}>🎠</div>
      <h2 className={styles.emptyTitle}>No Game Running</h2>
      <p className={styles.emptyText}>Waiting for the carnival to begin...</p>
      {isAdmin && <CreateWheelForm onCreate={onCreate} />}
    </div>
  )
}
