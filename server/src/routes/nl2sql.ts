import { Router } from 'express'
import { z } from 'zod'
import { runNl2Sql } from '../nl2sql.js'

export const nl2sqlRouter = Router()

nl2sqlRouter.post('/query', async (req, res) => {
  const schema = z.object({ question: z.string().min(1) })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: 'Invalid body' })

  try {
    const { question } = parse.data
    const { sql, rows } = await runNl2Sql(question)
    res.json({ sql, rows })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' })
  }
})

// Simple test endpoint with a canned question
nl2sqlRouter.get('/test', async (_req, res) => {
  try {
    const q = 'List users who played Counter-Strike with their steamId and game name'
    const { sql, rows } = await runNl2Sql(q)
    res.json({ question: q, sql, rows })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' })
  }
})

