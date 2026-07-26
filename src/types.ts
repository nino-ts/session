/**
 * Session driver contract.
 *
 * Defines the interface that all session drivers must implement.
 */
export interface SessionDriver {
    /**
     * Read session data by ID.
     *
     * @param id - The session ID
     * @returns The session data or null if not found
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
     * Check if a session exists.
     *
     * @param id - The session ID
     * @returns Whether the session exists
     */
    exists(id: string): Promise<boolean>;
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
}
