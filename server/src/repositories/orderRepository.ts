import type { AppDatabase } from "../db/connection.js";

export interface OrderRecord {
    id: string;
    user_id: string;
    order_type: string;
    total_price: number;
    bank_ids_json: string;
    status: string;
    created_at: string;
}

export function createOrder(
    db: AppDatabase,
    params: {
        id: string;
        userId: string;
        orderType: string;
        totalPrice: number;
        bankIds: string[];
    }
): void {
    db.prepare(
        `INSERT INTO orders (id, user_id, order_type, total_price, bank_ids_json, status)
         VALUES (?, ?, ?, ?, ?, 'completed')`
    ).run(
        params.id,
        params.userId,
        params.orderType,
        params.totalPrice,
        JSON.stringify(params.bankIds)
    );
}

export function listOrdersByUser(db: AppDatabase, userId: string): OrderRecord[] {
    return db
        .prepare(
            `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`
        )
        .all(userId) as OrderRecord[];
}
