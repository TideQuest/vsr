import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const CreateItemSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  categoryId: z.number().int().positive().optional()
});

const UpdateItemSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  categoryId: z.number().int().positive().nullable().optional()
});

// GET /api/items - Get all items
router.get('/', async (req, res) => {
  try {
    const { categoryId } = req.query;

    const where = categoryId
      ? { categoryId: parseInt(categoryId as string) }
      : {};

    const items = await prisma.item.findMany({
      where,
      include: {
        category: true,
        _count: {
          select: {
            recommendations: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// GET /api/items/:id - Get single item
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const item = await prisma.item.findUnique({
      where: { id: parseInt(id) },
      include: {
        category: true,
        recommendations: {
          include: {
            recommendedItem: true
          },
          orderBy: [
            { rank: 'asc' },
            { score: 'desc' }
          ]
        }
      }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// POST /api/items - Create new item
router.post('/', async (req, res) => {
  try {
    const validatedData = CreateItemSchema.parse(req.body);

    const item = await prisma.item.create({
      data: validatedData,
      include: {
        category: true
      }
    });

    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// PUT /api/items/:id - Update item
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = UpdateItemSchema.parse(req.body);

    const item = await prisma.item.update({
      where: { id: parseInt(id) },
      data: validatedData,
      include: {
        category: true
      }
    });

    res.json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/items/:id - Delete item
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.item.delete({
      where: { id: parseInt(id) }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

export default router;