import assert from "node:assert/strict";

import { getMostRecentUserMessageText } from "../.pi/extensions/copy-user-message.js";

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

