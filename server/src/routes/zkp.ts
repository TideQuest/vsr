import { Router } from 'express'
import { z } from 'zod'
import { createProofRequest, ProofSchema, verifyProof, createSteamProof, verifySteamProof } from '../reclaim.js'
import { prisma } from '../db.js'

export const zkpRouter = Router()

// Schema for Steam proof request
const SteamProofRequestSchema = z.object({
  steamId: z.string(),
  userDataUrl: z.string().url(),
  cookieStr: z.string(),
  targetAppId: z.string().optional()
})

// Schema for Steam proof verification
const SteamProofVerifySchema = z.object({
  proof: z.any(),
  steamId: z.string(),
  targetAppId: z.string().optional()
})

zkpRouter.post('/request', async (req, res) => {
  try {
    const { providerId } = (req.body || {}) as { providerId?: string }
    const r = await createProofRequest({ providerId })
    res.json(r)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' })
  }
})

zkpRouter.post('/verify', async (req, res) => {
  const parse = ProofSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: 'Invalid proof' })

  try {
    const result = await verifyProof(parse.data)
    // Optionally persist a proof row (mock association)
    const user = await prisma.user.upsert({
      where: { steamId: 'STEAM_' + (parse.data.sessionId || 'unknown') },
      update: {},
      create: { steamId: 'STEAM_' + (parse.data.sessionId || 'unknown') }
    })
    const game = await prisma.game.findFirst({ where: { slug: 'counter-strike' } })
    await prisma.proof.create({
      data: {
        userId: user.id,
        gameId: game?.id,
        provider: parse.data.provider,
        verified: result.verified,
        proofJson: parse.data.payload
      }
    })
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' })
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

// Steam-specific endpoints
zkpRouter.post('/steam/proof', async (req, res) => {
  const parse = SteamProofRequestSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request parameters',
      details: parse.error.issues
    })
  }

  try {
    console.log('Creating Steam proof for:', parse.data.steamId)
    const result = await createSteamProof(parse.data)

    // Store proof request in database (optional)
    if (!process.env.ZKP_MOCK || process.env.ZKP_MOCK === 'false') {
      const user = await prisma.user.upsert({
        where: { steamId: parse.data.steamId },
        update: {},
        create: { steamId: parse.data.steamId }
      })

      // Log the proof request
      console.log(`Proof created for user ${user.id} (${parse.data.steamId})`)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Steam proof creation failed:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create proof'
    })
  }
})

zkpRouter.post('/steam/verify', async (req, res) => {
  const parse = SteamProofVerifySchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid verification parameters',
      details: parse.error.issues
    })
  }

  try {
    console.log('Verifying Steam proof for:', parse.data.steamId)
    const result = await verifySteamProof(parse.data.proof)

    if (result.verified) {
      // Store verified proof in database
      const user = await prisma.user.upsert({
        where: { steamId: parse.data.steamId },
        update: {},
        create: { steamId: parse.data.steamId }
      })

      // Find game if targetAppId provided
      let gameId = null
      if (parse.data.targetAppId) {
        const game = await prisma.game.findFirst({
          where: { appId: parse.data.targetAppId }
        })
        gameId = game?.id
      }

      await prisma.proof.create({
        data: {
          userId: user.id,
          gameId: gameId,
          provider: 'steam',
          verified: true,
          proofJson: parse.data.proof
        }
      })

      console.log(`Proof verified and stored for user ${user.id}`)
    }

    res.json({
      success: result.verified,
      ...result
    })
  } catch (error: any) {
    console.error('Steam proof verification failed:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify proof'
    })
  }
})

