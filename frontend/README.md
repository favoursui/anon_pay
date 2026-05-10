# AnonPay Frontend

Next.js 14 frontend for the AnonPay privacy-first USDC payment system.

## Stack
- **Next.js 14** — App Router
- **Privy** — Authentication (email, wallet, Google)
- **wagmi + viem** — Wallet connection & USDC transfers
- **Tailwind CSS** — Styling
- **Framer Motion** — Animations
- **Syne + Space Mono** — Typography

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_PRIVY_APP_ID

# 3. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Your Privy App ID from console.privy.io |
| `NEXT_PUBLIC_API_URL` | Backend URL (default: http://localhost:8000) |
| `NEXT_PUBLIC_BASE_CHAIN_ID` | Chain ID (8453 for Base mainnet) |

## Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/dashboard` | Overview + recent transactions |
| `/send` | Send USDC by username |
| `/receive` | Your username + payment link |
| `/history` | Full transaction history |
| `/payment-links` | Manage shareable payment links |
| `/profile` | Register / edit profile |
| `/pay/[slug]` | Public payment page for links |

## Payment Flow

1. Sender enters `@username` + amount on `/send`
2. Frontend calls backend `POST /payments/send` → gets `recipient_wallet` back
3. wagmi signs & broadcasts USDC ERC-20 transfer on Base
4. Frontend calls `POST /payments/{tx_id}/confirm` with the tx hash
5. Backend verifies on-chain and marks confirmed

The recipient's wallet address is only returned to the sender during step 2 — it's never stored in the browser or logged.
