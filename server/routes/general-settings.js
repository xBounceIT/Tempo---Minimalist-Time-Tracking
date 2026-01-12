import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/general-settings - Get global settings (available to all authenticated users)
router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const result = await query('SELECT currency, daily_limit, start_of_week, treat_saturday_as_holiday, enable_ai_insights FROM general_settings WHERE id = 1');
        if (result.rows.length === 0) {
            return res.json({
                currency: 'USD',
                dailyLimit: 8.00,
                startOfWeek: 'Monday',
                treatSaturdayAsHoliday: true,
                enableAiInsights: true
            });
        }
        const s = result.rows[0];
        res.json({
            currency: s.currency,
            dailyLimit: parseFloat(s.daily_limit),
            startOfWeek: s.start_of_week,
            treatSaturdayAsHoliday: s.treat_saturday_as_holiday,
            enableAiInsights: s.enable_ai_insights
        });
    } catch (err) {
        next(err);
    }
});

// PUT /api/general-settings - Update global settings (Admin only)
router.put('/', authenticateToken, requireRole('admin'), async (req, res, next) => {
    try {
        const { currency, dailyLimit, startOfWeek, treatSaturdayAsHoliday, enableAiInsights } = req.body;

        const result = await query(
            `UPDATE general_settings 
             SET currency = COALESCE($1, currency),
                 daily_limit = COALESCE($2, daily_limit),
                 start_of_week = COALESCE($3, start_of_week),
                 treat_saturday_as_holiday = COALESCE($4, treat_saturday_as_holiday),
                 enable_ai_insights = COALESCE($5, enable_ai_insights),
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = 1 
             RETURNING currency, daily_limit, start_of_week, treat_saturday_as_holiday, enable_ai_insights`,
            [currency, dailyLimit, startOfWeek, treatSaturdayAsHoliday, enableAiInsights]
        );

        const s = result.rows[0];
        res.json({
            currency: s.currency,
            dailyLimit: parseFloat(s.daily_limit),
            startOfWeek: s.start_of_week,
            treatSaturdayAsHoliday: s.treat_saturday_as_holiday,
            enableAiInsights: s.enable_ai_insights
        });
    } catch (err) {
        next(err);
    }
});

export default router;
