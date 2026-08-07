import type { SessionDriver } from "../types";

/**
 * Thin Redis client seam for the session driver.
 * Apps inject `Bun.redis` / `Bun.RedisClient` (or a test double) — no npm Redis package.
 */
export interface SessionRedisClient {
    get(key: string): Promise<string | null>;
    setex(key: string, seconds: number, value: string): Promise<"OK" | string | null>;
    del(...keys: string[]): Promise<number>;
    exists(...keys: string[]): Promise<number>;
}

/**
 * Options for {@link RedisDriver}.
 */
export interface RedisDriverOptions {
    /**
     * Key prefix prepended to session IDs.
     *
     * @default 'ninots_session:'
     */
    prefix?: string;

    /**
     * Session lifetime in minutes (matches {@link SessionConfig.lifetime}).
     * Applied as Redis TTL in seconds (`lifetime * 60`).
     *
     * @default 120
     */
    lifetime?: number;
}

/**
 * Stores sessions in Redis via {@link SessionRedisClient} (`Bun.redis`).
 *
 * Keys: `{prefix}{id}`; value: JSON payload; TTL = lifetime minutes → seconds.
 * `gc` is a no-op — Redis TTL removes expired keys.
 */
export class RedisDriver implements SessionDriver {
    private readonly client: SessionRedisClient;
    private readonly prefix: string;
    private readonly lifetimeMinutes: number;

    constructor(client: SessionRedisClient, options: RedisDriverOptions = {}) {
        this.client = client;
        this.prefix = options.prefix ?? "ninots_session:";
        this.lifetimeMinutes = options.lifetime ?? 120;
    }

    private key(id: string): string {
        return `${this.prefix}${id}`;
    }

    private ttlSeconds(): number {
        return this.lifetimeMinutes * 60;
    }

    public async read(id: string): Promise<Record<string, unknown> | null> {
        try {
            const raw = await this.client.get(this.key(id));
            if (raw === null || raw.length === 0) {
                return null;
            }

            try {
                return JSON.parse(raw) as Record<string, unknown>;
            } catch {
                return null;
            }
        } catch {
            return null;
        }
    }

    public async write(id: string, data: Record<string, unknown>): Promise<boolean> {
        try {
            await this.client.setex(this.key(id), this.ttlSeconds(), JSON.stringify(data));
            return true;
        } catch {
            return false;
        }
    }

    public async destroy(id: string): Promise<boolean> {
        try {
            await this.client.del(this.key(id));
            return true;
        } catch {
            return false;
        }
    }

    public async exists(id: string): Promise<boolean> {
        const data = await this.read(id);
        return data !== null;
    }

    /**
     * No-op — Redis TTL expires keys. Kept for {@link SessionDriver} parity.
     */
    public async gc(_maxLifetime: number): Promise<number> {
        return 0;
    }
}
