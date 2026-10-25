# pi-mcp-events-status

Shows the live [Pi MCP Events](https://github.com/mikekelly/pi-mcp-events) subscription count in the Pi footer.

The label is `MCP events: N subs`. N counts subscriptions that are opening, active, or reconnecting. Ended, failed, and stopped records stay out of the count.

## Install

This package does not install Pi MCP Events. Install that companion first, then:

```sh
pi install npm:pi-mcp-events-status
```

The same package is also available from git:

```sh
pi install git:github.com/naqerl/pi-mcp-events-status
```

Restart Pi.

Pi supplies `@earendil-works/pi-coding-agent`. This package lists it as an optional peer dependency and does not bundle it.

To load the file without the package:

```sh
mkdir -p ~/.pi/agent/extensions
cp extensions/mcp-events-status.ts ~/.pi/agent/extensions/
```

If both the package and that copied file are installed, Pi loads the extension twice. Use one.

## What it watches

`mcp_events` tool results:

- `subscribe` adds the returned subscription.
- `unsubscribe` removes `subscription_id`. The tool result itself is only `{ stopped: true }`.
- `list` replaces the set. Records that are ended, failed, or stopped are not counted.
- A failed tool call does not change the count.

Custom messages with type `mcp-events-status`, which Pi MCP Events sends when a stream is interrupted or finishes:

- `reconnecting` and `active` stay in the count.
- `ended`, `failed`, and `stopped` leave the count.

The count is for this Pi session. Pi MCP Events does not restore subscriptions after a restart, and the footer starts at zero with the session.
