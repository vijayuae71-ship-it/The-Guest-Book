import { Router } from 'express';
import { getAllTemplates, getTemplateById, getTemplatesByCategory } from '../db.js';

const router = Router();

// GET / - List all templates
router.get('/', (req, res) => {
  try {
    const { category } = req.query;
    const templates = category ? getTemplatesByCategory(category) : getAllTemplates();
    return res.json({ templates });
  } catch (err) {
    console.error('Error fetching templates:', err);
    return res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// GET /:id - Get template by ID
router.get('/:id', (req, res) => {
  try {
    const template = getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    return res.json({ template });
  } catch (err) {
    console.error('Error fetching template:', err);
    return res.status(500).json({ error: 'Failed to fetch template' });
  }
});

export default router;
