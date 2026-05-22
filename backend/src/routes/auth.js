const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, email, password, adminKey } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, and password are required' });
  }

  const role = adminKey === process.env.ADMIN_SETUP_KEY ? 'admin' : 'user';

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, role, coins) VALUES (?, ?, ?, ?, ?)'
    ).run([username, email.toLowerCase(), hash, role, 1000]);

    db.prepare(
      "INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'initial_grant', 1000, 'Welcome bonus')"
    ).run([result.lastInsertRowid]);

    const user = db.prepare('SELECT id, username, email, coins, role FROM users WHERE id = ?').get([result.lastInsertRowid]);
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    res.json({ user, token });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username or email already taken' });
    }
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get([email.toLowerCase()]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const { password_hash, ...safeUser } = user;
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
  res.json({ user: safeUser, token });
});

router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, username, email, coins, role FROM users WHERE id = ?').get([req.user.id]);
  res.json(user);
});

module.exports = router;
