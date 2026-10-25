import assert from "node:assert/strict";
import test from "node:test";
import { applyStatusSubscriptions, applyToolResult, statusLabel } from "../extensions/mcp-events-status.ts";

const live = (id: string, status = "active") => ({ id, status, server: "figma-listen", name: "figma.comment.created" });

test("subscribe adds the returned subscription", () => {
  const ids = new Set<string>();
  applyToolResult(ids, { action: "subscribe", server: "figma-listen" }, { subscription: live("s1") }, false);
  assert.deepEqual([...ids], ["s1"]);
});

test("unsubscribe removes subscription_id even though the result has no subscription", () => {
  const ids = new Set(["s1", "s2"]);
  applyToolResult(ids, { action: "unsubscribe", subscription_id: "s1" }, { stopped: true }, false);
  assert.deepEqual([...ids], ["s2"]);
});

test("a failed unsubscribe leaves the count alone", () => {
  const ids = new Set(["s1"]);
  applyToolResult(
    ids,
    { action: "unsubscribe", subscription_id: "s1" },
    { error: "MCP connection closed" },
    true,
  );
  assert.deepEqual([...ids], ["s1"]);
});

test("list replaces the set and skips ended, failed, and stopped records", () => {
  const ids = new Set(["stale"]);
  applyToolResult(
    ids,
    { action: "list" },
    {
      subscriptions: [
        live("open", "opening"),
        live("up", "active"),
        live("retry", "reconnecting"),
        live("done", "ended"),
        live("bad", "failed"),
        live("halt", "stopped"),
        { status: "active" },
      ],
    },
    false,
  );
  assert.deepEqual([...ids].sort(), ["open", "retry", "up"]);
});

test("catalog and other tools do not change the set", () => {
  const ids = new Set(["s1"]);
  applyToolResult(ids, { action: "catalog", server: "figma-listen" }, { events: [] }, false);
  assert.deepEqual([...ids], ["s1"]);
});

test("a status batch keeps the last state when one subscription appears twice", () => {
  const ids = new Set<string>();
  applyStatusSubscriptions(ids, [
    live("s1", "active"),
    live("s1", "ended"),
    live("s2", "ended"),
    live("s2", "reconnecting"),
  ]);
  assert.deepEqual([...ids], ["s2"]);
});

test("status messages add reconnecting subscriptions and drop dead ones", () => {
  const ids = new Set(["s1", "s2"]);
  applyStatusSubscriptions(ids, [
    live("s1", "reconnecting"),
    live("s2", "failed"),
    live("s3", "ended"),
    live("s4", "stopped"),
    live("s5", "active"),
  ]);
  assert.deepEqual([...ids].sort(), ["s1", "s5"]);
});

test("status label matches the footer text", () => {
  assert.equal(statusLabel(0), "MCP events: 0 subs");
  assert.equal(statusLabel(1), "MCP events: 1 sub");
  assert.equal(statusLabel(2), "MCP events: 2 subs");
});
