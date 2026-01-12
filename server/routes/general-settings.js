import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/general-settings - Get global settings (available to all authenticated users)
router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const result = await query('SELECT currency FROM general_settings WHERE id = 1');
        if (result.rows.length === 0) {
            return res.json({ currency: 'USD' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// PUT /api/general-settings - Update global settings (Admin only)
router.put('/', authenticateToken, requireRole('admin'), async (req, res, next) => {
    try {
        const { currency } = req.body;

        if (!currency) {
            return res.status(400).json({ error: 'Currency is required' });
        }

        const result = await query(
            'UPDATE general_settings SET currency = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1 RETURNING currency',
            [currency]
        );

        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

export default router;
