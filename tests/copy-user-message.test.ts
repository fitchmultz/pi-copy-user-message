/**
 * Purpose: Regress the copy-user extension's most-recent-message selection logic.
 * Responsibilities: Verify the helper returns text only for the newest user message and never falls back to older messages.
 * Scope: Focused assertions for text, image-only, whitespace-only, and no-user-message cases.
 * Usage: Compiled and run as a lightweight TypeScript test harness during local verification.
 * Invariants/Assumptions: Imports the extension helper from the compiled extension module and asserts stable result shapes.
 */
import assert from "node:assert/strict";

import { getMostRecentUserMessageText } from "../extensions/copy-user-message.ts";

const textResult = getMostRecentUserMessageText([
	{ type: "message", message: { role: "user", content: "older text" } } as any,
	{ type: "message", message: { role: "assistant", content: [{ type: "text", text: "reply" }] } } as any,
	{
		type: "message",
		message: {
			role: "user",
			content: [
				{ type: "text", text: "latest line 1" },
				{ type: "image", data: "ignored", mimeType: "image/png" },
				{ type: "text", text: "latest line 2" },
			],
		},
	} as any,
]);
assert.deepEqual(textResult, { kind: "text", text: "latest line 1\nlatest line 2" });

const noTextResult = getMostRecentUserMessageText([
	{ type: "message", message: { role: "user", content: "older text" } } as any,
	{
		type: "message",
		message: {
			role: "user",
			content: [{ type: "image", data: "ignored", mimeType: "image/png" }],
		},
	} as any,
]);
assert.deepEqual(noTextResult, { kind: "no-text" });

const whitespaceOnlyResult = getMostRecentUserMessageText([
	{ type: "message", message: { role: "user", content: "older text" } } as any,
	{
		type: "message",
		message: {
			role: "user",
			content: [{ type: "text", text: "   " }],
		},
	} as any,
]);
assert.deepEqual(whitespaceOnlyResult, { kind: "no-text" });

const noUserMessageResult = getMostRecentUserMessageText([
	{ type: "message", message: { role: "assistant", content: [{ type: "text", text: "reply" }] } } as any,
]);
assert.deepEqual(noUserMessageResult, { kind: "no-user-message" });

