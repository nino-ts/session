import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { FileDriver } from "../../src/drivers/file-driver";

describe("FileDriver", () => {
    const testDir = join(import.meta.dir, "..", "tmp-sessions");
    let driver: FileDriver;

    beforeAll(async () => {
        await mkdir(testDir, { recursive: true });
        driver = new FileDriver(testDir);
    });

    afterAll(async () => {
        await rm(testDir, { force: true, recursive: true });
    });

    test("should write and read session data", async () => {
        const data = { role: "admin", user: "test" };
        await driver.write("session-1", data);

        const read = await driver.read("session-1");
        expect(read).toEqual(data);
    });

    test("should return null for non-existent session", async () => {
        const result = await driver.read("non-existent");
        expect(result).toBeNull();
    });

    test("should check if session exists", async () => {
        await driver.write("session-2", { test: true });
        expect(await driver.exists("session-2")).toBe(true);
        expect(await driver.exists("non-existent")).toBe(false);
    });

    test("should destroy session", async () => {
        await driver.write("session-3", { test: true });
        expect(await driver.exists("session-3")).toBe(true);

        await driver.destroy("session-3");
        expect(await driver.exists("session-3")).toBe(false);
    });

    test("should handle expired sessions", async () => {
        const expiredData = { _expiresAt: Date.now() - 1000, user: "test" };
        await driver.write("session-expired", expiredData);

        const result = await driver.read("session-expired");
        expect(result).toBeNull();
    });

    test("should handle sessions without expiration", async () => {
        const data = { user: "test" };
        await driver.write("session-no-expiry", data);

        const result = await driver.read("session-no-expiry");
        expect(result).toEqual(data);
    });
});
