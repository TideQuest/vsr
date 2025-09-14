import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

// NOTE: Updated to match current Prisma schema (Item IDs are strings; games via ItemSteamGame)

const router = Router()
const prisma = new PrismaClient()

// GET /api/items - List items (games) with Steam details
router.get('/', async (_req, res) => {
  try {
    const items = await prisma.item.findMany({
      include: {
        steamGameDetails: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(items)
  } catch (error) {
    console.error('Error fetching items:', error)
    res.status(500).json({ error: 'Failed to fetch items' })
  }
})

export default router
