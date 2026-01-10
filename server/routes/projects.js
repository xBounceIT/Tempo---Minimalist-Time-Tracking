import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/projects - List all projects
router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const result = await query(
            `SELECT id, name, client_id, color, description 
       FROM projects ORDER BY name`
        );

        const projects = result.rows.map(p => ({
            id: p.id,
            name: p.name,
            clientId: p.client_id,
            color: p.color,
            description: p.description
        }));

        res.json(projects);
    } catch (err) {
        next(err);
    }
});

// POST /api/projects - Create project (admin/manager only)
router.post('/', authenticateToken, requireRole('admin', 'manager'), async (req, res, next) => {
    try {
        const { name, clientId, description, color } = req.body;

        if (!name || !clientId) {
            return res.status(400).json({ error: 'Project name and client ID are required' });
        }

        const id = 'p-' + Date.now();
        const projectColor = color || '#3b82f6';

        await query(
            `INSERT INTO projects (id, name, client_id, color, description) 
       VALUES ($1, $2, $3, $4, $5)`,
            [id, name, clientId, projectColor, description || null]
        );

        res.status(201).json({
            id,
            name,
            clientId,
            color: projectColor,
            description
        });
    } catch (err) {
        if (err.code === '23503') { // Foreign key violation
            return res.status(400).json({ error: 'Client not found' });
        }
        next(err);
    }
});

// DELETE /api/projects/:id - Delete project (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM projects WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json({ message: 'Project deleted' });
    } catch (err) {
        next(err);
    }
});

export default router;
