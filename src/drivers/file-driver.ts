import type { SessionDriver } from "../types";

/**
 * File-based session driver.
 *
 * Stores session data as JSON files on disk.
 * Best for single-server deployments.
 */
export class FileDriver implements SessionDriver {
    /**
     * The directory where session files are stored.
     */
    private directory: string;

    /**
     * Create a new file driver instance.
     *
     * @param directory - The session storage directory
     */
    constructor(directory: string) {
        this.directory = directory;
    }

    /**
     * Get the file path for a session ID.
     *
     * @param id - The session ID
     * @returns The file path
     */
    private filePath(id: string): string {
        return `${this.directory}/${id}.json`;
    }

    /**
     * Read session data from file.
     *
     * @param id - The session ID
     * @returns The session data or null if not found
     */
    public async read(id: string): Promise<Record<string, unknown> | null> {
        try {
            const file = Bun.file(this.filePath(id));
            if (!(await file.exists())) {
                return null;
            }
            const content = await file.text();
            const data = JSON.parse(content) as Record<string, unknown>;

            // Check expiration
            if (data._expiresAt && (data._expiresAt as number) < Date.now()) {
                await this.destroy(id);
                return null;
            }

            return data;
        } catch {
            return null;
        }
    }

    /**
     * Write session data to file.
     *
     * @param id - The session ID
     * @param data - The session data
     * @returns Whether the write was successful
     */
    public async write(id: string, data: Record<string, unknown>): Promise<boolean> {
        try {
            const content = JSON.stringify(data);
            await Bun.write(this.filePath(id), content);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Destroy a session file.
     *
     * @param id - The session ID
     * @returns Whether the destroy was successful
     */
    public async destroy(id: string): Promise<boolean> {
        try {
            const file = Bun.file(this.filePath(id));
            if (await file.exists()) {
                await file.delete();
            }
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Check if a session file exists.
     *
     * @param id - The session ID
     * @returns Whether the session exists
     */
    public async exists(id: string): Promise<boolean> {
        try {
            return await Bun.file(this.filePath(id)).exists();
        } catch {
            return false;
        }
    }
}
