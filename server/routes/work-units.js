import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Helper to fetch unit with managers and user count
const fetchUnitDetails = async (unitId) => {
    const result = await query(`
        SELECT w.*,
            (
                SELECT COALESCE(json_agg(json_build_object('id', u.id, 'name', u.name)), '[]')
                FROM work_unit_managers wum
                JOIN users u ON wum.user_id = u.id
                WHERE wum.work_unit_id = w.id
            ) as managers,
            (SELECT COUNT(*) FROM user_work_units uw WHERE uw.work_unit_id = w.id) as user_count
        FROM work_units w
        WHERE w.id = $1
    `, [unitId]);
    return result.rows[0];
};

// GET /api/work-units - List work units
router.get('/', authenticateToken, async (req, res, next) => {
    try {
        let result;
        if (req.user.role === 'admin') {
            result = await query(`
                SELECT w.*,
                    (
                        SELECT COALESCE(json_agg(json_build_object('id', u.id, 'name', u.name)), '[]')
                        FROM work_unit_managers wum
                        JOIN users u ON wum.user_id = u.id
                        WHERE wum.work_unit_id = w.id
                    ) as managers,
                    (SELECT COUNT(*) FROM user_work_units uw WHERE uw.work_unit_id = w.id) as user_count
                FROM work_units w
                ORDER BY w.name
            `);
        } else if (req.user.role === 'manager') {
            result = await query(`
                SELECT w.*,
                    (
                        SELECT COALESCE(json_agg(json_build_object('id', u.id, 'name', u.name)), '[]')
                        FROM work_unit_managers wum
                        JOIN users u ON wum.user_id = u.id
                        WHERE wum.work_unit_id = w.id
                    ) as managers,
                    (SELECT COUNT(*) FROM user_work_units uw WHERE uw.work_unit_id = w.id) as user_count
                FROM work_units w
                WHERE EXISTS (
                    SELECT 1 FROM work_unit_managers wum 
                    WHERE wum.work_unit_id = w.id AND wum.user_id = $1
                )
                ORDER BY w.name
            `, [req.user.id]);
        } else {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const workUnits = result.rows.map(w => ({
            id: w.id,
            name: w.name,
            managers: w.managers,
            description: w.description,
            isDisabled: !!w.is_disabled,
            userCount: parseInt(w.user_count)
        }));

        res.json(workUnits);
    } catch (err) {
        next(err);
    }
});

// POST /api/work-units - Create work unit (Admin only)
router.post('/', authenticateToken, requireRole('admin'), async (req, res, next) => {
    try {
        const { name, managerIds, description } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        // managerIds is optional but if provided must be array
        const managers = Array.isArray(managerIds) ? managerIds : [];
        if (managers.length === 0) {
            return res.status(400).json({ error: 'At least one manager is required' });
        }

        await query('BEGIN');

        const id = 'wu-' + Date.now();
        await query(
            'INSERT INTO work_units (id, name, description) VALUES ($1, $2, $3)',
            [id, name, description]
        );

        for (const managerId of managers) {
            await query(
                'INSERT INTO work_unit_managers (work_unit_id, user_id) VALUES ($1, $2)',
                [id, managerId]
            );
        }

        await query('COMMIT');

        const w = await fetchUnitDetails(id);
        res.status(201).json({
            id: w.id,
            name: w.name,
            managers: w.managers,
            description: w.description,
            isDisabled: !!w.is_disabled,
            userCount: 0
        });
    } catch (err) {
        await query('ROLLBACK');
        next(err);
    }
});

// PUT /api/work-units/:id - Update work unit (Admin only)
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, managerIds, description, isDisabled } = req.body;

        await query('BEGIN');

        // Update basic fields
        if (name !== undefined || description !== undefined || isDisabled !== undefined) {
            const updates = [];
            const values = [];
            let paramIdx = 1;

            if (name !== undefined) {
                updates.push(`name = $${paramIdx++}`);
                values.push(name);
            }
            if (description !== undefined) {
                updates.push(`description = $${paramIdx++}`);
                values.push(description);
            }
            if (isDisabled !== undefined) {
                updates.push(`is_disabled = $${paramIdx++}`);
                values.push(isDisabled);
            }

            if (updates.length > 0) {
                values.push(id);
                const result = await query(
                    `UPDATE work_units SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING id`,
                    values
                );
                if (result.rows.length === 0) {
                    await query('ROLLBACK');
                    return res.status(404).json({ error: 'Work unit not found' });
                }
            }
        }

        // Update managers if provided
        if (managerIds !== undefined) {
            if (!Array.isArray(managerIds)) {
                await query('ROLLBACK');
                return res.status(400).json({ error: 'managerIds must be an array' });
            }

            // Delete existing
            await query('DELETE FROM work_unit_managers WHERE work_unit_id = $1', [id]);

            // Insert new
            for (const managerId of managerIds) {
                await query(
                    'INSERT INTO work_unit_managers (work_unit_id, user_id) VALUES ($1, $2)',
                    [id, managerId]
                );
            }
        }

        await query('COMMIT');

        const w = await fetchUnitDetails(id);
        if (!w) return res.status(404).json({ error: 'Work unit not found' });

        res.json({
            id: w.id,
            name: w.name,
            managers: w.managers,
            description: w.description,
            isDisabled: !!w.is_disabled,
            userCount: parseInt(w.user_count)
        });
    } catch (err) {
        await query('ROLLBACK');
        next(err);
    }
});

// DELETE /api/work-units/:id - Delete work unit (Admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM work_units WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Work unit not found' });
        }

        res.json({ message: 'Work unit deleted' });
    } catch (err) {
        next(err);
    }
});

// GET /api/work-units/:id/users - Get users in work unit
router.get('/:id/users', authenticateToken, async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check permissions
        if (req.user.role !== 'admin') {
            // Check if user is a manager of this unit
            const check = await query(
                'SELECT 1 FROM work_unit_managers WHERE work_unit_id = $1 AND user_id = $2',
                [id, req.user.id]
            );
            if (check.rows.length === 0) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        const result = await query(`
            SELECT u.id 
            FROM user_work_units uw
            JOIN users u ON uw.user_id = u.id
            WHERE uw.work_unit_id = $1
        `, [id]);

        res.json(result.rows.map(r => r.id));
    } catch (err) {
        next(err);
    }
});

// POST /api/work-units/:id/users - Update users in work unit (Admin only)
router.post('/:id/users', authenticateToken, requireRole('admin'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { userIds } = req.body;

        if (!Array.isArray(userIds)) {
            return res.status(400).json({ error: 'userIds must be an array' });
        }

        await query('BEGIN');
        await query('DELETE FROM user_work_units WHERE work_unit_id = $1', [id]);

        for (const userId of userIds) {
            await query(
                'INSERT INTO user_work_units (user_id, work_unit_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [userId, id]
            );
        }

        await query('COMMIT');
        res.json({ message: 'Work unit users updated' });
    } catch (err) {
        await query('ROLLBACK');
        next(err);
    }
});

export default router;
