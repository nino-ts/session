import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { FileDriver, Session, SessionManager } from "../../src";

describe("Session", () => {
    let driver: FileDriver;
    const testDir = join(import.meta.dir, "..", "tmp-sessions");

    beforeAll(async () => {
        await mkdir(testDir, { recursive: true });
        driver = new FileDriver(testDir);
    });

    afterAll(async () => {
        await rm(testDir, { force: true, recursive: true });
    });

    test("should get and set session values", async () => {
        const session = new Session("test-1", driver);

        session.set("user", "John");
        session.set("role", "admin");

        expect(session.get("user")).toBe("John");
        expect(session.get("role")).toBe("admin");
        expect(session.get("missing", "default")).toBe("default");
    });

    test("should check if key exists", async () => {
        const session = new Session("test-2", driver);

        session.set("user", "John");

        expect(session.has("user")).toBe(true);
        expect(session.has("missing")).toBe(false);
    });

    test("should forget keys", async () => {
        const session = new Session("test-3", driver);

        session.set("user", "John");
        expect(session.has("user")).toBe(true);

        session.forget("user");
        expect(session.has("user")).toBe(false);
    });

    test("should get all data", async () => {
        const session = new Session("test-4", driver);

        session.set("user", "John");
        session.set("role", "admin");

        expect(session.all()).toEqual({ role: "admin", user: "John" });
    });

    test("should handle flash data", async () => {
        const session = new Session("test-5", driver);

        session.flash("message", "Hello");
        expect(session.get("_flash.message")).toBe("Hello");

        const value = session.getFlash("message");
        expect(value).toBe("Hello");
        expect(session.has("_flash.message")).toBe(false);
    });

    test("should save and reload data", async () => {
        const session = new Session("test-save", driver);

        session.set("user", "John");
        await session.save();

        const data = await driver.read("test-save");
        expect(data).toEqual({ user: "John" });
    });

    test("should invalidate session", async () => {
        const session = new Session("test-invalidate", driver);

        session.set("user", "John");
        await session.save();

        await session.invalidate();
        expect(session.all()).toEqual({});

        const data = await driver.read("test-invalidate");
        expect(data).toBeNull();
    });

    test("should regenerate session ID", async () => {
        const oldId = "test-regen";
        const session = new Session(oldId, driver);

        session.set("user", "John");
        await session.save();

        const newId = await session.regenerate();
        expect(newId).not.toBe(oldId);

        // Old session should be gone
        const oldData = await driver.read(oldId);
        expect(oldData).toBeNull();

        // New session should have the data
        const newData = await driver.read(newId);
        expect(newData).toEqual({ user: "John" });
    });
});

describe("SessionManager", () => {
    let driver: FileDriver;
    let manager: SessionManager;
    const testDir = join(import.meta.dir, "..", "tmp-sessions-manager");

    beforeAll(async () => {
        await mkdir(testDir, { recursive: true });
        driver = new FileDriver(testDir);
        manager = new SessionManager(driver, {
            cookie: "ninots_session",
            driver: "file",
            files: testDir,
            httpOnly: true,
            lifetime: 120,
            path: "/",
            sameSite: "lax",
            secure: false,
        });
    });

    afterAll(async () => {
        await rm(testDir, { force: true, recursive: true });
    });

    test("should create a new session", async () => {
        const session = await manager.create();

        expect(session).toBeInstanceOf(Session);
        expect(session.getId()).toBeDefined();
    });

    test("should get or create session", async () => {
        const session = await manager.getOrCreate("existing-id");
        expect(session).toBeInstanceOf(Session);
    });

    test("should destroy session", async () => {
        const session = await manager.create();
        const id = session.getId();

        session.set("user", "John");
        await session.save();

        const destroyed = await manager.destroy(id);
        expect(destroyed).toBe(true);
    });
});
