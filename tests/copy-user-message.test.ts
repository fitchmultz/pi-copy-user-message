/**
 * Purpose: Regress the copy-user extension's most-recent-message selection and clipboard transport logic.
 * Responsibilities: Verify the helper returns text only for the newest user message and that Linux clipboard fallbacks stay ordered and honest about success.
 * Scope: Focused assertions for text, image-only, whitespace-only, no-user-message, and clipboard fallback cases, plus wrapper import coverage.
 * Usage: Executed as a lightweight TypeScript test harness during local verification.
 * Invariants/Assumptions: Imports the extension helpers from the source modules and asserts stable result shapes.
 */
import assert from "node:assert/strict";

import type { SessionEntry } from "@mariozechner/pi-coding-agent";

import extension, {
	copyTextToSystemClipboard,
	getMostRecentUserMessageText,
} from "../extensions/copy-user-message.ts";
import {
	copyTextToSystemClipboard as copyTextToSystemClipboardFromAutoDiscovery,
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
assert.equal(copyTextToSystemClipboardFromAutoDiscovery, copyTextToSystemClipboard);

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

const attemptedCommands: Array<{ command: string; args: string[] }> = [];
const fallbackClipboardResult = copyTextToSystemClipboard(
	"hello",
	{
		platform: "linux",
		termuxVersion: "1",
		waylandDisplay: "wayland-1",
		display: ":0",
	},
	(command, args) => {
		attemptedCommands.push({ command, args });
		return command === "xclip";
	},
);
assert.equal(fallbackClipboardResult, true);
assert.deepEqual(attemptedCommands, [
	{ command: "termux-clipboard-set", args: [] },
	{ command: "wl-copy", args: [] },
	{ command: "xclip", args: ["-selection", "clipboard"] },
]);

const failedWaylandResult = copyTextToSystemClipboard(
	"hello",
	{
		platform: "linux",
		waylandDisplay: "wayland-1",
	},
	(command) => command === "wl-copy" ? false : assert.fail(`Unexpected command: ${command}`),
);
assert.equal(failedWaylandResult, false);
