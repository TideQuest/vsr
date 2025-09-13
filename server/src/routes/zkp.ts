import { Router } from 'express'
import { z } from 'zod'
import { createProofRequest, ProofSchema, verifyProof } from '../reclaim.js'
import { prisma } from '../db.js'

export const zkpRouter = Router()

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

