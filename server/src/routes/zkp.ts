import { Router } from 'express'
import { z } from 'zod'
import { createProofRequest, ProofSchema, verifyProof, isProofAlreadyVerified } from '../reclaim.js'
import { prisma } from '../db.js'
import { createRateLimiter } from '../middleware/rateLimiter.js'

export const zkpRouter = Router()

// Rate limiters for different endpoints
const requestLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 requests per minute
  message: 'Too many proof requests, please try again later'
})

const verifyLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 verifications per minute
  message: 'Too many verification attempts, please try again later'
})

zkpRouter.post('/request', requestLimiter, async (req, res) => {
  try {
    const { providerId } = (req.body || {}) as { providerId?: string }
    const r = await createProofRequest({ providerId })
    res.json(r)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' })
  }
})

zkpRouter.post('/verify', verifyLimiter, async (req, res) => {
  const parse = ProofSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      error: 'Invalid proof format',
      details: parse.error.flatten()
    })
  }

  try {
    // Check for duplicate proof if sessionId is provided
    if (parse.data.sessionId) {
      const isDuplicate = await isProofAlreadyVerified(
        parse.data.sessionId,
        async (sessionId) => prisma.proof.findUnique({ where: { sessionId } })
      )

      if (isDuplicate) {
        console.log(`[ZKP] Duplicate proof attempt for session: ${parse.data.sessionId}`)
        return res.status(409).json({
          error: 'Proof already verified',
          sessionId: parse.data.sessionId
        })
      }
    }

    // Verify the proof
    const result = await verifyProof(parse.data)

    // Only persist if verification succeeded
    if (result.verified) {
      // Create or update user
      const user = await prisma.user.upsert({
        where: { steamId: 'STEAM_' + (parse.data.sessionId || 'unknown') },
        update: { steamId: 'STEAM_' + (parse.data.sessionId || 'unknown') },
        create: { steamId: 'STEAM_' + (parse.data.sessionId || 'unknown') }
      })

      // Find game (optional)
      const game = await prisma.game.findFirst({ where: { slug: 'counter-strike' } })

      // Store proof with sessionId for duplicate prevention
      await prisma.proof.create({
        data: {
          userId: user.id,
          gameId: game?.id,
          provider: parse.data.provider,
          verified: result.verified,
          proofJson: parse.data.payload,
          sessionId: parse.data.sessionId || null
        }
      })

      console.log(`[ZKP] Proof verified and stored for user: ${user.id}`)
    } else {
      console.warn(`[ZKP] Proof verification failed: ${result.reason}`)
    }

    res.json(result)
  } catch (e: any) {
    console.error('[ZKP] Verification error:', e)

    // Check for unique constraint violation (duplicate sessionId)
    if (e.code === 'P2002' && e.meta?.target?.includes('sessionId')) {
      return res.status(409).json({
        error: 'Proof already verified',
        sessionId: parse.data.sessionId
      })
    }

    res.status(500).json({
      error: 'Verification failed',
      message: e?.message || 'Internal server error'
    })
  }
})

// Test helper: inserts a mock proof row
zkpRouter.post('/test/mock', async (_req, res) => {
  const u = await prisma.user.upsert({
    where: { steamId: 'STEAM_TEST' },
    update: {},
    create: { steamId: 'STEAM_TEST' }
  })
  const g = await prisma.game.findFirst({ where: { slug: 'counter-strike' } })
  const p = await prisma.proof.create({
    data: {
      userId: u.id,
      gameId: g?.id,
      provider: 'steam',
      verified: true,
      proofJson: { mock: true, inserted: true }
    }
  })
  res.json({ ok: true, proofId: p.id })
})

