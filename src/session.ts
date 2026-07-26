import type { SessionConfig, SessionDriver } from "../types";

/**
 * Session class.
 *
 * Provides a convenient interface for working with session data,
 * regardless of the underlying driver.
 */
export class Session {
    /**
     * The session ID.
     */
    private id: string;

    /**
     * The session data.
     */
    private data: Record<string, unknown>;

    /**
     * The session driver.
     */
    private driver: SessionDriver;

    /**
     * Whether the session has been modified.
     */
    private isModified: boolean;

    /**
     * Create a new session instance.
     *
     * @param id - The session ID
     * @param driver - The session driver
     * @param data - Initial session data
     */
    constructor(id: string, driver: SessionDriver, data: Record<string, unknown> = {}) {
        this.id = id;
        this.driver = driver;
        this.data = data;
        this.isModified = false;
    }

    /**
     * Get the session ID.
     *
     * @returns The session ID
     */
    public getId(): string {
        return this.id;
    }

    /**
     * Get a value from the session.
     *
     * @param key - The key to get
     * @param defaultValue - Default value if key doesn't exist
     * @returns The value or default
     */
    public get<T = unknown>(key: string, defaultValue?: T): T {
        return (this.data[key] ?? defaultValue) as T;
    }

    /**
     * Set a value in the session.
     *
     * @param key - The key to set
     * @param value - The value to set
     */
    public set(key: string, value: unknown): void {
        this.data[key] = value;
        this.isModified = true;
    }

    /**
     * Remove a value from the session.
     *
     * @param key - The key to remove
     */
    public forget(key: string): void {
        delete this.data[key];
        this.isModified = true;
    }

    /**
     * Check if a key exists in the session.
     *
     * @param key - The key to check
     * @returns Whether the key exists
     */
    public has(key: string): boolean {
        return key in this.data;
    }

    /**
     * Get all session data.
     *
     * @returns The session data
     */
    public all(): Record<string, unknown> {
        return { ...this.data };
    }

    /**
     * Flash data for the next request only.
     *
     * @param key - The key to flash
     * @param value - The value to flash
     */
    public flash(key: string, value: unknown): void {
        this.set(`_flash.${key}`, value);
    }

    /**
     * Get and remove flashed data.
     *
     * @param key - The key to get
     * @returns The flashed value or undefined
     */
    public getFlash<T = unknown>(key: string): T | undefined {
        const value = this.get<T>(`_flash.${key}`);
        this.forget(`_flash.${key}`);
        return value;
    }

    /**
     * Regenerate the session ID.
     *
     * @returns The new session ID
     */
    public async regenerate(): Promise<string> {
        const newId = this.generateId();
        await this.driver.write(newId, this.data);
        await this.driver.destroy(this.id);
        this.id = newId;
        return this.id;
    }

    /**
     * Save the session data.
     *
     * @returns Whether the save was successful
     */
    public async save(): Promise<boolean> {
        if (!this.isModified) {
            return true;
        }
        const success = await this.driver.write(this.id, this.data);
        if (success) {
            this.isModified = false;
        }
        return success;
    }

    /**
     * Invalidate the session.
     *
     * @returns Whether the invalidation was successful
     */
    public async invalidate(): Promise<boolean> {
        this.data = {};
        this.isModified = true;
        return this.driver.destroy(this.id);
    }

    /**
     * Generate a unique session ID.
     *
     * @returns The generated session ID
     */
    private generateId(): string {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
}

/**
 * Session manager.
 *
 * Creates and manages session instances using a driver.
 */
export class SessionManager {
    /**
     * The session driver.
     */
    private driver: SessionDriver;

    /**
     * Create a new session manager.
     *
     * @param driver - The session driver
     * @param config - Session configuration
     */
    constructor(driver: SessionDriver, config: SessionConfig) {
        this.driver = driver;
        this.config = config;
    }

    /**
     * Create a new session.
     *
     * @param id - Optional session ID (generates one if not provided)
     * @returns The session instance
     */
    public async create(id?: string): Promise<Session> {
        const sessionId = id ?? this.generateId();
        let data: Record<string, unknown> = {};

        const existing = await this.driver.read(sessionId);
        if (existing) {
            data = existing;
        }

        return new Session(sessionId, this.driver, data);
    }

    /**
     * Get an existing session or create a new one.
     *
     * @param id - The session ID
     * @returns The session instance
     */
    public async getOrCreate(id: string): Promise<Session> {
        return this.create(id);
    }

    /**
     * Destroy a session.
     *
     * @param id - The session ID
     * @returns Whether the destroy was successful
     */
    public async destroy(id: string): Promise<boolean> {
        return this.driver.destroy(id);
    }

    /**
     * Generate a unique session ID.
     *
     * @returns The generated session ID
     */
    private generateId(): string {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
}
