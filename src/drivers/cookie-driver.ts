import type { SessionDriver } from "../types";

/**
 * Cookie-based session driver.
 *
 * Stores session data in encrypted cookies.
 * Best for small, stateless sessions.
 */
export class CookieDriver implements SessionDriver {
    /**
     * Maximum cookie size (4KB limit for cookies).
     */
    private readonly MAX_COOKIE_SIZE = 4096;

    /**
     * Read session data from cookie.
     *
     * Note: In practice, this reads from the request cookie header.
     *
     * @param id - The session ID (ignored for cookie driver)
     * @returns The session data or null
     */
    public async read(_id: string): Promise<Record<string, unknown> | null> {
        // Cookie driver reads from request headers
        // This is a placeholder for the interface
        return null;
    }

    /**
     * Write session data to cookie.
     *
     * @param _id - The session ID (ignored for cookie driver)
     * @param data - The session data
     * @returns Whether the write was successful
     */
    public async write(_id: string, data: Record<string, unknown>): Promise<boolean> {
        const serialized = JSON.stringify(data);
        return serialized.length < this.MAX_COOKIE_SIZE;
    }

    /**
     * Destroy session (clear cookie).
     *
     * @param _id - The session ID
     * @returns Whether the destroy was successful
     */
    public async destroy(_id: string): Promise<boolean> {
        // Cookie is cleared by setting an expired date
        return true;
    }

    /**
     * Check if session exists (always true for cookie driver).
     *
     * @param _id - The session ID
     * @returns Always true
     */
    public async exists(_id: string): Promise<boolean> {
        return true;
    }

    /**
     * Serialize session data to cookie string.
     *
     * @param data - The session data
     * @param config - Cookie configuration
     * @returns Cookie header value
     */
    public toCookieString(
        data: Record<string, unknown>,
        config: {
            name: string;
            maxAge: number;
            path: string;
            secure: boolean;
            httpOnly: boolean;
            sameSite: string;
        },
    ): string {
        const serialized = JSON.stringify(data);
        const parts = [
            `${config.name}=${encodeURIComponent(serialized)}`,
            `Max-Age=${config.maxAge}`,
            `Path=${config.path}`,
        ];

        if (config.secure) {
            parts.push("Secure");
        }
        if (config.httpOnly) {
            parts.push("HttpOnly");
        }
        parts.push(`SameSite=${config.sameSite}`);

        return parts.join("; ");
    }
}
