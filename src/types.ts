/**
 * Session driver contract.
 *
 * Unified seam for file, cookie, and database drivers:
 * - `read` returns `null` when missing/expired (session package idiom)
 * - `exists` for presence checks
 * - `gc` for expired-session cleanup (database/file; cookie is a no-op)
 *
 * Lifetime for drivers that persist expiration (database) is configured on the
 * driver instance — not on every `write` — so `Session` / `SessionManager` stay
 * driver-agnostic.
 */
export interface SessionDriver {
    /**
     * Read session data by ID.
     *
     * @param id - The session ID
     * @returns The session data or null if not found / expired
     */
    read(id: string): Promise<Record<string, unknown> | null>;

    /**
     * Write session data.
     *
     * @param id - The session ID
     * @param data - The session data
     * @returns Whether the write was successful
     */
    write(id: string, data: Record<string, unknown>): Promise<boolean>;

    /**
     * Destroy a session.
     *
     * @param id - The session ID
     * @returns Whether the destroy was successful
     */
    destroy(id: string): Promise<boolean>;

    /**
     * Check if a session exists (and is not expired).
     *
     * @param id - The session ID
     * @returns Whether the session exists
     */
    exists(id: string): Promise<boolean>;

    /**
     * Garbage-collect expired sessions.
     *
     * @param maxLifetime - Lifetime hint in seconds (Laravel-style). Drivers that
     *   store an absolute `expires_at` may ignore this and delete where expired.
     * @returns Number of sessions removed
     */
    gc(maxLifetime: number): Promise<number>;
}

/**
 * Session configuration.
 */
export interface SessionConfig {
    /**
     * Session driver to use.
     *
     * @default 'cookie'
     */
    driver: "cookie" | "file" | "database";

    /**
     * Session lifetime in minutes.
     *
     * @default 120
     */
    lifetime: number;

    /**
     * Session cookie name.
     *
     * @default 'ninots_session'
     */
    cookie: string;

    /**
     * Session cookie path.
     *
     * @default '/'
     */
    path: string;

    /**
     * Session cookie domain.
     */
    domain?: string;

    /**
     * Whether the cookie is secure.
     *
     * @default false
     */
    secure: boolean;

    /**
     * Whether the cookie is HTTP-only.
     *
     * @default true
     */
    httpOnly: boolean;

    /**
     * SameSite cookie attribute.
     *
     * @default 'lax'
     */
    sameSite: "strict" | "lax" | "none";

    /**
     * File storage path (for file driver).
     *
     * @default 'storage/framework/sessions'
     */
    files: string;

    /**
     * Database table name (for database driver).
     *
     * @default 'sessions'
     */
    table?: string;
}
