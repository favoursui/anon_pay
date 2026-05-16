# AnonPay

> Privacy-first USDC payment system. Send and receive payments via **@usernames** - wallet addresses are never exposed.

---

## What is AnonPay?

AnonPay lets users send and receive USDC on the ARC network using simple usernames instead of wallet addresses. Your wallet address is encrypted server-side and never appears in any URL, API response, or log.

**Key properties:**
- **Non-custodial** - your keys, your funds. AnonPay never holds or touches your USDC.
- **Privacy-first** - wallet addresses are encrypted at rest and resolved server-side only, never exposed to senders.
- **Username-based** - send to `@anyone` instead of `0x1234...abcd`.
- **On-chain verification** - every payment is verified against the ARC blockchain before being marked confirmed.

---

## Architecture

```
Frontend (Next.js 14)
    │
    │  Privy JWT (auto-refreshed)
    ▼
Backend (FastAPI)
    │
    ├── Auth: Privy JWT verification
    ├── Username → Wallet resolution (server-side, encrypted)
    ├── Transaction logging (usernames only, no addresses)
    └── On-chain verification via ARC RPC
    │
    ▼
PostgreSQL
    │
    ├── users (username + encrypted_wallet)
    ├── transactions (sender/recipient by FK, no addresses)
    └── payment_links (shareable pay pages)
    │
    ▼
ARC Network (blockchain)
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Auth | Privy (email, Google, wallet login) |
| Wallet | MetaMask / external wallet (for ARC) |
| Backend | FastAPI, Python 3.11 |
| Database | PostgreSQL + SQLAlchemy (async) |
| Encryption | Fernet (AES-128-CBC) for wallet addresses at rest |
| Blockchain | ARC Network, viem |
| Infra | Docker, Docker Compose |

---

## Project Structure

```
anonpay/
├── docker-compose.yml          ← runs everything
├── .env                        ← root env vars for docker-compose
├── backend/
│   ├── Dockerfile
│   ├── .env                    ← all secrets live here
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── core/
│       │   ├── config.py       ← reads all settings from .env
│       │   ├── auth.py         ← Privy JWT verification
│       │   └── security.py     ← Fernet encryption
│       ├── api/v1/endpoints/
│       │   ├── users.py
│       │   ├── payments.py
│       │   ├── payment_links.py
│       │   └── health.py
│       ├── models/             ← SQLAlchemy ORM
│       ├── schemas/            ← Pydantic request/response models
│       └── services/
│           ├── user_service.py
│           ├── transaction_service.py
│           ├── payment_link_service.py
│           └── blockchain_service.py
└── frontend/
    ├── Dockerfile
    ├── .env.local              ← frontend env (local dev only)
    └── src/
        ├── app/
        │   ├── page.tsx        ← Landing page
        │   ├── dashboard/      ← Balance + recent transactions
        │   ├── send/           ← Send USDC by @username
        │   ├── receive/        ← Your username + pay link
        │   ├── history/        ← Full transaction history
        │   ├── payment-links/  ← Manage shareable links
        │   ├── profile/        ← Register + edit profile
        │   └── pay/[slug]/     ← Public payment page
        ├── components/
        │   ├── Providers.tsx   ← Privy + Wagmi + React Query
        │   ├── layout/
        │   └── ui/
        ├── hooks/
        │   └── useAnonPay.ts
        └── lib/
            ├── api.ts          ← typed API client
            └── utils.ts
