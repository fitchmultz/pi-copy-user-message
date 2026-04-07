/**
 * Purpose: Provide a project-local pi auto-discovery entrypoint for the copy-user extension.
 * Responsibilities: Re-export the package extension implementation from the conventional public package path.
 * Scope: Thin local wrapper only; all behavior lives in ../../extensions/copy-user-message.ts.
 * Usage: Auto-discovered by pi when running inside this repository.
 * Invariants/Assumptions: Keeps local development auto-discovery aligned with the publishable package entrypoint.
 */
export { copyTextToSystemClipboard, getMostRecentUserMessageText } from "../../extensions/copy-user-message.ts";
export { default } from "../../extensions/copy-user-message.ts";
