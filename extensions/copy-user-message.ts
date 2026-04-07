/**
 * Purpose: Provide a pi slash command for copying the most recent user message text.
 * Responsibilities: Inspect the current session branch, extract text from the latest user message, and copy it to the system clipboard.
 * Scope: Single extension command implementation and a small pure helper used by regression tests.
 * Usage: Loaded by pi as an extension package; invoke with /copy-user.
 * Invariants/Assumptions: Operates on the current branch only; copies text content only; never falls back to an older user message when the newest one has no text.
 */
import { execFileSync } from "node:child_process";

import type { ExtensionAPI, ExtensionCommandContext, SessionEntry } from "@mariozechner/pi-coding-agent";

type TextBlock = {
	type?: string;
	text?: string;
};

type MostRecentUserMessageTextResult =
	| { kind: "no-user-message" }
	| { kind: "no-text" }
	| { kind: "text"; text: string };

type ClipboardCopyResult = {
	usedOsc52: boolean;
	usedSystemClipboard: boolean;
};

type ClipboardEnvironment = {
	platform: NodeJS.Platform;
	termuxVersion?: string;
	waylandDisplay?: string;
	display?: string;
};

type ClipboardCommandRunner = (command: string, args: string[], text: string) => boolean;

const CLIPBOARD_COMMAND_TIMEOUT_MS = 5000;

const extractText = (content: unknown): string | undefined => {
	if (typeof content === "string") {
		return content;
	}

	if (!Array.isArray(content)) {
		return undefined;
	}

	const parts: string[] = [];
	for (const block of content) {
		if (!block || typeof block !== "object") {
			continue;
		}

		const textBlock = block as TextBlock;
		if (textBlock.type === "text" && typeof textBlock.text === "string") {
			parts.push(textBlock.text);
		}
	}

	if (parts.length === 0) {
		return undefined;
	}

	return parts.join("\n");
};

export const getMostRecentUserMessageText = (entries: SessionEntry[]): MostRecentUserMessageTextResult => {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type !== "message" || !entry.message || entry.message.role !== "user") {
			continue;
		}

		const text = extractText(entry.message.content);
		if (!text || text.trim().length === 0) {
			return { kind: "no-text" };
		}

		return { kind: "text", text };
	}

	return { kind: "no-user-message" };
};

const canUseOsc52Clipboard = (ctx: Pick<ExtensionCommandContext, "hasUI">) =>
	ctx.hasUI && Boolean(process.stdout.isTTY) && process.env.TERM !== "dumb";

const emitOsc52Clipboard = (text: string, ctx: Pick<ExtensionCommandContext, "hasUI">) => {
	if (!canUseOsc52Clipboard(ctx)) {
		return false;
	}

	const encoded = Buffer.from(text, "utf8").toString("base64");
	process.stdout.write(`\x1b]52;c;${encoded}\x07`);
	return true;
};

const runClipboardCommand: ClipboardCommandRunner = (command, args, text) => {
	execFileSync(command, args, {
		input: text,
		stdio: ["pipe", "ignore", "ignore"],
		timeout: CLIPBOARD_COMMAND_TIMEOUT_MS,
	});
	return true;
};

const tryClipboardCommand = (
	command: string,
	args: string[],
	text: string,
	commandRunner: ClipboardCommandRunner,
) => {
	try {
		return commandRunner(command, args, text);
	} catch {
		return false;
	}
};

const copyToX11Clipboard = (text: string, commandRunner: ClipboardCommandRunner) =>
	tryClipboardCommand("xclip", ["-selection", "clipboard"], text, commandRunner) ||
	tryClipboardCommand("xsel", ["--clipboard", "--input"], text, commandRunner);

export const copyTextToSystemClipboard = (
	text: string,
	environment: ClipboardEnvironment,
	commandRunner: ClipboardCommandRunner = runClipboardCommand,
) => {
	if (environment.platform === "darwin") {
		return tryClipboardCommand("pbcopy", [], text, commandRunner);
	}

	if (environment.platform === "win32") {
		return tryClipboardCommand("clip", [], text, commandRunner);
	}

	if (environment.termuxVersion && tryClipboardCommand("termux-clipboard-set", [], text, commandRunner)) {
		return true;
	}

	if (environment.waylandDisplay && tryClipboardCommand("wl-copy", [], text, commandRunner)) {
		return true;
	}

	if (environment.display) {
		return copyToX11Clipboard(text, commandRunner);
	}

	return false;
};

const copyTextSafely = (text: string, ctx: Pick<ExtensionCommandContext, "hasUI">): ClipboardCopyResult => {
	const usedOsc52 = emitOsc52Clipboard(text, ctx);
	const usedSystemClipboard = copyTextToSystemClipboard(text, {
		platform: process.platform,
		termuxVersion: process.env.TERMUX_VERSION,
		waylandDisplay: process.env.WAYLAND_DISPLAY,
		display: process.env.DISPLAY,
	});

	if (!usedOsc52 && !usedSystemClipboard) {
		throw new Error("No supported clipboard transport is available in this environment.");
	}

	return { usedOsc52, usedSystemClipboard };
};

const copyLatestUserMessage = (ctx: ExtensionCommandContext) => {
	const result = getMostRecentUserMessageText(ctx.sessionManager.getBranch());

	if (result.kind === "no-user-message") {
		ctx.ui.notify("No user messages found.", "warning");
		return;
	}

	if (result.kind === "no-text") {
		ctx.ui.notify("The most recent user message has no text to copy.", "warning");
		return;
	}

	try {
		const copyResult = copyTextSafely(result.text, ctx);
		ctx.ui.notify(
			copyResult.usedSystemClipboard
				? "Copied text from the most recent user message to clipboard."
				: "Sent text from the most recent user message via the terminal clipboard (OSC 52).",
			"info",
		);
	} catch (error) {
		ctx.ui.notify(
			`Failed to copy user message: ${error instanceof Error ? error.message : String(error)}`,
			"error",
		);
	}
};

export default function (pi: ExtensionAPI) {
	pi.registerCommand("copy-user", {
		description: "Copy the text from the most recent user message to the clipboard",
		handler: async (_args, ctx) => {
			copyLatestUserMessage(ctx);
		},
	});
}
