'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider, createConfig } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, defineChain } from 'viem'

// ARC chain definitions 
const arcChain = defineChain({
  id: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '5042002'),
  name: process.env.NEXT_PUBLIC_CHAIN_NAME || 'ARC Testnet',
  nativeCurrency: { name: 'ARC', symbol: 'ARC', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_CHAIN_RPC_URL || 'https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: {
      name: 'ARC Explorer',
      url: process.env.NEXT_PUBLIC_CHAIN_EXPLORER_URL || 'https://testnet.arcscan.app',
    },
  },
  testnet: true,
})

const wagmiConfig = createConfig({
  chains: [arcChain],
  transports: {
    [arcChain.id]: http(process.env.NEXT_PUBLIC_CHAIN_RPC_URL),
  },
})

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#00ff87',
        },
        loginMethods: ['email', 'google', 'wallet'],
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        defaultChain: arcChain,
        supportedChains: [arcChain],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}