# @ninots/session

Bun-native session management for Ninots — cookie, file, and database drivers.

## Install

```bash
bun add @ninots/session@^0.2.0
```

## Drivers

| Driver | Class | Notes |
|--------|-------|--------|
| cookie | `CookieDriver` | Stateless cookie payload |
| file | `FileDriver` | JSON files on disk |
| database | `DatabaseDriver` | Inject a local `SessionConnectionInterface` (no `@ninots/orm`) |

Unified `SessionDriver` seam: `read` / `write` / `destroy` / `exists` / `gc`.

## Version

`0.2.0` — Sprint 17: database driver + unified `SessionDriver` (SemVer minor in `0.y.z`).

## License

MIT
