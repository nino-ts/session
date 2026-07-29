import { beforeEach, describe, expect, test } from "bun:test";
import {
    DatabaseDriver,
    type SessionConnectionInterface,
} from "../../src/drivers/database-driver";

describe("DatabaseDriver", () => {
    let driver: DatabaseDriver;
    let storage: Map<string, Record<string, unknown>>;

    function createMockConnection(): SessionConnectionInterface {
        storage = new Map();

        return {
            async query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]> {
                const normalizedSql = sql.trim().toUpperCase();

                if (normalizedSql.startsWith("SELECT * FROM")) {
                    const id = params?.[0] as string;
                    const row = storage.get(id);
                    return row ? [row] : [];
                }

                if (normalizedSql.startsWith("SELECT ID FROM") && normalizedSql.includes("WHERE ID")) {
                    const id = params?.[0] as string;
                    return storage.has(id) ? [{ id }] : [];
                }

                if (normalizedSql.startsWith("SELECT ID FROM") && normalizedSql.includes("EXPIRES_AT")) {
                    const cutoff = params?.[0] as Date;
                    const expired: Record<string, unknown>[] = [];
                    for (const [id, row] of storage.entries()) {
                        if ((row.expires_at as Date) < cutoff) {
                            expired.push({ id });
                        }
                    }
                    return expired;
                }

                if (normalizedSql.startsWith("INSERT")) {
                    const [id, token, data, expiresAt, createdAt, updatedAt] = params as [
                        string,
                        string,
                        string,
                        Date,
                        Date,
                        Date,
                    ];
                    storage.set(id, {
                        created_at: createdAt,
                        data,
                        expires_at: expiresAt,
                        id,
                        token,
                        updated_at: updatedAt,
                    });
                    return [];
                }

                if (normalizedSql.startsWith("UPDATE")) {
                    const [data, updatedAt, expiresAt, id] = params as [string, Date, Date, string];
                    const existing = storage.get(id);
                    if (existing) {
                        storage.set(id, {
                            ...existing,
                            data,
                            expires_at: expiresAt,
                            updated_at: updatedAt,
                        });
                    }
                    return [];
                }

                if (normalizedSql.startsWith("DELETE") && normalizedSql.includes("WHERE ID")) {
                    const id = params?.[0] as string;
                    storage.delete(id);
                    return [];
                }

                if (normalizedSql.startsWith("DELETE") && normalizedSql.includes("EXPIRES_AT")) {
                    const cutoff = params?.[0] as Date;
                    for (const [id, row] of storage.entries()) {
                        if ((row.expires_at as Date) < cutoff) {
                            storage.delete(id);
                        }
                    }
                    return [];
                }

                return [];
            },
        };
    }

    beforeEach(() => {
        driver = new DatabaseDriver(createMockConnection());
    });

    test("returns null for non-existent session", async () => {
        expect(await driver.read("non-existent")).toBeNull();
    });

    test("writes and reads session data", async () => {
        await driver.write("db-session-1", { role: "admin" });
        expect(await driver.read("db-session-1")).toEqual({ role: "admin" });
    });

    test("updates existing session data", async () => {
        await driver.write("db-session-1", { role: "admin" });
        await driver.write("db-session-1", { role: "user" });
        expect(await driver.read("db-session-1")).toEqual({ role: "user" });
    });

    test("checks if session exists", async () => {
        await driver.write("db-session-2", { ok: true });
        expect(await driver.exists("db-session-2")).toBe(true);
        expect(await driver.exists("missing")).toBe(false);
    });

    test("destroys a session", async () => {
        await driver.write("db-session-1", { role: "admin" });
        expect(await driver.destroy("db-session-1")).toBe(true);
        expect(await driver.read("db-session-1")).toBeNull();
        expect(await driver.exists("db-session-1")).toBe(false);
    });

    test("returns null for expired session", async () => {
        const past = new Date(Date.now() - 3_600_000);
        storage.set("expired", {
            created_at: past,
            data: JSON.stringify({ role: "admin" }),
            expires_at: past,
            id: "expired",
            token: "tok",
            updated_at: past,
        });

        expect(await driver.read("expired")).toBeNull();
        expect(await driver.exists("expired")).toBe(false);
    });

    test("garbage collects expired sessions", async () => {
        const now = new Date();
        const past = new Date(now.getTime() - 7_200_000);

        storage.set("old-1", {
            created_at: past,
            data: JSON.stringify({ x: 1 }),
            expires_at: past,
            id: "old-1",
            token: "token-1",
            updated_at: past,
        });
        storage.set("old-2", {
            created_at: past,
            data: JSON.stringify({ y: 2 }),
            expires_at: past,
            id: "old-2",
            token: "token-2",
            updated_at: past,
        });
        storage.set("recent", {
            created_at: now,
            data: JSON.stringify({ z: 3 }),
            expires_at: new Date(now.getTime() + 3_600_000),
            id: "recent",
            token: "token-3",
            updated_at: now,
        });

        const collected = await driver.gc(3600);
        expect(collected).toBe(2);
        expect(await driver.read("recent")).toEqual({ z: 3 });
    });

    test("handles corrupted data gracefully", async () => {
        storage.set("bad-session", {
            created_at: new Date(),
            data: "not-valid-json{{{",
            expires_at: new Date(Date.now() + 3_600_000),
            id: "bad-session",
            token: "token-bad",
            updated_at: new Date(),
        });

        expect(await driver.read("bad-session")).toBeNull();
    });

    test("respects custom table and lifetime minutes", async () => {
        const queries: string[] = [];
        const connection: SessionConnectionInterface = {
            async query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]> {
                queries.push(sql);
                if (sql.trim().toUpperCase().startsWith("SELECT ID FROM")) {
                    return [];
                }
                if (sql.trim().toUpperCase().startsWith("INSERT")) {
                    const expiresAt = params?.[3] as Date;
                    const deltaMs = expiresAt.getTime() - Date.now();
                    // 30 minutes ± 5s clock skew
                    expect(deltaMs).toBeGreaterThan(29 * 60 * 1000);
                    expect(deltaMs).toBeLessThan(31 * 60 * 1000);
                }
                return [];
            },
        };

        const custom = new DatabaseDriver(connection, { lifetime: 30, table: "app_sessions" });
        await custom.write("id-1", { a: 1 });
        expect(queries.some((q) => q.includes("app_sessions"))).toBe(true);
    });
});
