const express = require('express');
const { db, withTransaction } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/active', authenticate, (req, res) => {
  const wheel = db.prepare(`
    SELECT sw.*, u.username as creator_name,
      (SELECT COUNT(*) FROM wheel_participants wp WHERE wp.wheel_id = sw.id AND wp.eliminated_at IS NULL) as active_count,
      (SELECT COUNT(*) FROM wheel_participants wp WHERE wp.wheel_id = sw.id) as total_count
    FROM spin_wheels sw
    JOIN users u ON sw.created_by = u.id
    WHERE sw.status IN ('waiting', 'spinning')
    LIMIT 1
  `).get();

  if (!wheel) return res.json({ wheel: null });

  const participants = db.prepare(`
    SELECT wp.*, u.username FROM wheel_participants wp
    JOIN users u ON wp.user_id = u.id
    WHERE wp.wheel_id = ?
    ORDER BY wp.joined_at ASC
  `).all([wheel.id]);

  const isParticipant = participants.some(p => p.user_id === req.user.id);
  res.json({ wheel, participants, isParticipant });
});

router.get('/config', authenticate, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM wheel_config').all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});

router.put('/config', authenticate, requireAdmin, (req, res) => {
  const allowed = ['winner_pool_pct', 'admin_pool_pct', 'app_pool_pct', 'default_entry_fee', 'auto_start_minutes'];
  const updates = req.body;

  const getVal = (key) => parseFloat(updates[key] ?? db.prepare('SELECT value FROM wheel_config WHERE key = ?').get([key]).value);
  const winnerPct = getVal('winner_pool_pct');
  const adminPct = getVal('admin_pool_pct');
  const appPct = getVal('app_pool_pct');

  if (Math.abs(winnerPct + adminPct + appPct - 100) > 0.01) {
    return res.status(400).json({ error: 'Percentages must sum to 100' });
  }

  const stmt = db.prepare('UPDATE wheel_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?');
  for (const key of allowed) {
    if (updates[key] !== undefined) stmt.run([String(updates[key]), key]);
  }

  const rows = db.prepare('SELECT key, value FROM wheel_config').all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});

router.post('/create', authenticate, requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT id FROM spin_wheels WHERE status IN ('waiting','spinning')").get();
  if (existing) return res.status(409).json({ error: 'A spin wheel is already active' });

  const cfg = db.prepare('SELECT key, value FROM wheel_config').all();
  const config = Object.fromEntries(cfg.map(r => [r.key, r.value]));

  const entry_fee = parseInt(req.body.entry_fee ?? config.default_entry_fee);
  const winner_pct = parseFloat(req.body.winner_pool_pct ?? config.winner_pool_pct);
  const admin_pct = parseFloat(req.body.admin_pool_pct ?? config.admin_pool_pct);
  const app_pct = parseFloat(req.body.app_pool_pct ?? config.app_pool_pct);

  if (Math.abs(winner_pct + admin_pct + app_pct - 100) > 0.01) {
    return res.status(400).json({ error: 'Percentages must sum to 100' });
  }

  const autoStartMinutes = parseInt(config.auto_start_minutes);
  const scheduledStart = new Date(Date.now() + autoStartMinutes * 60 * 1000).toISOString();

  const result = db.prepare(`
    INSERT INTO spin_wheels (entry_fee, winner_pool_pct, admin_pool_pct, app_pool_pct, created_by, scheduled_start_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run([entry_fee, winner_pct, admin_pct, app_pct, req.user.id, scheduledStart]);

  const wheel = db.prepare('SELECT * FROM spin_wheels WHERE id = ?').get([result.lastInsertRowid]);
  res.json({ wheel });
});

router.post('/:id/join', authenticate, (req, res) => {
  const wheelId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    const result = withTransaction(() => {
      const wheel = db.prepare("SELECT * FROM spin_wheels WHERE id = ? AND status = 'waiting'").get([wheelId]);
      if (!wheel) throw new Error('Wheel not found or not accepting participants');

      const already = db.prepare('SELECT id FROM wheel_participants WHERE wheel_id = ? AND user_id = ?').get([wheelId, userId]);
      if (already) throw new Error('Already joined this wheel');

      const user = db.prepare('SELECT coins FROM users WHERE id = ?').get([userId]);
      if (user.coins < wheel.entry_fee) throw new Error('Insufficient coins');

      const deducted = db.prepare('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?').run([wheel.entry_fee, userId, wheel.entry_fee]);
      if (deducted.changes === 0) throw new Error('Coin deduction failed');

      const winnerShare = Math.floor(wheel.entry_fee * wheel.winner_pool_pct / 100);
      const adminShare = Math.floor(wheel.entry_fee * wheel.admin_pool_pct / 100);
      const appShare = wheel.entry_fee - winnerShare - adminShare;

      db.prepare(`
        UPDATE spin_wheels SET
          winner_pool_amt = winner_pool_amt + ?,
          admin_pool_amt = admin_pool_amt + ?,
          app_pool_amt = app_pool_amt + ?
        WHERE id = ?
      `).run([winnerShare, adminShare, appShare, wheelId]);

      db.prepare('INSERT INTO wheel_participants (wheel_id, user_id) VALUES (?, ?)').run([wheelId, userId]);
      db.prepare("INSERT INTO transactions (user_id, type, amount, wheel_id, description) VALUES (?, 'entry_fee', ?, ?, ?)").run(
        [userId, -wheel.entry_fee, wheelId, `Entry fee for wheel #${wheelId}`]
      );

      return db.prepare('SELECT * FROM spin_wheels WHERE id = ?').get([wheelId]);
    });
    res.json({ success: true, wheel: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/start', authenticate, requireAdmin, (req, res) => {
  const wheelId = parseInt(req.params.id);
  const wheel = db.prepare("SELECT * FROM spin_wheels WHERE id = ? AND status = 'waiting'").get([wheelId]);
  if (!wheel) return res.status(404).json({ error: 'Wheel not found or already started' });

  const minParticipants = parseInt(db.prepare("SELECT value FROM wheel_config WHERE key='min_participants'").get().value);
  const participants = db.prepare('SELECT * FROM wheel_participants WHERE wheel_id = ?').all([wheelId]);

  if (participants.length < minParticipants) {
    return res.status(400).json({ error: `Need at least ${minParticipants} participants` });
  }

  db.prepare("UPDATE spin_wheels SET status = 'spinning', started_at = CURRENT_TIMESTAMP WHERE id = ?").run([wheelId]);
  res.json({ success: true });
});

router.get('/transactions', authenticate, (req, res) => {
  const transactions = db.prepare(`
    SELECT t.*, sw.entry_fee FROM transactions t
    LEFT JOIN spin_wheels sw ON t.wheel_id = sw.id
    WHERE t.user_id = ?
    ORDER BY t.created_at DESC LIMIT 50
  `).all([req.user.id]);
  res.json({ transactions });
});

router.get('/history', authenticate, (req, res) => {
  const wheels = db.prepare(`
    SELECT sw.*, u.username as creator_name, w.username as winner_name,
      (SELECT COUNT(*) FROM wheel_participants wp WHERE wp.wheel_id = sw.id) as total_participants
    FROM spin_wheels sw
    JOIN users u ON sw.created_by = u.id
    LEFT JOIN users w ON sw.winner_id = w.id
    ORDER BY sw.created_at DESC LIMIT 20
  `).all();
  res.json({ wheels });
});

module.exports = router;
