import type { AppDatabase } from "../db/connection.js";

export interface KnowledgeCategory {
    id: string;
    bank_id: string | null;
    name: string;
    description: string | null;
    display_order: number;
    status: string;
    document_count: number;
}

export interface KnowledgeDocument {
    id: string;
    category_id: string;
    title: string;
    content: string;
    tags: string | null;
    display_order: number;
    status: string;
}

export interface AdminKnowledgeDocument extends KnowledgeDocument {
    category_name: string;
}

export function listCategories(db: AppDatabase, bankId?: string): KnowledgeCategory[] {
    const baseQuery = `
        SELECT c.*,
               (SELECT COUNT(*) FROM knowledge_documents d
                WHERE d.category_id = c.id AND d.status = 'published') AS document_count
        FROM knowledge_categories c
        WHERE c.status = 'published'
    `;
    if (bankId) {
        return db.prepare(
            `${baseQuery} AND (c.bank_id = ? OR c.bank_id IS NULL) ORDER BY c.display_order`
        ).all(bankId) as KnowledgeCategory[];
    }
    return db.prepare(
        `${baseQuery} ORDER BY c.display_order`
    ).all() as KnowledgeCategory[];
}

export function listDocumentsByCategory(db: AppDatabase, categoryId: string): KnowledgeDocument[] {
    return db.prepare(
        `SELECT * FROM knowledge_documents WHERE category_id = ? AND status = 'published' ORDER BY display_order`
    ).all(categoryId) as KnowledgeDocument[];
}

export function getDocument(db: AppDatabase, documentId: string): KnowledgeDocument | undefined {
    return db.prepare(
        `SELECT * FROM knowledge_documents WHERE id = ? AND status = 'published'`
    ).get(documentId) as KnowledgeDocument | undefined;
}

export function createCategory(db: AppDatabase, params: {
    id: string; bankId: string | null; name: string; description: string | null; displayOrder: number
}): void {
    db.prepare(
        `INSERT INTO knowledge_categories (id, bank_id, name, description, display_order) VALUES (?, ?, ?, ?, ?)`
    ).run(params.id, params.bankId, params.name, params.description, params.displayOrder);
}

export function updateCategory(
    db: AppDatabase,
    categoryId: string,
    params: {
        bankId?: string | null;
        name?: string;
        description?: string | null;
        displayOrder?: number;
        status?: string;
    }
): void {
    const sets: string[] = [];
    const args: unknown[] = [];
    if (params.bankId !== undefined) { sets.push("bank_id = ?"); args.push(params.bankId); }
    if (params.name !== undefined) { sets.push("name = ?"); args.push(params.name); }
    if (params.description !== undefined) { sets.push("description = ?"); args.push(params.description); }
    if (params.displayOrder !== undefined) { sets.push("display_order = ?"); args.push(params.displayOrder); }
    if (params.status !== undefined) { sets.push("status = ?"); args.push(params.status); }
    if (sets.length === 0) return;
    args.push(categoryId);
    db.prepare(`UPDATE knowledge_categories SET ${sets.join(", ")} WHERE id = ?`).run(...args);
}

export function createDocument(db: AppDatabase, params: {
    id: string; categoryId: string; title: string; content: string; tags: string | null; displayOrder: number
}): void {
    db.prepare(
        `INSERT INTO knowledge_documents (id, category_id, title, content, tags, display_order) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(params.id, params.categoryId, params.title, params.content, params.tags, params.displayOrder);
}

export function listAdminDocuments(
    db: AppDatabase,
    filters: { categoryId?: string; status?: string; search?: string }
): AdminKnowledgeDocument[] {
    const conditions: string[] = [];
    const args: unknown[] = [];
    if (filters.categoryId) { conditions.push("d.category_id = ?"); args.push(filters.categoryId); }
    if (filters.status) { conditions.push("d.status = ?"); args.push(filters.status); }
    if (filters.search) { conditions.push("d.title LIKE ?"); args.push(`%${filters.search}%`); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return db.prepare(
        `SELECT d.*, c.name AS category_name
         FROM knowledge_documents d
         INNER JOIN knowledge_categories c ON c.id = d.category_id
         ${where}
         ORDER BY c.display_order, d.display_order, d.created_at DESC`
    ).all(...args) as AdminKnowledgeDocument[];
}

export function updateDocument(
    db: AppDatabase,
    documentId: string,
    params: {
        categoryId?: string;
        title?: string;
        content?: string;
        tags?: string | null;
        displayOrder?: number;
        status?: string;
    }
): void {
    const sets: string[] = [];
    const args: unknown[] = [];
    if (params.categoryId !== undefined) { sets.push("category_id = ?"); args.push(params.categoryId); }
    if (params.title !== undefined) { sets.push("title = ?"); args.push(params.title); }
    if (params.content !== undefined) { sets.push("content = ?"); args.push(params.content); }
    if (params.tags !== undefined) { sets.push("tags = ?"); args.push(params.tags); }
    if (params.displayOrder !== undefined) { sets.push("display_order = ?"); args.push(params.displayOrder); }
    if (params.status !== undefined) { sets.push("status = ?"); args.push(params.status); }
    if (sets.length === 0) return;
    args.push(documentId);
    db.prepare(`UPDATE knowledge_documents SET ${sets.join(", ")} WHERE id = ?`).run(...args);
}

export function updateDocumentStatus(db: AppDatabase, documentId: string, status: string): void {
    db.prepare(`UPDATE knowledge_documents SET status = ? WHERE id = ?`).run(status, documentId);
}
