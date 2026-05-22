const jwt = require('jsonwebtoken');
const { db, withTransaction } = require('../db');

let autoStartTimer = null;
let eliminationTimer = null;
let io = null;

function getConfig() {
  const rows = db.prepare('SELECT key, value FROM wheel_config').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

function broadcastWheelState(wheelId) {
  const wheel = db.prepare(`
    SELECT sw.*, u.username as creator_name
    FROM spin_wheels sw JOIN users u ON sw.created_by = u.id
    WHERE sw.id = ?
  `).get([wheelId]);
  if (!wheel) return;

  const participants = db.prepare(`
    SELECT wp.*, u.username FROM wheel_participants wp
    JOIN users u ON wp.user_id = u.id
    WHERE wp.wheel_id = ?
    ORDER BY wp.joined_at ASC
  `).all([wheel.id]);

  io.emit('wheel:state', { wheel, participants });
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function abortWheel(wheelId) {
  const wheel = db.prepare('SELECT * FROM spin_wheels WHERE id = ?').get([wheelId]);
  if (!wheel) return;

  withTransaction(() => {
    db.prepare("UPDATE spin_wheels SET status = 'aborted', ended_at = CURRENT_TIMESTAMP WHERE id = ?").run([wheelId]);
    const participants = db.prepare('SELECT * FROM wheel_participants WHERE wheel_id = ?').all([wheelId]);
    for (const p of participants) {
      db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run([wheel.entry_fee, p.user_id]);
      db.prepare("INSERT INTO transactions (user_id, type, amount, wheel_id, description) VALUES (?, 'refund', ?, ?, ?)").run(
        [p.user_id, wheel.entry_fee, wheelId, `Refund — wheel #${wheelId} aborted`]
      );
    }
    db.prepare('UPDATE spin_wheels SET winner_pool_amt=0, admin_pool_amt=0, app_pool_amt=0 WHERE id = ?').run([wheelId]);
  });

  io.emit('wheel:aborted', { wheelId, message: 'Not enough participants. Entry fees refunded!' });
  io.emit('wheel:none');
}

function finishWheel(wheelId, winner) {
  if (!winner) { abortWheel(wheelId); return; }

  withTransaction(() => {
    const wheel = db.prepare('SELECT * FROM spin_wheels WHERE id = ?').get([wheelId]);
    db.prepare('UPDATE wheel_participants SET is_winner = 1, eliminated_at = NULL WHERE wheel_id = ? AND user_id = ?').run([wheelId, winner.user_id]);
    db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run([wheel.winner_pool_amt, winner.user_id]);
    db.prepare("INSERT INTO transactions (user_id, type, amount, wheel_id, description) VALUES (?, 'winner_payout', ?, ?, ?)").run(
      [winner.user_id, wheel.winner_pool_amt, wheelId, `Winner payout — wheel #${wheelId}`]
    );
    db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run([wheel.admin_pool_amt, wheel.created_by]);
    db.prepare("INSERT INTO transactions (user_id, type, amount, wheel_id, description) VALUES (?, 'admin_payout', ?, ?, ?)").run(
      [wheel.created_by, wheel.admin_pool_amt, wheelId, `Admin payout — wheel #${wheelId}`]
    );
    db.prepare("UPDATE spin_wheels SET status = 'completed', winner_id = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?").run([winner.user_id, wheelId]);
  });

  const finalWheel = db.prepare('SELECT * FROM spin_wheels WHERE id = ?').get([wheelId]);
  io.emit('wheel:winner', {
    wheelId,
    winner: { id: winner.user_id, username: winner.username },
    winnerPoolAmt: finalWheel.winner_pool_amt,
    adminPoolAmt: finalWheel.admin_pool_amt,
  });
  setTimeout(() => io.emit('wheel:none'), 6000);
}

function startEliminations(wheelId) {
  const config = getConfig();
  const intervalMs = parseInt(config.elimination_interval_seconds) * 1000;

  const participants = db.prepare(
    'SELECT wp.*, u.username FROM wheel_participants wp JOIN users u ON wp.user_id = u.id WHERE wp.wheel_id = ? AND wp.eliminated_at IS NULL'
  ).all([wheelId]);

  const shuffled = shuffleArray([...participants]);
  const toEliminate = shuffled.slice(0, shuffled.length - 1);

  withTransaction(() => {
    toEliminate.forEach((p, i) => {
      db.prepare('UPDATE wheel_participants SET elimination_order = ? WHERE wheel_id = ? AND user_id = ?').run([i + 1, wheelId, p.user_id]);
    });
  });

  function eliminateNext() {
    const remaining = db.prepare(
      'SELECT wp.*, u.username FROM wheel_participants wp JOIN users u ON wp.user_id = u.id WHERE wp.wheel_id = ? AND wp.eliminated_at IS NULL ORDER BY elimination_order ASC'
    ).all([wheelId]);

    if (remaining.length <= 1) {
      finishWheel(wheelId, remaining[0]);
      return;
    }

    const toElim = remaining[0];
    db.prepare('UPDATE wheel_participants SET eliminated_at = CURRENT_TIMESTAMP WHERE wheel_id = ? AND user_id = ?').run([wheelId, toElim.user_id]);

    io.emit('wheel:elimination', {
      wheelId,
      eliminatedUser: { id: toElim.user_id, username: toElim.username },
      remainingCount: remaining.length - 1,
    });

    broadcastWheelState(wheelId);
    eliminationTimer = setTimeout(eliminateNext, intervalMs);
  }

  eliminationTimer = setTimeout(eliminateNext, intervalMs);
}

function tryAutoStart(wheelId) {
  const wheel = db.prepare("SELECT * FROM spin_wheels WHERE id = ? AND status = 'waiting'").get([wheelId]);
  if (!wheel) return;

  const config = getConfig();
  const minParticipants = parseInt(config.min_participants);
  const participants = db.prepare('SELECT * FROM wheel_participants WHERE wheel_id = ?').all([wheelId]);

  if (participants.length < minParticipants) {
    abortWheel(wheelId);
    return;
  }

  db.prepare("UPDATE spin_wheels SET status = 'spinning', started_at = CURRENT_TIMESTAMP WHERE id = ?").run([wheelId]);
  broadcastWheelState(wheelId);
  io.emit('wheel:started', { wheelId, participantCount: participants.length });
  startEliminations(wheelId);
}

function scheduleAutoStart(wheelId, scheduledStartAt) {
  if (autoStartTimer) clearTimeout(autoStartTimer);
  const delay = new Date(scheduledStartAt).getTime() - Date.now();
  autoStartTimer = setTimeout(() => tryAutoStart(wheelId), Math.max(0, delay));
}

function clearTimers() {
  if (autoStartTimer) { clearTimeout(autoStartTimer); autoStartTimer = null; }
  if (eliminationTimer) { clearTimeout(eliminationTimer); eliminationTimer = null; }
}

function initSocketHandlers(socketIo) {
  io = socketIo;

  // Resume in-progress wheel on restart
  const activeWheel = db.prepare("SELECT * FROM spin_wheels WHERE status IN ('waiting','spinning')").get();
  if (activeWheel) {
    if (activeWheel.status === 'waiting' && activeWheel.scheduled_start_at) {
      scheduleAutoStart(activeWheel.id, activeWheel.scheduled_start_at);
    } else if (activeWheel.status === 'spinning') {
      startEliminations(activeWheel.id);
    }
  }

  io.on('connection', (socket) => {
    const token = socket.handshake.auth?.token;
    let socketUser = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socketUser = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get([decoded.id]);
      } catch {}
    }

    socket.on('wheel:get_state', () => {
      const wheel = db.prepare(`
        SELECT sw.*, u.username as creator_name FROM spin_wheels sw
        JOIN users u ON sw.created_by = u.id
        WHERE sw.status IN ('waiting','spinning') LIMIT 1
      `).get();
      if (!wheel) { socket.emit('wheel:none'); return; }
      const participants = db.prepare(`
        SELECT wp.*, u.username FROM wheel_participants wp
        JOIN users u ON wp.user_id = u.id WHERE wp.wheel_id = ? ORDER BY wp.joined_at ASC
      `).all([wheel.id]);
      socket.emit('wheel:state', { wheel, participants });
    });

    socket.on('wheel:created', ({ wheelId }) => {
      if (socketUser?.role !== 'admin') return;
      const wheel = db.prepare("SELECT * FROM spin_wheels WHERE id = ? AND status = 'waiting'").get([wheelId]);
      if (wheel) {
        clearTimers();
        scheduleAutoStart(wheel.id, wheel.scheduled_start_at);
        broadcastWheelState(wheel.id);
      }
    });

    socket.on('wheel:user_joined', ({ wheelId }) => {
      broadcastWheelState(wheelId);
    });

    socket.on('wheel:manual_start', ({ wheelId }) => {
      if (socketUser?.role !== 'admin') return;
      const wheel = db.prepare("SELECT * FROM spin_wheels WHERE id = ? AND status = 'spinning'").get([wheelId]);
      if (wheel) {
        clearTimers();
        const participants = db.prepare('SELECT * FROM wheel_participants WHERE wheel_id = ?').all([wheelId]);
        broadcastWheelState(wheelId);
        io.emit('wheel:started', { wheelId, participantCount: participants.length });
        startEliminations(wheelId);
      }
    });
  });
}

module.exports = { initSocketHandlers };
