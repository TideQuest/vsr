// Reclaim Protocol integration wrapper
// Uses mock mode by default (ZKP_MOCK=true) to keep local dev simple.
// Switch to real mode by setting RECLAIM_* env vars and ZKP_MOCK=false

import { z } from 'zod'

const ZKP_MOCK = String(process.env.ZKP_MOCK || 'true').toLowerCase() === 'true'

// Types
export const ProofSchema = z.object({
  sessionId: z.string().optional(),
  provider: z.string().default('steam'),
  payload: z.any()
})

export type ProofInput = z.infer<typeof ProofSchema>

export async function createProofRequest(params: {
  providerId?: string
  context?: Record<string, any>
}) {
  const providerId = params.providerId || process.env.RECLAIM_PROVIDER_ID
  if (!providerId) {
    // For mock, simply return a fake URL the UI can display
    return {
      mode: 'mock',
      requestUrl: 'https://reclaim.example/mock',
      sessionId: 'mock-session-' + Math.random().toString(36).slice(2)
    }
  }

  if (ZKP_MOCK) {
    return {
      mode: 'mock',
      requestUrl: 'https://reclaim.example/mock',
      sessionId: 'mock-session-' + Math.random().toString(36).slice(2)
    }
  }

  // Real (best-effort): create a request URL via @reclaimprotocol/js-sdk
  // NOTE: Real config depends on your Reclaim app setup.
  const { Reclaim } = await import('@reclaimprotocol/js-sdk')
  const appId = process.env.RECLAIM_APP_ID
  const appSecret = process.env.RECLAIM_APP_SECRET
  if (!appId || !appSecret) throw new Error('Missing RECLAIM_APP_ID/SECRET')

  const reclaimClient = new Reclaim()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const request = await reclaimClient.requestProofs(providerId as string, {
    context: params.context || {}
  } as any)

  return { mode: 'real', requestUrl: request.shortUrl, sessionId: request.sessionId }
}

export async function verifyProof(proof: ProofInput) {
  if (ZKP_MOCK) {
    return { verified: true, reason: 'mock-mode' }
  }

  const { verifyProof } = await import('@reclaimprotocol/js-sdk')
  const ok = await verifyProof(proof.payload)
  return { verified: !!ok, reason: ok ? 'verified' : 'invalid' }
}

