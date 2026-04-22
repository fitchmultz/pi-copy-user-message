# Changelog

## Unreleased

## 1.0.15 - 2026-04-22

- updated the local pi development baseline to `@mariozechner/pi-coding-agent` `0.69.0`
- regenerated the npm lockfile against the current stable dependency graph
- reviewed the pi `0.69.0` changelog and confirmed the extension does not depend on the TypeBox migration surface, removed cwd-bound helpers, or session-replacement footguns


## 1.0.14 - 2026-04-21

- updated the local pi development baseline to `@mariozechner/pi-coding-agent` `0.68.0`
- regenerated the npm lockfile against the current stable dependency graph
- reviewed the pi `0.68.0` changelog and confirmed the extension does not depend on removed cwd-bound tool exports or implicit cwd helper fallbacks

## 1.0.13 - 2026-04-18

- bumped the local pi development baseline to `@mariozechner/pi-coding-agent` `0.67.68` and `typescript` `6.0.3`
- pinned the transitive `basic-ftp` dependency to `5.3.0` and refreshed the release lockfile to clear the current audit finding

## 1.0.12 - 2026-04-15

- refresh the local test/typecheck toolchain to `@mariozechner/pi-coding-agent` `0.67.2`, `tsx` `4.21.0`, `typescript` `6.0.2`, and `@types/node` `25.6.0`
- declare `packageManager: npm@11.12.1` in package metadata and refresh the lockfile to the current stable development baseline

## 1.0.11 - 2026-04-11

- make clipboard subprocess execution non-blocking and add handler-level regression coverage for `/copy-user`
- add GitHub Actions CI for `npm run check`, `npm pack --dry-run`, and install smoke tests
- declare the supported Node.js floor in package metadata, add `.nvmrc`, and switch tests to `tsx` so local tooling matches the documented floor
- pin the dev-only transitive `basic-ftp` dependency to a patched release via `overrides` and refresh the lockfile
- document tested pi compatibility in the README and backfill changelog entries for releases before `1.0.8`

## 1.0.10 - 2026-04-07

- keep local `tsc --noEmit` typechecking for development only
- remove published `peerDependencies` on `@mariozechner/pi-coding-agent` to avoid noisy `pi update` peer-resolution installs and upstream deprecation warnings for consumers
- keep the pi core package only in `devDependencies` for standalone local typecheck resolution

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

## 1.0.7 - 2026-04-04

- refine the package description to call out the `/copy-user` command explicitly
- add `clipboard` and `typescript` keywords for better package discoverability

## 1.0.6 - 2026-04-03

- add the project-local `.pi` auto-discovery wrapper and ignore generated `.pi` contents in git
- include `LICENSE` in the published package and verify publish contents with `npm pack --dry-run`
- tighten clipboard behavior around interactive OSC 52 use, transport-specific success reporting, and missing-transport errors
- expand tests and docs around wrapper imports and clipboard handling

## 1.0.5 - 2026-03-29

- add a lightweight regression test script for the extension package
- add cross-platform clipboard handling for macOS, Windows, Termux, Wayland, X11, and OSC 52 terminals
- switch local tests to import the source `.ts` entrypoint directly

## 1.0.4 - 2026-03-29

- remove the unnecessary pi peer dependency

## 1.0.3 - 2026-03-29

- add the MIT license and author metadata

## 1.0.2 - 2026-03-29

- clarify README install instructions for the published package name

## 1.0.1 - 2026-03-29

- add the package-gallery discoverability keyword

## 1.0.0 - 2026-03-29

- publish the initial `/copy-user` pi extension package
- add the first README and regression test coverage
