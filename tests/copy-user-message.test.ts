/**
 * Purpose: Regress the copy-user extension's most-recent-message selection logic.
 * Responsibilities: Verify the helper returns text only for the newest user message and never falls back to older messages.
 * Scope: Focused assertions for text, image-only, whitespace-only, and no-user-message cases, plus wrapper import coverage.
 * Usage: Executed as a lightweight TypeScript test harness during local verification.
 * Invariants/Assumptions: Imports the extension helper from the source modules and asserts stable result shapes.
 */
import assert from "node:assert/strict";

import type { SessionEntry } from "@mariozechner/pi-coding-agent";

import extension, { getMostRecentUserMessageText } from "../extensions/copy-user-message.ts";
import {
	default as autoDiscoveryExtension,
	getMostRecentUserMessageText as getMostRecentUserMessageTextFromAutoDiscovery,
} from "../.pi/extensions/copy-user-message.ts";

const userMessage = (content: unknown) =>
	({
		type: "message",
		message: { role: "user", content },
	}) as SessionEntry;

const assistantMessage = (content: unknown) =>
	({
		type: "message",
		message: { role: "assistant", content },
	}) as SessionEntry;

assert.equal(typeof extension, "function");
assert.equal(typeof autoDiscoveryExtension, "function");
assert.equal(getMostRecentUserMessageTextFromAutoDiscovery, getMostRecentUserMessageText);

const textResult = getMostRecentUserMessageText([
	userMessage("older text"),
	assistantMessage([{ type: "text", text: "reply" }]),
	userMessage([
		{ type: "text", text: "latest line 1" },
		{ type: "image", data: "ignored", mimeType: "image/png" },
		{ type: "text", text: "latest line 2" },
	]),
]);
assert.deepEqual(textResult, { kind: "text", text: "latest line 1\nlatest line 2" });

const noTextResult = getMostRecentUserMessageText([
	userMessage("older text"),
	userMessage([{ type: "image", data: "ignored", mimeType: "image/png" }]),
]);
assert.deepEqual(noTextResult, { kind: "no-text" });

const whitespaceOnlyResult = getMostRecentUserMessageText([
	userMessage("older text"),
	userMessage([{ type: "text", text: "   " }]),
]);
assert.deepEqual(whitespaceOnlyResult, { kind: "no-text" });

const noUserMessageResult = getMostRecentUserMessageText([assistantMessage([{ type: "text", text: "reply" }])]);
assert.deepEqual(noUserMessageResult, { kind: "no-user-message" });
