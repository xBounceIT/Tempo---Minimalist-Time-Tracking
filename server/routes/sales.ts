import { query } from '../db/index.ts';
import { authenticateToken, requireRole } from '../middleware/auth.ts';
import { requireNonEmptyString, optionalNonEmptyString, parsePositiveNumber, parseNonNegativeNumber, optionalNonNegativeNumber, badRequest } from '../utils/validation.ts';

export default async function (fastify, opts) {
    // All sales routes require at least manager role
    fastify.addHook('onRequest', authenticateToken);
    fastify.addHook('onRequest', requireRole('admin', 'manager'));

    // GET / - List all sales with their items
    fastify.get('/', async (request, reply) => {
        // Get all sales
        const salesResult = await query(
            `SELECT 
                id, 
                linked_quote_id as "linkedQuoteId",
                client_id as "clientId", 
                client_name as "clientName", 
                payment_terms as "paymentTerms", 
                discount, 
                status, 
                notes,
                EXTRACT(EPOCH FROM created_at) * 1000 as "createdAt",
                EXTRACT(EPOCH FROM updated_at) * 1000 as "updatedAt"
            FROM sales 
            ORDER BY created_at DESC`
        );

        // Get all sale items
        const itemsResult = await query(
            `SELECT 
                id,
                sale_id as "saleId",
                product_id as "productId",
                product_name as "productName",
                quantity,
                unit_price as "unitPrice",
                discount
            FROM sale_items
            ORDER BY created_at ASC`
        );

        // Group items by sale
        const itemsBySale = {};
        itemsResult.rows.forEach(item => {
            if (!itemsBySale[item.saleId]) {
                itemsBySale[item.saleId] = [];
            }
            itemsBySale[item.saleId].push(item);
        });

        // Attach items to sales
        const sales = salesResult.rows.map(sale => ({
            ...sale,
            items: itemsBySale[sale.id] || []
        }));

        return sales;
    });

    // POST / - Create sale with items
    fastify.post('/', async (request, reply) => {
        const { linkedQuoteId, clientId, clientName, items, paymentTerms, discount, status, notes } = request.body;

        const clientIdResult = requireNonEmptyString(clientId, 'clientId');
        if (!clientIdResult.ok) return badRequest(reply, clientIdResult.message);

        const clientNameResult = requireNonEmptyString(clientName, 'clientName');
        if (!clientNameResult.ok) return badRequest(reply, clientNameResult.message);

        if (!Array.isArray(items) || items.length === 0) {
            return badRequest(reply, 'Items must be a non-empty array');
        }

        const normalizedItems = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const productNameResult = requireNonEmptyString(item.productName, `items[${i}].productName`);
            if (!productNameResult.ok) return badRequest(reply, productNameResult.message);
            const quantityResult = parsePositiveNumber(item.quantity, `items[${i}].quantity`);
            if (!quantityResult.ok) return badRequest(reply, quantityResult.message);
            const unitPriceResult = parseNonNegativeNumber(item.unitPrice, `items[${i}].unitPrice`);
            if (!unitPriceResult.ok) return badRequest(reply, unitPriceResult.message);
            normalizedItems.push({
                ...item,
                productName: productNameResult.value,
                quantity: quantityResult.value,
                unitPrice: unitPriceResult.value
            });
        }

        const discountResult = optionalNonNegativeNumber(discount, 'discount');
        if (!discountResult.ok) return badRequest(reply, discountResult.message);

        const saleId = 's-' + Date.now();

        try {
            // Insert sale
            const saleResult = await query(
                `INSERT INTO sales (id, linked_quote_id, client_id, client_name, payment_terms, discount, status, notes) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             RETURNING 
                id, 
                linked_quote_id as "linkedQuoteId",
                client_id as "clientId", 
                client_name as "clientName", 
                payment_terms as "paymentTerms", 
                discount, 
                status, 
                notes,
                EXTRACT(EPOCH FROM created_at) * 1000 as "createdAt",
                EXTRACT(EPOCH FROM updated_at) * 1000 as "updatedAt"`,
                [saleId, linkedQuoteId || null, clientIdResult.value, clientNameResult.value, paymentTerms || 'immediate', discountResult.value || 0, status || 'pending', notes]
            );

            // Insert sale items
            const createdItems = [];
            for (const item of normalizedItems) {
                const itemId = 'si-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                const itemResult = await query(
                    `INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, discount) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7) 
                 RETURNING 
                    id,
                    sale_id as "saleId",
                    product_id as "productId",
                    product_name as "productName",
                    quantity,
                    unit_price as "unitPrice",
                    discount`,
                    [itemId, saleId, item.productId, item.productName, item.quantity, item.unitPrice, item.discount || 0]
                );
                createdItems.push(itemResult.rows[0]);
            }

            return reply.code(201).send({
                ...saleResult.rows[0],
                items: createdItems
            });
        } catch (err) {
            throw err;
        }
    });

    // PUT /:id - Update sale
    fastify.put('/:id', async (request, reply) => {
        const { id } = request.params;
        const { clientId, clientName, items, paymentTerms, discount, status, notes } = request.body;
        const idResult = requireNonEmptyString(id, 'id');
        if (!idResult.ok) return badRequest(reply, idResult.message);

        let clientIdValue = clientId;
        if (clientId !== undefined) {
            const clientIdResult = optionalNonEmptyString(clientId, 'clientId');
            if (!clientIdResult.ok) return badRequest(reply, clientIdResult.message);
            clientIdValue = clientIdResult.value;
        }

        let clientNameValue = clientName;
        if (clientName !== undefined) {
            const clientNameResult = optionalNonEmptyString(clientName, 'clientName');
            if (!clientNameResult.ok) return badRequest(reply, clientNameResult.message);
            clientNameValue = clientNameResult.value;
        }

        let discountValue = discount;
        if (discount !== undefined) {
            const discountResult = optionalNonNegativeNumber(discount, 'discount');
            if (!discountResult.ok) return badRequest(reply, discountResult.message);
            discountValue = discountResult.value;
        }

        try {
            // Update sale
            const saleResult = await query(
                `UPDATE sales 
             SET client_id = COALESCE($1, client_id),
                 client_name = COALESCE($2, client_name),
                 payment_terms = COALESCE($3, payment_terms),
                 discount = COALESCE($4, discount),
                 status = COALESCE($5, status),
                 notes = COALESCE($6, notes),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $7 
             RETURNING 
                id, 
                linked_quote_id as "linkedQuoteId",
                client_id as "clientId", 
                client_name as "clientName", 
                payment_terms as "paymentTerms", 
                discount, 
                status, 
                notes,
                EXTRACT(EPOCH FROM created_at) * 1000 as "createdAt",
                EXTRACT(EPOCH FROM updated_at) * 1000 as "updatedAt"`,
                [clientIdValue, clientNameValue, paymentTerms, discountValue, status, notes, idResult.value]
            );

            if (saleResult.rows.length === 0) {
                return reply.code(404).send({ error: 'Sale not found' });
            }

            // If items are provided, update them
            let updatedItems = [];
            if (items) {
                if (!Array.isArray(items) || items.length === 0) {
                    return badRequest(reply, 'Items must be a non-empty array');
                }
                const normalizedItems = [];
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const productNameResult = requireNonEmptyString(item.productName, `items[${i}].productName`);
                    if (!productNameResult.ok) return badRequest(reply, productNameResult.message);
                    const quantityResult = parsePositiveNumber(item.quantity, `items[${i}].quantity`);
                    if (!quantityResult.ok) return badRequest(reply, quantityResult.message);
                    const unitPriceResult = parseNonNegativeNumber(item.unitPrice, `items[${i}].unitPrice`);
                    if (!unitPriceResult.ok) return badRequest(reply, unitPriceResult.message);
                    normalizedItems.push({
                        ...item,
                        productName: productNameResult.value,
                        quantity: quantityResult.value,
                        unitPrice: unitPriceResult.value
                    });
                }
                // Delete existing items
                await query('DELETE FROM sale_items WHERE sale_id = $1', [idResult.value]);

                // Insert new items
                for (const item of normalizedItems) {
                    const itemId = 'si-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                    const itemResult = await query(
                        `INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, discount) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7) 
                     RETURNING 
                        id,
                        sale_id as "saleId",
                        product_id as "productId",
                        product_name as "productName",
                        quantity,
                        unit_price as "unitPrice",
                        discount`,
                        [itemId, idResult.value, item.productId, item.productName, item.quantity, item.unitPrice, item.discount || 0]
                    );
                    updatedItems.push(itemResult.rows[0]);
                }
            } else {
                // Fetch existing items
                const itemsResult = await query(
                    `SELECT 
                    id,
                    sale_id as "saleId",
                    product_id as "productId",
                    product_name as "productName",
                    quantity,
                    unit_price as "unitPrice",
                    discount
                FROM sale_items
                WHERE sale_id = $1`,
                    [idResult.value]
                );
                updatedItems = itemsResult.rows;
            }

            return {
                ...saleResult.rows[0],
                items: updatedItems
            };
        } catch (err) {
            throw err;
        }
    });

    // DELETE /:id - Delete sale
    fastify.delete('/:id', async (request, reply) => {
        const { id } = request.params;
        const idResult = requireNonEmptyString(id, 'id');
        if (!idResult.ok) return badRequest(reply, idResult.message);

        // Items will be deleted automatically via CASCADE
        const result = await query('DELETE FROM sales WHERE id = $1 RETURNING id', [idResult.value]);

        if (result.rows.length === 0) {
            return reply.code(404).send({ error: 'Sale not found' });
        }

        return reply.code(204).send();
    });
}
