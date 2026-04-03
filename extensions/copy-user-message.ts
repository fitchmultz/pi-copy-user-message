/**
 * Purpose: Provide a pi slash command for copying the most recent user message text.
 * Responsibilities: Inspect the current session branch, extract text from the latest user message, and copy it to the system clipboard.
 * Scope: Single extension command implementation and a small pure helper used by regression tests.
 * Usage: Loaded by pi as an extension package; invoke with /copy-user.
 * Invariants/Assumptions: Operates on the current branch only; copies text content only; never falls back to an older user message when the newest one has no text.
 */
import { execFileSync, spawn } from "node:child_process";

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

const runClipboardCommand = (command: string, args: string[], text: string) => {
	execFileSync(command, args, {
		input: text,
		stdio: ["pipe", "ignore", "ignore"],
		timeout: CLIPBOARD_COMMAND_TIMEOUT_MS,
	});
	return true;
};

const copyToX11Clipboard = (text: string) => {
	try {
		return runClipboardCommand("xclip", ["-selection", "clipboard"], text);
	} catch {
		return runClipboardCommand("xsel", ["--clipboard", "--input"], text);
	}
};

const copyToWaylandClipboard = (text: string) =>
	new Promise<boolean>((resolve, reject) => {
		const proc = spawn("wl-copy", [], { stdio: ["pipe", "ignore", "ignore"] });
		let settled = false;

		const succeed = () => {
			if (settled) {
				return;
			}

			settled = true;
			proc.unref();
			resolve(true);
		};

		const fail = (error: Error) => {
			if (settled) {
				return;
			}

			settled = true;
			reject(error);
		};

		proc.once("error", fail);
		proc.stdin.on("error", fail);
		proc.stdin.end(text, succeed);
	});

const copyTextSafely = async (
	text: string,
	ctx: Pick<ExtensionCommandContext, "hasUI">,
): Promise<ClipboardCopyResult> => {
	const usedOsc52 = emitOsc52Clipboard(text, ctx);
	let usedSystemClipboard = false;

	try {
		if (process.platform === "darwin") {
			usedSystemClipboard = runClipboardCommand("pbcopy", [], text);
		} else if (process.platform === "win32") {
			usedSystemClipboard = runClipboardCommand("clip", [], text);
		} else if (process.env.TERMUX_VERSION) {
			try {
				usedSystemClipboard = runClipboardCommand("termux-clipboard-set", [], text);
			} catch {
				// Fall through to Wayland/X11 tools.
			}
		} else {
			const hasWaylandDisplay = Boolean(process.env.WAYLAND_DISPLAY);
			const hasX11Display = Boolean(process.env.DISPLAY);

			if (hasWaylandDisplay) {
				try {
					usedSystemClipboard = await copyToWaylandClipboard(text);
				} catch {
					if (hasX11Display) {
						usedSystemClipboard = copyToX11Clipboard(text);
					}
				}
			} else if (hasX11Display) {
				usedSystemClipboard = copyToX11Clipboard(text);
			}
		}
	} catch {
		// Prefer the explicit transport check below over leaking platform-specific command errors.
	}

	if (!usedOsc52 && !usedSystemClipboard) {
		throw new Error("No supported clipboard transport is available in this environment.");
	}

	return { usedOsc52, usedSystemClipboard };
};

const copyLatestUserMessage = async (ctx: ExtensionCommandContext) => {
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
		const copyResult = await copyTextSafely(result.text, ctx);
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
		handler: async (_args, ctx) => copyLatestUserMessage(ctx),
	});
}
