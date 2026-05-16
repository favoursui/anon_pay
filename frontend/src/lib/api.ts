// Typed API client - all calls go through here
// Token is fetched fresh from Privy before every request

import axios from 'axios'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

// Types 

export interface UserPublic {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  created_at: string
}

export interface UserPrivate extends UserPublic {
  privy_did: string
  is_active: boolean
  updated_at: string
}

export interface PaymentLink {
  id: string
  slug: string
  owner_username: string
  amount_usdc: string | null
  note: string | null
  is_active: boolean
  expires_at: string | null
  created_at: string
}

export interface Transaction {
  id: string
  sender_username: string | null
  recipient_username: string
  amount_usdc: string
  chain: string
  status: 'pending' | 'confirmed' | 'failed'
  tx_hash: string | null
  note: string | null
  created_at: string
  confirmed_at: string | null
}

export interface PaginatedTransactions {
  total: number
  page: number
  page_size: number
  items: Transaction[]
}

export interface InitiatePaymentResponse {
  tx_id: string
  recipient_wallet: string
  amount_usdc: string
  chain: string
  status: string
}

//  Auth helper 

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}

// Users 

export const api = {
  // Register
  register: async (token: string, data: {
    username: string
    wallet_address: string
    display_name?: string
    bio?: string
  }): Promise<UserPrivate> => {
    const res = await apiClient.post('/users/register', data, {
      headers: authHeader(token),
    })
    return res.data
  },

  // Get own profile
  getMe: async (token: string): Promise<UserPrivate> => {
    const res = await apiClient.get('/users/me', {
      headers: authHeader(token),
    })
    return res.data
  },

  // Update profile
  updateMe: async (token: string, data: {
    display_name?: string
    avatar_url?: string
    bio?: string
  }): Promise<UserPrivate> => {
    const res = await apiClient.patch('/users/me', data, {
      headers: authHeader(token),
    })
    return res.data
  },

  // Get public profile
  getPublicProfile: async (username: string): Promise<UserPublic> => {
    const res = await apiClient.get(`/users/${username}`)
    return res.data
  },

  // Resolve wallet (for payment flow)
  resolveWallet: async (token: string, username: string): Promise<{ username: string; wallet_address: string }> => {
    const res = await apiClient.get(`/users/${username}/resolve`, {
      headers: authHeader(token),
    })
    return res.data
  },

  //  Payments 

  initiatePayment: async (token: string, data: {
    recipient_username: string
    amount_usdc: string
    chain: string
    note?: string
    payment_link_slug?: string
  }): Promise<InitiatePaymentResponse> => {
    const res = await apiClient.post('/payments/send', data, {
      headers: authHeader(token),
    })
    return res.data
  },

  confirmPayment: async (token: string, txId: string, txHash: string): Promise<Transaction> => {
    const res = await apiClient.post(`/payments/${txId}/confirm`, { tx_hash: txHash }, {
      headers: authHeader(token),
    })
    return res.data
  },

  getHistory: async (token: string, page = 1, pageSize = 20): Promise<PaginatedTransactions> => {
    const res = await apiClient.get('/payments/history', {
      headers: authHeader(token),
      params: { page, page_size: pageSize },
    })
    return res.data
  },

  // Payment Links 

  createPaymentLink: async (token: string, data: {
    slug: string
    amount_usdc?: string
    note?: string
    expires_at?: string
  }): Promise<PaymentLink> => {
    const res = await apiClient.post('/payment-links', data, {
      headers: authHeader(token),
    })
    return res.data
  },

  getMyPaymentLinks: async (token: string): Promise<PaymentLink[]> => {
    const res = await apiClient.get('/payment-links', {
      headers: authHeader(token),
    })
    return res.data
  },

  getPaymentLink: async (slug: string): Promise<PaymentLink> => {
    const res = await apiClient.get(`/payment-links/${slug}`)
    return res.data
  },

  updatePaymentLink: async (token: string, slug: string, data: {
    amount_usdc?: string
    note?: string
    is_active?: boolean
  }): Promise<PaymentLink> => {
    const res = await apiClient.patch(`/payment-links/${slug}`, data, {
      headers: authHeader(token),
    })
    return res.data
  },

  deletePaymentLink: async (token: string, slug: string): Promise<void> => {
    await apiClient.delete(`/payment-links/${slug}`, {
      headers: authHeader(token),
    })
  },

  // Health 
  health: async (): Promise<{ status: string }> => {
    const res = await apiClient.get('/health')
    return res.data
  },
}
