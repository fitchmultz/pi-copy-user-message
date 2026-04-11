/**
 * Purpose: Regress the copy-user extension's most-recent-message selection, command wiring, and clipboard transport logic.
 * Responsibilities: Verify the helper returns text only for the newest user message, the registered /copy-user command reports the right notifications, and clipboard fallbacks stay ordered and honest about success.
 * Scope: Focused assertions for text, image-only, whitespace-only, no-user-message, OSC 52 emission, command-path notifications, and clipboard transport cases, plus wrapper import coverage.
 * Usage: Executed as a lightweight TypeScript test harness during local verification.
 * Invariants/Assumptions: Imports the extension helpers from the source modules and asserts stable result shapes.
 */
import assert from "node:assert/strict";

import type { ExtensionAPI, ExtensionCommandContext, SessionEntry } from "@mariozechner/pi-coding-agent";

import extension, {
	copyTextToSystemClipboard,
	emitOsc52Clipboard,
	getMostRecentUserMessageText,
	registerCopyUserCommand,
} from "../extensions/copy-user-message.ts";
import {
	copyTextToSystemClipboard as copyTextToSystemClipboardFromAutoDiscovery,
	default as autoDiscoveryExtension,
	emitOsc52Clipboard as emitOsc52ClipboardFromAutoDiscovery,
	getMostRecentUserMessageText as getMostRecentUserMessageTextFromAutoDiscovery,
	registerCopyUserCommand as registerCopyUserCommandFromAutoDiscovery,
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

type RegisteredCommand = {
	name: string;
	options: {
		description?: string;
		handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
	};
};

const captureRegisteredCommand = (register: (pi: Pick<ExtensionAPI, "registerCommand">) => void) => {
	let registered: RegisteredCommand | undefined;
	register({
		registerCommand: (name, options) => {
			registered = { name, options };
		},
	});

	assert.ok(registered);
	return registered;
};

const registerCommandUnderTest = (copyText: Parameters<typeof registerCopyUserCommand>[1]) => {
	const registered = captureRegisteredCommand((pi) => {
		registerCopyUserCommand(pi, copyText);
	});
	assert.equal(registered.name, "copy-user");
	assert.equal(registered.options.description, "Copy the text from the most recent user message to the clipboard");
	return registered.options;
};

const createCommandContext = (entries: SessionEntry[]) => {
	const notifications: Array<{ message: string; type: string | undefined }> = [];
	const ctx = {
		hasUI: true,
		sessionManager: {
			getBranch: () => entries,
		},
		ui: {
			notify: (message: string, type?: "info" | "warning" | "error") => {
				notifications.push({ message, type });
			},
		},
	} as ExtensionCommandContext;

	return { ctx, notifications };
};

assert.equal(typeof extension, "function");
assert.equal(typeof autoDiscoveryExtension, "function");
assert.equal(getMostRecentUserMessageTextFromAutoDiscovery, getMostRecentUserMessageText);
assert.equal(copyTextToSystemClipboardFromAutoDiscovery, copyTextToSystemClipboard);
assert.equal(emitOsc52ClipboardFromAutoDiscovery, emitOsc52Clipboard);
assert.equal(registerCopyUserCommandFromAutoDiscovery, registerCopyUserCommand);

const defaultRegistration = captureRegisteredCommand((pi) => {
	extension(pi as ExtensionAPI);
});
assert.equal(defaultRegistration.name, "copy-user");
assert.equal(typeof defaultRegistration.options.handler, "function");

const autoDiscoveryRegistration = captureRegisteredCommand((pi) => {
	autoDiscoveryExtension(pi as ExtensionAPI);
});
assert.equal(autoDiscoveryRegistration.name, "copy-user");
assert.equal(typeof autoDiscoveryRegistration.options.handler, "function");

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

{
	const originalWrite = process.stdout.write;
	const originalTerm = process.env.TERM;
	const originalIsTTY = process.stdout.isTTY;
	const writes: string[] = [];

	process.env.TERM = "xterm-256color";
	Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
	process.stdout.write = ((chunk: string | Uint8Array) => {
		writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
		return true;
	}) as typeof process.stdout.write;

	try {
		assert.equal(emitOsc52Clipboard("hello", { hasUI: true }), true);
		assert.deepEqual(writes, ["\u001b]52;c;aGVsbG8=\u0007"]);
		assert.equal(emitOsc52Clipboard("hello", { hasUI: false }), false);
	} finally {
		process.stdout.write = originalWrite;
		process.env.TERM = originalTerm;
		Object.defineProperty(process.stdout, "isTTY", { value: originalIsTTY, configurable: true });
	}
}

{
	const copyCalls: Array<{ text: string; hasUI: boolean }> = [];
	const command = registerCommandUnderTest(async (text, ctx) => {
		copyCalls.push({ text, hasUI: ctx.hasUI });
		return { usedOsc52: false, usedSystemClipboard: true };
	});
	const { ctx, notifications } = createCommandContext([
		assistantMessage("reply"),
		userMessage([{ type: "text", text: "latest text" }]),
	]);
	await command.handler("", ctx);
	assert.deepEqual(copyCalls, [{ text: "latest text", hasUI: true }]);
	assert.deepEqual(notifications, [
		{ message: "Copied text from the most recent user message to clipboard.", type: "info" },
	]);
}

{
	const command = registerCommandUnderTest(async () => ({ usedOsc52: true, usedSystemClipboard: false }));
	const { ctx, notifications } = createCommandContext([userMessage([{ type: "text", text: "latest text" }])]);
	await command.handler("", ctx);
	assert.deepEqual(notifications, [
		{
			message: "Sent text from the most recent user message via the terminal clipboard (OSC 52).",
			type: "info",
		},
	]);
}

{
	const command = registerCommandUnderTest(async () => {
		assert.fail("copy transport should not run when there are no user messages");
	});
	const { ctx, notifications } = createCommandContext([assistantMessage([{ type: "text", text: "reply" }])]);
	await command.handler("", ctx);
	assert.deepEqual(notifications, [{ message: "No user messages found.", type: "warning" }]);
}

{
	const command = registerCommandUnderTest(async () => {
		assert.fail("copy transport should not run when the latest user message has no text");
	});
	const { ctx, notifications } = createCommandContext([
		userMessage("older text"),
		userMessage([{ type: "image", data: "ignored", mimeType: "image/png" }]),
	]);
	await command.handler("", ctx);
	assert.deepEqual(notifications, [
		{ message: "The most recent user message has no text to copy.", type: "warning" },
	]);
}

{
	const command = registerCommandUnderTest(async () => {
		throw new Error("clipboard transport failed");
	});
	const { ctx, notifications } = createCommandContext([userMessage([{ type: "text", text: "latest text" }])]);
	await command.handler("", ctx);
	assert.deepEqual(notifications, [{ message: "Failed to copy user message: clipboard transport failed", type: "error" }]);
}

const attemptedCommands: Array<{ command: string; args: string[] }> = [];
const fallbackClipboardResult = await copyTextToSystemClipboard(
	"hello",
	{
		platform: "linux",
		termuxVersion: "1",
		waylandDisplay: "wayland-1",
		display: ":0",
	},
	async (command, args) => {
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

const xselFallbackCommands: Array<{ command: string; args: string[] }> = [];
const xselFallbackResult = await copyTextToSystemClipboard(
	"hello",
	{
		platform: "linux",
		display: ":0",
	},
	async (command, args) => {
		xselFallbackCommands.push({ command, args });
		return command === "xsel";
	},
);
assert.equal(xselFallbackResult, true);
assert.deepEqual(xselFallbackCommands, [
	{ command: "xclip", args: ["-selection", "clipboard"] },
	{ command: "xsel", args: ["--clipboard", "--input"] },
]);

const darwinCommands: Array<{ command: string; args: string[]; text: string }> = [];
const darwinResult = await copyTextToSystemClipboard(
	"hello",
	{ platform: "darwin" },
	async (command, args, text) => {
		darwinCommands.push({ command, args, text });
		return true;
	},
);
assert.equal(darwinResult, true);
assert.deepEqual(darwinCommands, [{ command: "pbcopy", args: [], text: "hello" }]);

const win32Commands: Array<{ command: string; args: string[]; text: string }> = [];
const win32Result = await copyTextToSystemClipboard(
	"hello",
	{ platform: "win32" },
	async (command, args, text) => {
		win32Commands.push({ command, args, text });
		return true;
	},
);
assert.equal(win32Result, true);
assert.deepEqual(win32Commands, [{ command: "clip", args: [], text: "hello" }]);

const failedWaylandResult = await copyTextToSystemClipboard(
	"hello",
	{
		platform: "linux",
		waylandDisplay: "wayland-1",
	},
	async (command) => (command === "wl-copy" ? false : assert.fail(`Unexpected command: ${command}`)),
);
assert.equal(failedWaylandResult, false);

const unsupportedTransportResult = await copyTextToSystemClipboard("hello", { platform: "linux" }, async () => {
	assert.fail("No clipboard command should run without a supported transport hint");
});
assert.equal(unsupportedTransportResult, false);
