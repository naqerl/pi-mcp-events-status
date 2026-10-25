import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "mcp-events";

/** Statuses pi-mcp-events keeps in its map after the stream is gone. */
const DEAD = new Set(["ended", "failed", "stopped"]);

export interface SubscriptionRef {
  id?: unknown;
  status?: unknown;
}

interface ToolArgs {
  action?: unknown;
  subscription_id?: unknown;
}

interface ToolDetails {
  subscriptions?: unknown;
  subscription?: unknown;
}

export function statusLabel(count: number): string {
  if (count === 0) return "MCP events: 0 subs";
  return `MCP events: ${count} sub${count === 1 ? "" : "s"}`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  return value as Record<string, unknown>;
}

function subscriptionId(value: unknown): string | undefined {
  const id = asRecord(value)?.id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function isDead(value: unknown): boolean {
  const status = asRecord(value)?.status;
  return typeof status === "string" && DEAD.has(status);
}

function remember(ids: Set<string>, value: unknown): void {
  const id = subscriptionId(value);
  if (!id) return;
  if (isDead(value)) ids.delete(id);
  else ids.add(id);
}

/**
 * Apply one successful `mcp_events` tool result.
 * `list` replaces the set. `subscribe` adds the returned subscription.
 * `unsubscribe` removes `subscription_id` from the tool input, because the
 * result is only `{ stopped: true }`.
 */
export function applyToolResult(ids: Set<string>, input: unknown, details: unknown, isError: boolean): void {
  if (isError) return;
  const args = asRecord(input) as ToolArgs | undefined;
  const body = asRecord(details) as ToolDetails | undefined;
  if (!args || !body) return;

  if (args.action === "list" && Array.isArray(body.subscriptions)) {
    ids.clear();
    for (const item of body.subscriptions) remember(ids, item);
    return;
  }
  if (args.action === "subscribe") {
    remember(ids, body.subscription);
    return;
  }
  if (args.action === "unsubscribe") {
    const id = args.subscription_id;
    if (typeof id === "string" && id.length > 0) ids.delete(id);
  }
}

/** Apply one `mcp-events-status` custom message. Dead statuses leave the set. */
export function applyStatusSubscriptions(ids: Set<string>, subscriptions: unknown): void {
  if (!Array.isArray(subscriptions)) return;
  for (const item of subscriptions) remember(ids, item);
}

function paint(ids: Set<string>, ctx: ExtensionContext): void {
  ctx.ui.setStatus(STATUS_KEY, statusLabel(ids.size));
}

export default function (pi: ExtensionAPI) {
  const ids = new Set<string>();

  pi.on("session_start", (_event, ctx) => {
    ids.clear();
    paint(ids, ctx);
  });

  // tool_execution_end has no tool input, so unsubscribe cannot see subscription_id there.
  pi.on("tool_result", (event, ctx) => {
    if (event.toolName !== "mcp_events") return;
    applyToolResult(ids, event.input, event.details, event.isError);
    paint(ids, ctx);
  });

  pi.on("message_end", (event, ctx) => {
    const message = event.message;
    if (message.role !== "custom" || message.customType !== "mcp-events-status") return;
    const details = asRecord(message.details);
    applyStatusSubscriptions(ids, details?.subscriptions);
    paint(ids, ctx);
  });

  pi.on("session_shutdown", (_event, ctx) => {
    ids.clear();
    ctx.ui.setStatus(STATUS_KEY, undefined);
  });
}
