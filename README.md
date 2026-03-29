# pi copy-user extension

A tiny [pi](https://github.com/badlogic/pi-mono) extension that adds a slash command for copying the **most recent user message** to your clipboard.

## What it does

- Adds `/copy-user`
- Copies the text from the most recent user message in the current session
- Preserves line breaks between text blocks
- Does **not** fall back to an older message if the latest user message has no text

## Install

Install it directly from GitHub with pi:

```bash
pi install git:github.com/fitchmultz/pi-copy-user-message
```

Then reload pi from inside the app with:

```text
/reload
```

If you prefer a project-local install, keep the file at:

```text
.pi/extensions/copy-user-message.ts
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
- The command is intentionally strict about “most recent” so it never copies an older user message by mistake.

## Development

This repo includes a small regression test in:

- `tests/copy-user-message.test.ts`

The test covers:

- latest text message
- latest image-only message
- latest whitespace-only message
- no user message at all

## Files

- `.pi/extensions/copy-user-message.ts` — extension implementation
- `tests/copy-user-message.test.ts` — regression test
