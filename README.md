# 🎡 Roxstar Spin Wheel Game

A real-time multiplayer spin wheel game where users compete for a coin prize pool.

---

## Tech Stack

| Layer    | Tech                                                         |
|----------|--------------------------------------------------------------|
| Backend  | Node.js + Express + Socket.io                                |
| Database | SQLite via `node-sqlite3-wasm` (WASM — no native build needed) |
| Frontend | React + Vite + CSS Modules                                   |
| Auth     | JWT (bcryptjs)                                               |

---

## Quick Start

### 1. Backend

```bash
cd backend
npm install
npm run dev        # or: npm start
```

Server starts at **http://localhost:3001**

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App opens at **http://localhost:5173**

---

## Environment Variables (`backend/.env`)

```
PORT=3001
JWT_SECRET=roxstar_super_secret_jwt_key_2024
JWT_EXPIRES_IN=7d
DB_PATH=./data/roxstar.db
ADMIN_SETUP_KEY=roxstar_admin_2024
```

---

## Creating an Admin Account

Register with the **Admin Key** field filled in:

```
Admin Key: roxstar_admin_2024
```

Only admins can create spin wheels and force-start games.

---

## Game Flow

```
Admin creates wheel  →  Users join (pay entry fee)
        ↓
Auto-start after 3 min  OR  Admin force-starts
        ↓
Min 3 players? YES → Start eliminations (1 every 7s)
               NO  → Abort + full refunds
        ↓
Last player standing wins
        ↓
Winner receives winner pool, Admin receives admin pool
```

---

## Coin Distribution

Each entry fee is split per the wheel's config (defaults):

| Pool         | Default | Description                    |
|--------------|---------|--------------------------------|
| Winner Pool  | 70%     | Paid out to last survivor      |
| Admin Pool   | 20%     | Paid to wheel creator (admin)  |
| App Pool     | 10%     | Retained by platform           |

Config is database-driven — adjustable per wheel, must always sum to 100%.

---

## API Reference

### Auth
| Method | Endpoint            | Body                                    |
|--------|---------------------|-----------------------------------------|
| POST   | /api/auth/register  | `username, email, password, adminKey?`  |
| POST   | /api/auth/login     | `email, password`                       |
| GET    | /api/auth/me        | Bearer token                            |

### Wheel
| Method | Endpoint                 | Access |
|--------|--------------------------|--------|
| GET    | /api/wheel/active        | User   |
| POST   | /api/wheel/create        | Admin  |
| POST   | /api/wheel/:id/join      | User   |
| POST   | /api/wheel/:id/start     | Admin  |
| GET    | /api/wheel/transactions  | User   |
| GET    | /api/wheel/history       | User   |
| GET    | /api/wheel/config        | User   |
| PUT    | /api/wheel/config        | Admin  |

### Socket.io Events

| Event                | Direction        | Payload                               |
|----------------------|------------------|---------------------------------------|
| `wheel:get_state`    | Client → Server  | —                                     |
| `wheel:state`        | Server → All     | `{ wheel, participants }`             |
| `wheel:none`         | Server → All     | —                                     |
| `wheel:created`      | Client → Server  | `{ wheelId }`                         |
| `wheel:user_joined`  | Client → Server  | `{ wheelId }`                         |
| `wheel:manual_start` | Client → Server  | `{ wheelId }`                         |
| `wheel:started`      | Server → All     | `{ wheelId, participantCount }`       |
| `wheel:elimination`  | Server → All     | `{ eliminatedUser, remainingCount }`  |
| `wheel:winner`       | Server → All     | `{ winner, winnerPoolAmt }`           |
| `wheel:aborted`      | Server → All     | `{ message }`                         |

---

## Database Schema

Five tables: `users`, `spin_wheels`, `wheel_participants`, `transactions`, `wheel_config`.

See [`backend/migrations/schema.sql`](backend/migrations/schema.sql) for full DDL.

---

## Edge Cases Handled

| Case | Handling |
|------|----------|
| Two simultaneous wheels | Blocked at API level — only one `waiting`/`spinning` wheel allowed |
| Insufficient coins | Checked atomically with `UPDATE ... WHERE coins >= fee` |
| < 3 players after 3 min | Auto-abort + full refund, all transactions recorded |
| Negative coin balance | Impossible — SQLite UPDATE verifies balance before deducting |
| Concurrent coin updates | SQLite WAL mode; atomic UPDATE prevents race conditions |
| Server restart mid-game | `waiting` wheels re-register their timer; `spinning` wheels resume eliminations |
| Payout atomicity | Winner + admin credits happen in a single SQLite transaction |
| Percentages ≠ 100% | Validated on both `/create` and `/config` update |

---

## Assumptions

1. One admin manages the platform; the admin key is set via `.env`
2. New users start with 1000 coins (welcome bonus)
3. Socket.io auth reuses the same JWT as REST
4. The "app pool" is tracked in the DB but not credited to any user (platform revenue)
5. Elimination order is randomised at wheel start, not re-randomised each round
