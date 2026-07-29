import type { SessionDriver } from "../types";

/**
 * Local connection contract for the database session driver.
 * Apps inject an adapter (e.g. Bun.sql / ORM wrapper) — zero `@ninots/*` imports.
 */
export interface SessionConnectionInterface {
    query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
}

/**
 * Options for {@link DatabaseDriver}.
 */
export interface DatabaseDriverOptions {
    /**
     * Session table name.
     *
     * @default 'sessions'
     */
    table?: string;

    /**
     * Session lifetime in minutes (matches {@link SessionConfig.lifetime}).
     *
     * @default 120
     */
    lifetime?: number;
}

/**
 * Generates a cryptographically secure random token for session identification.
 *
 * @internal
 */
function generateSessionToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Stores sessions in a database table via a local connection interface.
 *
 * Expected table schema:
 *   id TEXT PRIMARY KEY
 *   token TEXT UNIQUE NOT NULL
 *   data TEXT (JSON-encoded session data)
 *   expires_at TIMESTAMP NOT NULL
 *   created_at TIMESTAMP NOT NULL
 *   updated_at TIMESTAMP NOT NULL
 *   ip_address TEXT (optional)
 *   user_agent TEXT (optional)
 *   user_id TEXT (optional)
 */
export class DatabaseDriver implements SessionDriver {
    private readonly connection: SessionConnectionInterface;
    private readonly table: string;
    private readonly lifetimeMinutes: number;

    constructor(connection: SessionConnectionInterface, options: DatabaseDriverOptions = {}) {
        this.connection = connection;
        this.table = options.table ?? "sessions";
        this.lifetimeMinutes = options.lifetime ?? 120;
    }

    public async read(id: string): Promise<Record<string, unknown> | null> {
        const results = await this.connection.query(`SELECT * FROM ${this.table} WHERE id = ? LIMIT 1`, [id]);

        const row = results[0];
        if (!row) {
            return null;
        }

        const expiresAt = row.expires_at;
        if (expiresAt instanceof Date && expiresAt.getTime() < Date.now()) {
            await this.destroy(id);
            return null;
        }
        if (typeof expiresAt === "string" || typeof expiresAt === "number") {
            const parsed = new Date(expiresAt);
            if (!Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now()) {
                await this.destroy(id);
                return null;
            }
        }

        const dataStr = row.data;
        if (typeof dataStr !== "string" || dataStr.length === 0) {
            return null;
        }

        try {
            return JSON.parse(dataStr) as Record<string, unknown>;
        } catch {
            return null;
        }
    }

    public async write(id: string, data: Record<string, unknown>): Promise<boolean> {
        const dataJson = JSON.stringify(data);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.lifetimeMinutes * 60 * 1000);
        const token = generateSessionToken();

        const existing = await this.connection.query(`SELECT id FROM ${this.table} WHERE id = ? LIMIT 1`, [id]);

        if (existing.length > 0) {
            await this.connection.query(
                `UPDATE ${this.table} SET data = ?, updated_at = ?, expires_at = ? WHERE id = ?`,
                [dataJson, now, expiresAt, id],
            );
        } else {
            await this.connection.query(
                `INSERT INTO ${this.table} (id, token, data, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
                [id, token, dataJson, expiresAt, now, now],
            );
        }

        return true;
    }

    public async destroy(id: string): Promise<boolean> {
        await this.connection.query(`DELETE FROM ${this.table} WHERE id = ?`, [id]);
        return true;
    }

    public async exists(id: string): Promise<boolean> {
        const data = await this.read(id);
        return data !== null;
    }

    /**
     * Delete rows whose `expires_at` is before now.
     * `maxLifetime` is accepted for SessionDriver parity (Laravel passes lifetime);
     * with an absolute expires_at column the cutoff is wall-clock now.
     */
    public async gc(_maxLifetime: number): Promise<number> {
        const cutoff = new Date();

        const expired = await this.connection.query(`SELECT id FROM ${this.table} WHERE expires_at < ?`, [cutoff]);

        if (expired.length === 0) {
            return 0;
        }

        await this.connection.query(`DELETE FROM ${this.table} WHERE expires_at < ?`, [cutoff]);

        return expired.length;
    }
}
