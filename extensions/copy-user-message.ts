/**
 * Purpose: Provide a pi slash command for copying the most recent user message text.
 * Responsibilities: Inspect the current session branch, extract text from the latest user message, and copy it via non-blocking clipboard transports.
 * Scope: Single extension command implementation and a small set of helpers used by regression tests.
 * Usage: Loaded by pi as an extension package; invoke with /copy-user.
 * Invariants/Assumptions: Operates on the current branch only; copies text content only; never falls back to an older user message when the newest one has no text.
 */
import { spawn } from "node:child_process";

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

type ClipboardCommandRunner = (command: string, args: string[], text: string) => Promise<boolean>;
type CopyTextFunction = (
	text: string,
	ctx: Pick<ExtensionCommandContext, "hasUI">,
) => Promise<ClipboardCopyResult>;

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

export const emitOsc52Clipboard = (text: string, ctx: Pick<ExtensionCommandContext, "hasUI">) => {
	if (!canUseOsc52Clipboard(ctx)) {
		return false;
	}

	const encoded = Buffer.from(text, "utf8").toString("base64");
	process.stdout.write(`\x1b]52;c;${encoded}\x07`);
	return true;
};

const runClipboardCommand: ClipboardCommandRunner = (command, args, text) =>
	new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: ["pipe", "ignore", "ignore"],
			timeout: CLIPBOARD_COMMAND_TIMEOUT_MS,
		});

		let settled = false;
		const finish = (result: { ok: true } | { ok: false; error: Error }) => {
			if (settled) {
				return;
			}
			settled = true;

			if (result.ok) {
				resolve(true);
				return;
			}

			reject(result.error);
		};

		child.once("error", (error) => {
			finish({ ok: false, error });
		});

		child.once("close", (code, signal) => {
			if (code === 0) {
				finish({ ok: true });
				return;
			}

			finish({
				ok: false,
				error: new Error(
					signal
						? `Clipboard command ${command} was terminated by ${signal}.`
						: `Clipboard command ${command} exited with code ${code ?? "unknown"}.`,
				),
			});
		});

		child.stdin?.once("error", (error) => {
			finish({ ok: false, error });
		});
		child.stdin?.end(text);
	});

const tryClipboardCommand = async (
	command: string,
	args: string[],
	text: string,
	commandRunner: ClipboardCommandRunner,
) => {
	try {
		return await commandRunner(command, args, text);
	} catch {
		return false;
	}
};

const copyToX11Clipboard = async (text: string, commandRunner: ClipboardCommandRunner) =>
	(await tryClipboardCommand("xclip", ["-selection", "clipboard"], text, commandRunner)) ||
	(await tryClipboardCommand("xsel", ["--clipboard", "--input"], text, commandRunner));

export const copyTextToSystemClipboard = async (
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

	if (environment.termuxVersion && (await tryClipboardCommand("termux-clipboard-set", [], text, commandRunner))) {
		return true;
	}

	if (environment.waylandDisplay && (await tryClipboardCommand("wl-copy", [], text, commandRunner))) {
		return true;
	}

	if (environment.display) {
		return copyToX11Clipboard(text, commandRunner);
	}

	return false;
};

const copyTextSafely: CopyTextFunction = async (text, ctx) => {
	const usedOsc52 = emitOsc52Clipboard(text, ctx);
	const usedSystemClipboard = await copyTextToSystemClipboard(text, {
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

const copyLatestUserMessage = async (
	ctx: ExtensionCommandContext,
	copyText: CopyTextFunction = copyTextSafely,
) => {
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
		const copyResult = await copyText(result.text, ctx);
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

export const registerCopyUserCommand = (
	pi: Pick<ExtensionAPI, "registerCommand">,
	copyText: CopyTextFunction = copyTextSafely,
) => {
	pi.registerCommand("copy-user", {
		description: "Copy the text from the most recent user message to the clipboard",
		handler: async (_args, ctx) => {
			await copyLatestUserMessage(ctx, copyText);
		},
	});
};

export default function (pi: ExtensionAPI) {
	registerCopyUserCommand(pi);
}
