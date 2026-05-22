require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const wheelRoutes = require('./routes/wheel');
const { initSocketHandlers } = require('./socket/wheelSocket');

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGIN = process.env.FRONTEND_URL || '*';

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGIN, methods: ['GET', 'POST', 'PUT'], credentials: true }
});

app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/wheel', wheelRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

initSocketHandlers(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Roxstar server running on http://localhost:${PORT}`);
});
