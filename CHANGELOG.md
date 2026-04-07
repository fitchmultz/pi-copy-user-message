# Changelog

## 1.0.8 - 2026-04-07

- simplify Linux-family clipboard transport handling into one ordered path
- only report clipboard success when the underlying command succeeds
- restore intended fallback order across Termux, Wayland, and X11 tools
- add focused regression coverage for clipboard fallback behavior
- align the `/copy-user` command handler with pi's async command contract
