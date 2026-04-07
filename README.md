# pi copy-user extension

A tiny [pi](https://github.com/badlogic/pi-mono) extension that adds a slash command for copying the **most recent user message** to your clipboard.

## What it does

- Adds `/copy-user`
- Copies the text from the most recent user message in the current session
- Preserves line breaks between text blocks
- Uses the system clipboard when available and a terminal OSC 52 clipboard escape in interactive TTY sessions
- Does **not** fall back to an older message if the latest user message has no text

## Install

Install it from npm with pi:

```bash
pi install npm:pi-copy-user-message
```

Or install it directly from GitHub with pi:

```bash
pi install https://github.com/fitchmultz/pi-copy-user-message
```

Then reload pi from inside the app with:

```text
/reload
```

If you prefer to load it directly from a local checkout during development, you can point pi at the package entrypoint:

```bash
pi -e ./extensions/copy-user-message.ts
```

## Usage

Once loaded, run:

```text
/copy-user
```

The command will:

- copy the newest user message text to the clipboard
- show a warning if there are no user messages
- show a warning if the newest user message contains no text

## Behavior notes

- Text-only by design: image-only user messages are not copied.
- If a user message contains multiple text blocks, they are joined with newlines.
- OSC 52 is only emitted in interactive TTY sessions, so print/RPC output stays clean.
- On Linux-family environments, the extension tries `termux-clipboard-set`, then `wl-copy`, then X11 tools (`xclip`, then `xsel`).
- If no supported clipboard transport is available, the command reports an error instead of claiming success.
- The command is intentionally strict about “most recent” so it never copies an older user message by mistake.

## Development

This repo includes a small regression test in:

- `tests/copy-user-message.test.ts`

The test covers:

- latest text message
- latest image-only message
- latest whitespace-only message
- no user message at all
- Linux clipboard fallback ordering
- failed Wayland clipboard transport

## Files

- `extensions/copy-user-message.ts` — publishable extension implementation
- `.pi/extensions/copy-user-message.ts` — thin project-local wrapper for auto-discovery in this repo
- `tests/copy-user-message.test.ts` — regression test for message selection and clipboard fallback behavior
