import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/clients - List all clients
router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const result = await query('SELECT id, name FROM clients ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// POST /api/clients - Create client (admin/manager only)
router.post('/', authenticateToken, requireRole('admin', 'manager'), async (req, res, next) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Client name is required' });
        }

        const id = 'c-' + Date.now();
        await query('INSERT INTO clients (id, name) VALUES ($1, $2)', [id, name]);

        res.status(201).json({ id, name });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/clients/:id - Delete client (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM clients WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        res.json({ message: 'Client deleted' });
    } catch (err) {
        next(err);
    }
});

export default router;