```

---

## Quick Start

### Prerequisites
- Docker + Docker Compose
- MetaMask browser extension (for sending on ARC)
- Privy account ([console.privy.io](https://console.privy.io))

### 1. Clone and configure

```bash
git clone <repo>
cd anonpay
```

### 2. Set up environment variables

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
# Privy
PRIVY_APP_ID=your_privy_app_id
PRIVY_SECRET_KEY=your_privy_secret_key

# Database
DATABASE_URL=postgresql://anonpay:anonpay@db:5432/anonpay

# ARC Network
CHAIN_RPC_URL=https://rpc.testnet.arc.network
CHAIN_ID=5042002
CHAIN_NAME=ARC Testnet
USDC_CONTRACT_ADDRESS=0x3600000000000000000000000000000000000000

# Encryption (generate with: python backend/scripts/generate_key.py)
ENCRYPTION_KEY=your_fernet_key

# CORS
FRONTEND_URL=http://localhost:3000

# App
ENVIRONMENT=development
LOG_LEVEL=INFO

# Frontend vars (passed to Next.js at build time)
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_CHAIN_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_CHAIN_ID=5042002
NEXT_PUBLIC_CHAIN_NAME=ARC Testnet
NEXT_PUBLIC_USDC_CONTRACT_ADDRESS=0x3600000000000000000000000000000000000000
NEXT_PUBLIC_CHAIN_EXPLORER_URL=https://explorer.testnet.arc.network
```

Copy the `NEXT_PUBLIC_*` lines to the root `.env` so Docker Compose can pass them as build args:

```bash
grep "NEXT_PUBLIC" backend/.env > .env
```

### 3. Generate encryption key

```bash
python backend/scripts/generate_key.py
# Copy the output into ENCRYPTION_KEY in backend/.env
```

### 4. Run

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

---

## Payment Flow

```
1. Sender enters @username + amount
        ↓
2. Backend resolves username → wallet (server-side, never logged)
   Creates PENDING transaction record
   Returns { tx_id, recipient_wallet } to sender only
        ↓
3. MetaMask signs & broadcasts native USDC transfer on ARC
        ↓
4. Frontend calls POST /payments/{tx_id}/confirm with tx_hash
   Backend verifies Transfer on-chain (checks to + value)
   Marks transaction CONFIRMED
        ↓
5. Success - both users see the transaction in history
```

---

## API Reference

### Authentication
All protected endpoints require:
```
Authorization: Bearer <privy-access-token>
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/users/register` | ✅ | Register username + wallet |
| `GET` | `/api/v1/users/me` | ✅ | Own profile |
| `PATCH` | `/api/v1/users/me` | ✅ | Update profile |
| `GET` | `/api/v1/users/{username}` | ❌ | Public profile |
| `GET` | `/api/v1/users/{username}/resolve` | ✅ | Resolve wallet (payment flow) |
| `POST` | `/api/v1/payments/send` | ✅ | Initiate payment |
| `POST` | `/api/v1/payments/{tx_id}/confirm` | ✅ | Confirm with tx hash |
| `GET` | `/api/v1/payments/history` | ✅ | Transaction history |
| `POST` | `/api/v1/payment-links` | ✅ | Create payment link |
| `GET` | `/api/v1/payment-links` | ✅ | List own links |
| `GET` | `/api/v1/payment-links/{slug}` | ❌ | Public link |
| `GET` | `/api/v1/health` | ❌ | Health check |

---

## Switching Networks

To switch from testnet to mainnet, update only these lines in `backend/.env`:

```env
CHAIN_RPC_URL=https://rpc.arc.network
CHAIN_ID=<testnet_chain_id>
CHAIN_NAME=ARC
NEXT_PUBLIC_CHAIN_RPC_URL=https://rpc.arc.network
NEXT_PUBLIC_CHAIN_ID=<testnet_chain_id>
NEXT_PUBLIC_CHAIN_NAME=ARC
NEXT_PUBLIC_CHAIN_EXPLORER_URL=https://explorer.arc.network
```

Then:
```bash
grep "NEXT_PUBLIC" backend/.env > .env
docker compose up --build
```

No code changes needed.

---

## Privacy Model

| What | How |
|---|---|
| Wallet addresses | Encrypted with Fernet (AES-128-CBC) before DB write |
| Username → wallet | Resolved in-memory during payment flow only, never logged |
| Transaction records | Store sender/recipient as user FKs - no addresses |
| API responses | Wallet address returned once to sender during payment init only |
| URLs | No wallet addresses ever appear in any URL |

---

## License

MIT