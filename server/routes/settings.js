import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/settings - Get current user's settings
router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const result = await query(
            `SELECT full_name, email, compact_view
       FROM settings WHERE user_id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            // Create default settings if none exist
            await query(
                `INSERT INTO settings (user_id, full_name, email)
         VALUES ($1, $2, $3)`,
                [req.user.id, req.user.name, `${req.user.username}@example.com`]
            );

            return res.json({
                fullName: req.user.name,
                email: `${req.user.username}@example.com`,
                compactView: false
            });
        }

        const s = result.rows[0];
        res.json({
            fullName: s.full_name,
            email: s.email,
            compactView: s.compact_view
        });
    } catch (err) {
        next(err);
    }
});

// PUT /api/settings - Update settings
router.put('/', authenticateToken, async (req, res, next) => {
    try {
        const { fullName, email, compactView } = req.body;

        const result = await query(
            `INSERT INTO settings (user_id, full_name, email, compact_view)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         full_name = COALESCE($2, settings.full_name),
         email = COALESCE($3, settings.email),
         compact_view = COALESCE($4, settings.compact_view),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
            [req.user.id, fullName, email, compactView]
        );

        const s = result.rows[0];
        res.json({
            fullName: s.full_name,
            email: s.email,
            compactView: s.compact_view
        });
    } catch (err) {
        next(err);
    }
});

export default router;
