import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const CreateRecommendationSchema = z.object({
  itemId: z.number().int().positive(),
  recommendedItemId: z.number().int().positive(),
  score: z.number().min(0).max(1).optional(),
  rank: z.number().int().min(0).optional()
});

const UpdateRecommendationSchema = z.object({
  score: z.number().min(0).max(1).optional(),
  rank: z.number().int().min(0).optional()
});

const BulkCreateRecommendationSchema = z.object({
  itemId: z.number().int().positive(),
  recommendations: z.array(z.object({
    recommendedItemId: z.number().int().positive(),
    score: z.number().min(0).max(1).optional(),
    rank: z.number().int().min(0).optional()
  }))
});

// GET /api/recommendations - Get all recommendations
router.get('/', async (req, res) => {
  try {
    const { itemId, minScore } = req.query;

    const where: any = {};
    if (itemId) where.itemId = parseInt(itemId as string);
    if (minScore) where.score = { gte: parseFloat(minScore as string) };

    const recommendations = await prisma.recommendation.findMany({
      where,
      include: {
        item: true,
        recommendedItem: true
      },
      orderBy: [
        { itemId: 'asc' },
        { rank: 'asc' },
        { score: 'desc' }
      ]
    });

    res.json(recommendations);
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// GET /api/recommendations/item/:itemId - Get recommendations for specific item
router.get('/item/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { limit = 10 } = req.query;

    const recommendations = await prisma.recommendation.findMany({
      where: { itemId: parseInt(itemId) },
      include: {
        recommendedItem: {
          include: {
            category: true
          }
        }
      },
      orderBy: [
        { rank: 'asc' },
        { score: 'desc' }
      ],
      take: parseInt(limit as string)
    });

    res.json(recommendations);
  } catch (error) {
    console.error('Error fetching item recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch item recommendations' });
  }
});

// GET /api/recommendations/:id - Get single recommendation
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const recommendation = await prisma.recommendation.findUnique({
      where: { id: parseInt(id) },
      include: {
        item: true,
        recommendedItem: true
      }
    });

    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    res.json(recommendation);
  } catch (error) {
    console.error('Error fetching recommendation:', error);
    res.status(500).json({ error: 'Failed to fetch recommendation' });
  }
});

// POST /api/recommendations - Create new recommendation
router.post('/', async (req, res) => {
  try {
    const validatedData = CreateRecommendationSchema.parse(req.body);

    // Check if both items exist
    const [item, recommendedItem] = await Promise.all([
      prisma.item.findUnique({ where: { id: validatedData.itemId } }),
      prisma.item.findUnique({ where: { id: validatedData.recommendedItemId } })
    ]);

    if (!item || !recommendedItem) {
      return res.status(400).json({ error: 'Invalid item or recommended item ID' });
    }

    // Check for self-recommendation
    if (validatedData.itemId === validatedData.recommendedItemId) {
      return res.status(400).json({ error: 'Cannot recommend item to itself' });
    }

    const recommendation = await prisma.recommendation.create({
      data: validatedData,
      include: {
        item: true,
        recommendedItem: true
      }
    });

    res.status(201).json(recommendation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    console.error('Error creating recommendation:', error);
    res.status(500).json({ error: 'Failed to create recommendation' });
  }
});

// POST /api/recommendations/bulk - Create multiple recommendations
router.post('/bulk', async (req, res) => {
  try {
    const validatedData = BulkCreateRecommendationSchema.parse(req.body);

    // Check if item exists
    const item = await prisma.item.findUnique({
      where: { id: validatedData.itemId }
    });

    if (!item) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    // Check if all recommended items exist
    const recommendedItemIds = validatedData.recommendations.map(r => r.recommendedItemId);
    const existingItems = await prisma.item.findMany({
      where: { id: { in: recommendedItemIds } }
    });

    if (existingItems.length !== recommendedItemIds.length) {
      return res.status(400).json({ error: 'Some recommended items do not exist' });
    }

    // Filter out self-recommendations
    const validRecommendations = validatedData.recommendations.filter(
      r => r.recommendedItemId !== validatedData.itemId
    );

    // Create all recommendations
    const recommendations = await prisma.recommendation.createMany({
      data: validRecommendations.map(r => ({
        itemId: validatedData.itemId,
        ...r
      })),
      skipDuplicates: true
    });

    res.status(201).json({
      created: recommendations.count,
      itemId: validatedData.itemId
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    console.error('Error creating bulk recommendations:', error);
    res.status(500).json({ error: 'Failed to create bulk recommendations' });
  }
});

// PUT /api/recommendations/:id - Update recommendation
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = UpdateRecommendationSchema.parse(req.body);

    const recommendation = await prisma.recommendation.update({
      where: { id: parseInt(id) },
      data: validatedData,
      include: {
        item: true,
        recommendedItem: true
      }
    });

    res.json(recommendation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    console.error('Error updating recommendation:', error);
    res.status(500).json({ error: 'Failed to update recommendation' });
  }
});

// DELETE /api/recommendations/:id - Delete recommendation
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.recommendation.delete({
      where: { id: parseInt(id) }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting recommendation:', error);
    res.status(500).json({ error: 'Failed to delete recommendation' });
  }
});

// DELETE /api/recommendations/item/:itemId - Delete all recommendations for an item
router.delete('/item/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    const result = await prisma.recommendation.deleteMany({
      where: { itemId: parseInt(itemId) }
    });

    res.json({ deleted: result.count });
  } catch (error) {
    console.error('Error deleting item recommendations:', error);
    res.status(500).json({ error: 'Failed to delete item recommendations' });
  }
});

export default router;