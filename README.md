# @ninots/session

Bun-native session management for Ninots — cookie, file, database, and redis drivers.

## Install

```bash
bun add @ninots/session@^0.3.0
```

## Drivers

| Driver | Class | Notes |
|--------|-------|--------|
| cookie | `CookieDriver` | Stateless cookie payload |
| file | `FileDriver` | JSON files on disk |
| database | `DatabaseDriver` | Inject a local `SessionConnectionInterface` (no `@ninots/orm`) |
| redis | `RedisDriver` | Inject `Bun.redis` / `SessionRedisClient` (no npm Redis package); TTL = lifetime |

Unified `SessionDriver` seam: `read` / `write` / `destroy` / `exists` / `gc`.

```ts
import { RedisDriver } from "@ninots/session";

const driver = new RedisDriver(Bun.redis, {
  lifetime: 120,
  prefix: "ninots_session:",
});
```

## Version

`0.3.0` — Sprint 20: Redis driver via `Bun.redis` (SemVer minor in `0.y.z`).

## License

MIT
