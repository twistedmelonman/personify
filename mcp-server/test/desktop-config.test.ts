import { describe, it, expect } from "vitest";
import { mergeConfig } from "../src/desktop-config.js";

describe("mergeConfig", () => {
  it("creates mcpServers.personify when the config is empty", () => {
    const result = mergeConfig({}, "/abs/path/to/mcp-server/bin/personify-mcp");

    expect(result).toEqual({
      mcpServers: {
        personify: {
          command: "/abs/path/to/mcp-server/bin/personify-mcp",
          args: [],
        },
      },
    });
  });

  it("creates mcpServers.personify when the config file did not exist (undefined input)", () => {
    const result = mergeConfig(
      undefined,
      "/abs/path/to/mcp-server/bin/personify-mcp",
    );

    expect(result).toEqual({
      mcpServers: {
        personify: {
          command: "/abs/path/to/mcp-server/bin/personify-mcp",
          args: [],
        },
      },
    });
  });

  it("adds mcpServers.personify without disturbing an existing sibling server", () => {
    const existing = {
      mcpServers: {
        instapaper: {
          command: "node",
          args: ["/some/other/path/build/index.js"],
          env: { INSTAPAPER_CONSUMER_KEY: "secret-key-value" },
        },
      },
    };

    const result = mergeConfig(
      existing,
      "/abs/path/to/mcp-server/bin/personify-mcp",
    );

    expect(result).toEqual({
      mcpServers: {
        instapaper: {
          command: "node",
          args: ["/some/other/path/build/index.js"],
          env: { INSTAPAPER_CONSUMER_KEY: "secret-key-value" },
        },
        personify: {
          command: "/abs/path/to/mcp-server/bin/personify-mcp",
          args: [],
        },
      },
    });
  });

  it("migrates an old node + dist/index.js entry to the launcher, with no args", () => {
    const existing = {
      mcpServers: {
        personify: {
          command: "node",
          args: ["/old/stale/path/dist/index.js"],
        },
      },
    };

    const result = mergeConfig(existing, "/new/path/bin/personify-mcp");

    expect(result).toEqual({
      mcpServers: {
        personify: {
          command: "/new/path/bin/personify-mcp",
          args: [],
        },
      },
    });
  });

  it("preserves top-level keys outside mcpServers", () => {
    const existing = {
      mcpServers: {},
      coworkUserFilesPath: "/Users/someone/Claude",
      preferences: { menuBarEnabled: false, nested: { a: 1, b: [1, 2, 3] } },
    };

    const result = mergeConfig(
      existing,
      "/abs/path/to/mcp-server/bin/personify-mcp",
    );

    expect(result).toEqual({
      mcpServers: {
        personify: {
          command: "/abs/path/to/mcp-server/bin/personify-mcp",
          args: [],
        },
      },
      coworkUserFilesPath: "/Users/someone/Claude",
      preferences: { menuBarEnabled: false, nested: { a: 1, b: [1, 2, 3] } },
    });
  });

  it("running the merge twice with the same path produces an identical result (idempotency)", () => {
    const existing = {
      mcpServers: { instapaper: { command: "node", args: ["/x/index.js"] } },
    };

    const first = mergeConfig(
      existing,
      "/abs/path/to/mcp-server/bin/personify-mcp",
    );
    const second = mergeConfig(
      first,
      "/abs/path/to/mcp-server/bin/personify-mcp",
    );

    expect(second).toEqual(first);
  });

  it("preserves the original position of the mcpServers key in the object", () => {
    const existing = {
      mcpServers: { instapaper: { command: "node", args: ["/x/index.js"] } },
      coworkUserFilesPath: "/Users/someone/Claude",
    };

    const result = mergeConfig(
      existing,
      "/abs/path/to/mcp-server/bin/personify-mcp",
    );

    expect(Object.keys(result)).toEqual(["mcpServers", "coworkUserFilesPath"]);
  });

  it("throws a clear error when the existing config's top level is not an object", () => {
    expect(() =>
      mergeConfig([1, 2, 3], "/abs/path/to/mcp-server/bin/personify-mcp"),
    ).toThrow(
      "claude_desktop_config.json does not contain a valid JSON object at its top level",
    );
    expect(() =>
      mergeConfig("not an object", "/abs/path/to/mcp-server/bin/personify-mcp"),
    ).toThrow(
      "claude_desktop_config.json does not contain a valid JSON object at its top level",
    );
  });
});
