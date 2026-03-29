/**
 * Purpose: Provide a pi slash command for copying the most recent user message text.
 * Responsibilities: Inspect the current session branch, extract text from the latest user message, and copy it to the system clipboard.
 * Scope: Single extension command implementation and a small pure helper used by regression tests.
 * Usage: Loaded by pi as an extension package; invoke with /copy-user.
 * Invariants/Assumptions: Operates on the current branch only; copies text content only; never falls back to an older user message when the newest one has no text.
 */
import { execSync, spawn } from "node:child_process";

type ExtensionAPI = import("@mariozechner/pi-coding-agent").ExtensionAPI;
type ExtensionCommandContext = import("@mariozechner/pi-coding-agent").ExtensionCommandContext;
type SessionEntry = import("@mariozechner/pi-coding-agent").SessionEntry;

type TextBlock = {
	type?: string;
	text?: string;
};

type MostRecentUserMessageTextResult =
	| { kind: "no-user-message" }
	| { kind: "no-text" }
	| { kind: "text"; text: string };

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

const emitOsc52Clipboard = (text: string) => {
	const encoded = Buffer.from(text).toString("base64");
	process.stdout.write(`\x1b]52;c;${encoded}\x07`);
};

const copyToX11Clipboard = (text: string) => {
	try {
		execSync("xclip -selection clipboard", { input: text, stdio: ["pipe", "ignore", "ignore"], timeout: 5000 });
	} catch {
		execSync("xsel --clipboard --input", { input: text, stdio: ["pipe", "ignore", "ignore"], timeout: 5000 });
	}
};

const copyTextSafely = async (text: string) => {
	emitOsc52Clipboard(text);

	const options = { input: text, timeout: 5000, stdio: ["pipe", "ignore", "ignore"] as const };
	try {
		if (process.platform === "darwin") {
			execSync("pbcopy", options);
			return;
		}

		if (process.platform === "win32") {
			execSync("clip", options);
			return;
		}

		if (process.env.TERMUX_VERSION) {
			try {
				execSync("termux-clipboard-set", options);
				return;
			} catch {
				// Fall through to Wayland/X11 tools.
			}
		}

		const hasWaylandDisplay = Boolean(process.env.WAYLAND_DISPLAY);
		const hasX11Display = Boolean(process.env.DISPLAY);
		if (hasWaylandDisplay) {
			try {
				execSync("which wl-copy", { stdio: "ignore" });
				const proc = spawn("wl-copy", [], { stdio: ["pipe", "ignore", "ignore"] });
				proc.stdin.on("error", () => undefined);
				proc.stdin.write(text);
				proc.stdin.end();
				proc.unref();
				return;
			} catch {
				if (hasX11Display) {
					copyToX11Clipboard(text);
					return;
				}
			}
		}

		if (hasX11Display) {
			copyToX11Clipboard(text);
		}
	} catch {
		// Ignore platform clipboard failures. OSC 52 was already emitted above.
	}
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
		await copyTextSafely(result.text);
		ctx.ui.notify("Copied text from the most recent user message to clipboard.", "info");
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
		handler: (_args, ctx) => copyLatestUserMessage(ctx),
	});
}
