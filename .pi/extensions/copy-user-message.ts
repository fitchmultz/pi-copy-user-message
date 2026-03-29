/**
 * Purpose: Provide a pi slash command for copying the most recent user message text.
 * Responsibilities: Inspect the current session branch, extract text from the latest user message, and copy it to the system clipboard.
 * Scope: Single extension command implementation and a small pure helper used by regression tests.
 * Usage: Loaded by pi as an extension package; invoke with /copy-user.
 * Invariants/Assumptions: Operates on the current branch only; copies text content only; never falls back to an older user message when the newest one has no text.
 */
import { copyToClipboard, type ExtensionAPI, type ExtensionCommandContext, type SessionEntry } from "@mariozechner/pi-coding-agent";

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
		await copyToClipboard(result.text);
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
