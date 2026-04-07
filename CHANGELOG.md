# Changelog

## 1.0.9 - 2026-04-07

- add local `tsc --noEmit` typechecking via `npm run typecheck`
- add a minimal standalone `tsconfig.json` for this source-only pi extension package
- declare `@mariozechner/pi-coding-agent` as a pi-aligned runtime peer dependency and a local dev dependency for standalone typecheck resolution
- run typecheck as part of `prepublishOnly`

## 1.0.8 - 2026-04-07

- simplify Linux-family clipboard transport handling into one ordered path
- only report clipboard success when the underlying command succeeds
- restore intended fallback order across Termux, Wayland, and X11 tools
- add focused regression coverage for clipboard fallback behavior
- align the `/copy-user` command handler with pi's async command contract
