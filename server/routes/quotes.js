import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All quote routes require at least manager role
router.use(authenticateToken);
router.use(requireRole('admin', 'manager'));

// List all quotes with their items
router.get('/', async (req, res, next) => {
    try {
        // Get all quotes
        const quotesResult = await query(
            `SELECT 
                id, 
                client_id as "clientId", 
                client_name as "clientName", 
                payment_terms as "paymentTerms", 
                discount, 
                status, 
                expiration_date as "expirationDate", 
                notes,
                EXTRACT(EPOCH FROM created_at) * 1000 as "createdAt",
                EXTRACT(EPOCH FROM updated_at) * 1000 as "updatedAt"
            FROM quotes 
            ORDER BY created_at DESC`
        );

        // Get all quote items
        const itemsResult = await query(
            `SELECT 
                id,
                quote_id as "quoteId",
                product_id as "productId",
                product_name as "productName",
                quantity,
                unit_price as "unitPrice",
                discount
            FROM quote_items
            ORDER BY created_at ASC`
        );

        // Group items by quote
        const itemsByQuote = {};
        itemsResult.rows.forEach(item => {
            if (!itemsByQuote[item.quoteId]) {
                itemsByQuote[item.quoteId] = [];
            }
            itemsByQuote[item.quoteId].push(item);
        });

        // Attach items to quotes
        const quotes = quotesResult.rows.map(quote => ({
            ...quote,
            items: itemsByQuote[quote.id] || []
        }));

        res.json(quotes);
    } catch (err) {
        next(err);
    }
});

// Create quote with items
router.post('/', async (req, res, next) => {
    const { clientId, clientName, items, paymentTerms, discount, status, expirationDate, notes } = req.body;

    if (!clientId || !clientName || !items || items.length === 0 || !expirationDate) {
        return res.status(400).json({ error: 'Client, items, and expiration date are required' });
    }

    try {
        const quoteId = 'q-' + Date.now();

        // Insert quote
        const quoteResult = await query(
            `INSERT INTO quotes (id, client_id, client_name, payment_terms, discount, status, expiration_date, notes) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             RETURNING 
                id, 
                client_id as "clientId", 
                client_name as "clientName", 
                payment_terms as "paymentTerms", 
                discount, 
                status, 
                expiration_date as "expirationDate", 
                notes,
                EXTRACT(EPOCH FROM created_at) * 1000 as "createdAt",
                EXTRACT(EPOCH FROM updated_at) * 1000 as "updatedAt"`,
            [quoteId, clientId, clientName, paymentTerms || 'immediate', discount || 0, status || 'quoted', expirationDate, notes]
        );

        // Insert quote items
        const createdItems = [];
        for (const item of items) {
            const itemId = 'qi-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const itemResult = await query(
                `INSERT INTO quote_items (id, quote_id, product_id, product_name, quantity, unit_price, discount) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7) 
                 RETURNING 
                    id,
                    quote_id as "quoteId",
                    product_id as "productId",
                    product_name as "productName",
                    quantity,
                    unit_price as "unitPrice",
                    discount`,
                [itemId, quoteId, item.productId, item.productName, item.quantity, item.unitPrice, item.discount || 0]
            );
            createdItems.push(itemResult.rows[0]);
        }

        const quote = {
            ...quoteResult.rows[0],
            items: createdItems
        };

        res.status(201).json(quote);
    } catch (err) {
        next(err);
    }
});

// Update quote
router.put('/:id', async (req, res, next) => {
    const { id } = req.params;
    const { clientId, clientName, items, paymentTerms, discount, status, expirationDate, notes } = req.body;

    try {
        // Update quote
        const quoteResult = await query(
            `UPDATE quotes 
             SET client_id = COALESCE($1, client_id),
                 client_name = COALESCE($2, client_name),
                 payment_terms = COALESCE($3, payment_terms),
                 discount = COALESCE($4, discount),
                 status = COALESCE($5, status),
                 expiration_date = COALESCE($6, expiration_date),
                 notes = COALESCE($7, notes),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $8 
             RETURNING 
                id, 
                client_id as "clientId", 
                client_name as "clientName", 
                payment_terms as "paymentTerms", 
                discount, 
                status, 
                expiration_date as "expirationDate", 
                notes,
                EXTRACT(EPOCH FROM created_at) * 1000 as "createdAt",
                EXTRACT(EPOCH FROM updated_at) * 1000 as "updatedAt"`,
            [clientId, clientName, paymentTerms, discount, status, expirationDate, notes, id]
        );

        if (quoteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Quote not found' });
        }

        // If items are provided, update them
        let updatedItems = [];
        if (items) {
            // Delete existing items
            await query('DELETE FROM quote_items WHERE quote_id = $1', [id]);

            // Insert new items
            for (const item of items) {
                const itemId = 'qi-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                const itemResult = await query(
                    `INSERT INTO quote_items (id, quote_id, product_id, product_name, quantity, unit_price, discount) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7) 
                     RETURNING 
                        id,
                        quote_id as "quoteId",
                        product_id as "productId",
                        product_name as "productName",
                        quantity,
                        unit_price as "unitPrice",
                        discount`,
                    [itemId, id, item.productId, item.productName, item.quantity, item.unitPrice, item.discount || 0]
                );
                updatedItems.push(itemResult.rows[0]);
            }
        } else {
            // Fetch existing items
            const itemsResult = await query(
                `SELECT 
                    id,
                    quote_id as "quoteId",
                    product_id as "productId",
                    product_name as "productName",
                    quantity,
                    unit_price as "unitPrice",
                    discount
                FROM quote_items
                WHERE quote_id = $1`,
                [id]
            );
            updatedItems = itemsResult.rows;
        }

        const quote = {
            ...quoteResult.rows[0],
            items: updatedItems
        };

        res.json(quote);
    } catch (err) {
        next(err);
    }
});

// Delete quote
router.delete('/:id', async (req, res, next) => {
    const { id } = req.params;

    try {
        // Items will be deleted automatically via CASCADE
        const result = await query('DELETE FROM quotes WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Quote not found' });
        }

        res.status(204).send();
    } catch (err) {
        next(err);
    }
});

export default router;
