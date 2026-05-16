'use client'

import { usePrivy } from '@privy-io/react-auth'
import { api } from '@/lib/api'

// Central hook - calls getAccessToken() fresh before every API request
// No useCallback wrapping to avoid dependency array infinite loops
export function useAnonPay() {
  const { getAccessToken, authenticated, user } = usePrivy()

  async function withToken<T>(fn: (token: string) => Promise<T>): Promise<T> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')
    return fn(token)
  }

  return {
    authenticated,
    user,

    // Users
    register:         (data: Parameters<typeof api.register>[1]) =>
                        withToken(t => api.register(t, data)),
    getMe:            () => withToken(t => api.getMe(t)),
    updateMe:         (data: Parameters<typeof api.updateMe>[1]) =>
                        withToken(t => api.updateMe(t, data)),
    getPublicProfile: (username: string) => api.getPublicProfile(username),
    resolveWallet:    (username: string) =>
                        withToken(t => api.resolveWallet(t, username)),

    // Payments
    initiatePayment:  (data: Parameters<typeof api.initiatePayment>[1]) =>
                        withToken(t => api.initiatePayment(t, data)),
    confirmPayment:   (txId: string, txHash: string) =>
                        withToken(t => api.confirmPayment(t, txId, txHash)),
    getHistory:       (page?: number, pageSize?: number) =>
                        withToken(t => api.getHistory(t, page, pageSize)),

    // Payment Links
    createPaymentLink:  (data: Parameters<typeof api.createPaymentLink>[1]) =>
                          withToken(t => api.createPaymentLink(t, data)),
    getMyPaymentLinks:  () => withToken(t => api.getMyPaymentLinks(t)),
    updatePaymentLink:  (slug: string, data: Parameters<typeof api.updatePaymentLink>[2]) =>
                          withToken(t => api.updatePaymentLink(t, slug, data)),
    deletePaymentLink:  (slug: string) =>
                          withToken(t => api.deletePaymentLink(t, slug)),
  }
}