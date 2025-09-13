/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const count = await prisma.game.count()
  if (count > 0) {
    console.log('[seed] Games already exist, skipping')
    return
  }

  const games = [
    { name: 'Counter-Strike 2', slug: 'counter-strike' },
    { name: 'Dota 2', slug: 'dota-2' },
    { name: 'Baldur\'s Gate 3', slug: 'baldurs-gate-3' }
  ]

  await prisma.game.createMany({ data: games })

  const user = await prisma.user.upsert({
    where: { steamId: 'STEAM_12345' },
    update: {},
    create: { steamId: 'STEAM_12345', walletAddress: null }
  })

  const cs = await prisma.game.findUnique({ where: { slug: 'counter-strike' } })

  if (cs) {
    await prisma.proof.create({
      data: {
        userId: user.id,
        gameId: cs.id,
        provider: 'steam',
        verified: true,
        proofJson: { mock: true, reason: 'seed data' }
      }
    })
  }

  console.log('[seed] Seeded initial data')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

