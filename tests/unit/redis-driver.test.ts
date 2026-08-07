import { beforeEach, describe, expect, test } from "bun:test";
import {
    RedisDriver,
    type SessionRedisClient,
} from "../../src/drivers/redis-driver";

describe("RedisDriver", () => {
    let driver: RedisDriver;
    let store: Map<string, { value: string; expiresAt: number | null }>;
    let lastSetexSeconds: number | null;

    function createMockClient(): SessionRedisClient {
        store = new Map();
        lastSetexSeconds = null;

        return {
            async get(key: string): Promise<string | null> {
                const entry = store.get(key);
                if (!entry) {
                    return null;
                }
                if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
                    store.delete(key);
                    return null;
                }
                return entry.value;
            },

            async setex(key: string, seconds: number, value: string): Promise<"OK"> {
                lastSetexSeconds = seconds;
                store.set(key, {
                    expiresAt: Date.now() + seconds * 1000,
                    value,
                });
                return "OK";
            },

            async del(...keys: string[]): Promise<number> {
                let removed = 0;
                for (const key of keys) {
                    if (store.delete(key)) {
                        removed += 1;
                    }
                }
                return removed;
            },

            async exists(...keys: string[]): Promise<number> {
                let count = 0;
                for (const key of keys) {
                    const entry = store.get(key);
                    if (!entry) {
                        continue;
                    }
                    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
                        store.delete(key);
                        continue;
                    }
                    count += 1;
                }
                return count;
            },
        };
    }

    beforeEach(() => {
        driver = new RedisDriver(createMockClient());
    });

    test("returns null for non-existent session", async () => {
        expect(await driver.read("missing")).toBeNull();
    });

    test("writes and reads session data with prefixed key", async () => {
        await driver.write("sess-1", { userId: 42 });
        expect(await driver.read("sess-1")).toEqual({ userId: 42 });
        expect(store.has("ninots_session:sess-1")).toBe(true);
    });

    test("updates existing session and refreshes TTL", async () => {
        await driver.write("sess-1", { step: 1 });
        await driver.write("sess-1", { step: 2 });
        expect(await driver.read("sess-1")).toEqual({ step: 2 });
        expect(lastSetexSeconds).toBe(120 * 60);
    });

    test("checks if session exists", async () => {
        await driver.write("sess-2", { ok: true });
        expect(await driver.exists("sess-2")).toBe(true);
        expect(await driver.exists("missing")).toBe(false);
    });

    test("destroys a session", async () => {
        await driver.write("sess-1", { role: "admin" });
        expect(await driver.destroy("sess-1")).toBe(true);
        expect(await driver.read("sess-1")).toBeNull();
        expect(await driver.exists("sess-1")).toBe(false);
    });

    test("returns null for expired session", async () => {
        store.set("ninots_session:expired", {
            expiresAt: Date.now() - 1_000,
            value: JSON.stringify({ stale: true }),
        });
        expect(await driver.read("expired")).toBeNull();
        expect(await driver.exists("expired")).toBe(false);
    });

    test("gc is a no-op (TTL handles expiry)", async () => {
        await driver.write("sess-1", { a: 1 });
        expect(await driver.gc(3600)).toBe(0);
        expect(await driver.read("sess-1")).toEqual({ a: 1 });
    });

    test("handles corrupted JSON gracefully", async () => {
        store.set("ninots_session:bad", {
            expiresAt: Date.now() + 60_000,
            value: "not-valid-json{{{",
        });
        expect(await driver.read("bad")).toBeNull();
    });

    test("respects custom prefix and lifetime minutes", async () => {
        const custom = new RedisDriver(createMockClient(), {
            lifetime: 30,
            prefix: "app:",
        });
        await custom.write("id-1", { a: 1 });
        expect(store.has("app:id-1")).toBe(true);
        expect(lastSetexSeconds).toBe(30 * 60);
        expect(await custom.read("id-1")).toEqual({ a: 1 });
    });

    test("write returns false when setex fails", async () => {
        const failing: SessionRedisClient = {
            async get(): Promise<string | null> {
                return null;
            },
            async setex(): Promise<"OK"> {
                throw new Error("redis down");
            },
            async del(): Promise<number> {
                return 0;
            },
            async exists(): Promise<number> {
                return 0;
            },
        };
        const fragile = new RedisDriver(failing);
        expect(await fragile.write("x", { y: 1 })).toBe(false);
    });
});
