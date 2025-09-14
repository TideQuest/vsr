// Reclaim Protocol integration wrapper
// Uses mock mode by default (ZKP_MOCK=true) to keep local dev simple.
// Switch to real mode by setting RECLAIM_* env vars and ZKP_MOCK=false

import { z } from 'zod'
import { ReclaimClient } from '@reclaimprotocol/zk-fetch'

// Check ZKP_MOCK at runtime instead of module load time
function isZkpMock(): boolean {
  return String(process.env.ZKP_MOCK || 'true').toLowerCase() === 'true'
}

// Types
export const ProofSchema = z.object({
  sessionId: z.string().optional(),
  provider: z.string().default('steam'),
  payload: z.any()
})

export type ProofInput = z.infer<typeof ProofSchema>

export interface VerificationResult {
  verified: boolean
  reason: string
  details?: {
    timestamp?: number
    provider?: string
    sessionId?: string
    error?: string
  }
}

export interface ProofRequestResult {
  mode: 'mock' | 'real'
  requestUrl: string
  sessionId: string
  expiresAt?: number
}

export async function createProofRequest(params: {
  providerId?: string
  context?: Record<string, any>
}): Promise<ProofRequestResult> {
  const providerId = params.providerId || process.env.RECLAIM_PROVIDER_ID

  if (!providerId || isZkpMock()) {
    const sessionId = 'mock-session-' + Math.random().toString(36).slice(2)
    console.log(`[Reclaim] Creating mock proof request: ${sessionId}`)
    return {
      mode: 'mock' as const,
      requestUrl: 'https://reclaim.example/mock',
      sessionId,
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
    }
  }

  try {
    // Real (best-effort): create a request URL via @reclaimprotocol/js-sdk
    const { default: Reclaim } = await import('@reclaimprotocol/js-sdk')
    const appId = process.env.RECLAIM_APP_ID
    const appSecret = process.env.RECLAIM_APP_SECRET

    if (!appId || !appSecret) {
      throw new Error('Missing RECLAIM_APP_ID or RECLAIM_APP_SECRET')
    }

    console.log(`[Reclaim] Creating real proof request for provider: ${providerId}`)

    const reclaimClient = new Reclaim()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const request = await reclaimClient.requestProofs(providerId as string, {
      context: params.context || {}
    } as any)

    return {
      mode: 'real' as const,
      requestUrl: request.shortUrl,
      sessionId: request.sessionId,
      expiresAt: Date.now() + 5 * 60 * 1000
    }
  } catch (error) {
    console.error('[Reclaim] Failed to create proof request:', error)
    throw new Error(`Failed to create proof request: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function verifyProof(proof: ProofInput): Promise<VerificationResult> {
  const startTime = Date.now()

  // Validate input
  if (!proof.payload) {
    console.error('[Reclaim] Missing proof payload')
    return {
      verified: false,
      reason: 'missing-payload',
      details: {
        error: 'Proof payload is required'
      }
    }
  }

  if (isZkpMock()) {
    console.log(`[Reclaim] Mock verification for session: ${proof.sessionId}`)
    // Simulate verification delay
    await new Promise(resolve => setTimeout(resolve, 100))

    // Mock can randomly fail for testing
    const mockSuccess = Math.random() > 0.1
    return {
      verified: mockSuccess,
      reason: mockSuccess ? 'mock-verified' : 'mock-rejected',
      details: {
        timestamp: Date.now(),
        provider: proof.provider,
        sessionId: proof.sessionId
      }
    }
  }

  try {
    console.log(`[Reclaim] Starting verification for session: ${proof.sessionId}`)

    const { verifyProof: sdkVerifyProof } = await import('@reclaimprotocol/js-sdk')
    const isValid = await sdkVerifyProof(proof.payload)

    const duration = Date.now() - startTime
    console.log(`[Reclaim] Verification completed in ${duration}ms - Result: ${isValid}`)

    return {
      verified: !!isValid,
      reason: isValid ? 'verified' : 'invalid-proof',
      details: {
        timestamp: Date.now(),
        provider: proof.provider,
        sessionId: proof.sessionId
      }
    }
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Reclaim] Verification failed after ${duration}ms:`, error)

    return {
      verified: false,
      reason: 'verification-error',
      details: {
        timestamp: Date.now(),
        provider: proof.provider,
        sessionId: proof.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// Helper function to check if a proof has already been verified
export async function isProofAlreadyVerified(
  sessionId: string,
  getProofBySessionId: (sessionId: string) => Promise<any>
): Promise<boolean> {
  if (!sessionId) return false

  try {
    const existingProof = await getProofBySessionId(sessionId)
    return !!existingProof
  } catch {
    return false
  }
}

// Steam-specific proof generation using zkFetch
export async function createSteamProof(params: {
  steamId: string
  userDataUrl: string
  cookieStr: string
  targetAppId?: string
}) {
  // Check required environment variables
  const appId = process.env.RECLAIM_APP_ID
  const appSecret = process.env.RECLAIM_APP_SECRET

  if (!appId || !appSecret) {
    if (isZkpMock()) {
      // Return mock proof for development
      return {
        success: true,
        mode: 'mock',
        proof: {
          sessionId: 'mock-session-' + Math.random().toString(36).slice(2),
          steamId: params.steamId,
          targetAppId: params.targetAppId,
          timestamp: Date.now(),
          verified: true
        }
      }
    }
    throw new Error('Missing RECLAIM_APP_ID or RECLAIM_APP_SECRET environment variables')
  }

  try {
    // Initialize Reclaim client
    const client = new ReclaimClient(appId, appSecret)

    // Build regex to match Steam owned apps
    let regex = '"rgOwnedApps":\\s*\\[[^\\]]*'
    if (params.targetAppId) {
      regex += `\\b${params.targetAppId}\\b`
    }
    regex += '[^\\]]*\\]'

    console.log('Creating Steam proof with regex:', regex)

    // Generate proof using zkFetch
    const proof = await client.zkFetch(
      params.userDataUrl,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cookie': params.cookieStr
        }
      },
      {
        responseMatches: [{
          type: 'regex',
          value: regex
        }]
      }
    )

    return {
      success: true,
      mode: 'real',
      proof: proof,
      steamId: params.steamId,
      targetAppId: params.targetAppId,
      timestamp: Date.now()
    }
  } catch (error: any) {
    console.error('Failed to create Steam proof:', error)
    throw new Error(`Failed to create Steam proof: ${error.message || 'Unknown error'}`)
  }
}

// Verify Steam proof
export async function verifySteamProof(proof: any) {
  if (isZkpMock()) {
    return {
      verified: true,
      reason: 'mock-mode',
      steamId: proof.steamId,
      targetAppId: proof.targetAppId
    }
  }

  try {
    // Use Reclaim SDK to verify the proof
    const { verifyProof } = await import('@reclaimprotocol/js-sdk')
    const isValid = await verifyProof(proof)

    return {
      verified: !!isValid,
      reason: isValid ? 'verified' : 'invalid',
      steamId: proof.steamId,
      targetAppId: proof.targetAppId
    }
  } catch (error: any) {
    console.error('Failed to verify Steam proof:', error)
    return {
      verified: false,
      reason: `verification-error: ${error.message}`,
      steamId: proof.steamId,
      targetAppId: proof.targetAppId
    }
  }
}

