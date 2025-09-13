import { ChatOllama } from '@langchain/ollama'
import { prisma } from './db.js'
import { extractSql, isSelectOnly } from './utils/sql.js'

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://ollama:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral:7b-instruct-q4_K_M'

const system = `You are a strict SQL translator.\n\n- Task: Convert the user question into a single, valid PostgreSQL SELECT query.\n- Output: Only the SQL. No prose. No explanations.\n- Schema:\n  tables: users(id, walletAddress, steamId, createdAt),\n          games(id, name, slug, createdAt),\n          proofs(id, userId, gameId, provider, verified, proofJson, claimedAt, createdAt)\n  relationships: proofs.userId -> users.id, proofs.gameId -> games.id\n- Rules:\n  * Prefer searching games by games.name or games.slug.\n  * Only use SELECT (and optional WITH). No mutations.\n  * Always alias columns clearly.\n  * Limit to 50 rows unless the question demands otherwise.`

const chat = new ChatOllama({
  baseUrl: OLLAMA_BASE_URL,
  model: OLLAMA_MODEL,
  temperature: 0.2,
  numCtx: 2048
})

export async function runNl2Sql(question: string): Promise<{ sql: string; rows: unknown[] }>{
  const prompt = [
    { role: 'system', content: system },
    { role: 'user', content: question }
  ] as any

  const res = await chat.invoke(prompt)
  const text = typeof res.content === 'string' ? res.content : String(res.content)
  const sql = extractSql(text)

  if (!isSelectOnly(sql)) {
    throw new Error('Generated SQL is not a safe SELECT query')
  }

  // Execute through Prisma as a raw, but guardrail above restricts to SELECT
  const rows = await prisma.$queryRawUnsafe(sql)
  return { sql, rows: rows as unknown[] }
}

