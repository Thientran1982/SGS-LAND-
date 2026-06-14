import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveContent } from "../../utils/i18nUtils";

const t = vi.fn((key: string) => key);

beforeEach(() => {
  t.mockReset();
  t.mockImplementation((key: string) => key);
});

describe("resolveContent", () => {
  it("returns empty string unchanged", () => {
    const result = resolveContent("", t);
    expect(result).toBe("");
    expect(t).not.toHaveBeenCalled();
  });

  it("returns plain text unchanged (no translatable prefix)", () => {
    const result = resolveContent("Hello world", t);
    expect(result).toBe("Hello world");
    expect(t).not.toHaveBeenCalled();
  });

  it("translates key with ai. prefix and valid pattern", () => {
    t.mockImplementation((key: string) =>
      key === "ai.msg_system_busy" ? "AI system is busy" : key
    );
    const result = resolveContent("ai.msg_system_busy", t);
    expect(result).toBe("AI system is busy");
    expect(t).toHaveBeenCalledWith("ai.msg_system_busy");
  });

  it("translates key with inbox. prefix", () => {
    t.mockImplementation((key: string) =>
      key === "inbox.new_message" ? "New message" : key
    );
    const result = resolveContent("inbox.new_message", t);
    expect(result).toBe("New message");
  });

  it("translates key with livechat. prefix", () => {
    t.mockImplementation((key: string) =>
      key === "livechat.connected" ? "Connected" : key
    );
    const result = resolveContent("livechat.connected", t);
    expect(result).toBe("Connected");
  });

  it("translates key with common. prefix", () => {
    t.mockImplementation((key: string) =>
      key === "common.save" ? "Save" : key
    );
    const result = resolveContent("common.save", t);
    expect(result).toBe("Save");
  });

  it("translates key with auth. prefix", () => {
    t.mockImplementation((key: string) =>
      key === "auth.login" ? "Login" : key
    );
    const result = resolveContent("auth.login", t);
    expect(result).toBe("Login");
  });

  it("returns original content if translation returns same key (no translation available)", () => {
    t.mockImplementation((key: string) => key);
    const result = resolveContent("ai.untranslated_key", t);
    expect(result).toBe("ai.untranslated_key");
  });

  it("does NOT translate key with valid prefix but invalid pattern (has uppercase)", () => {
    const result = resolveContent("ai.MsgBusy", t);
    expect(result).toBe("ai.MsgBusy");
    expect(t).not.toHaveBeenCalled();
  });

  it("does NOT translate key starting with unknown prefix", () => {
    const result = resolveContent("user.profile", t);
    expect(result).toBe("user.profile");
    expect(t).not.toHaveBeenCalled();
  });

  it("translates nested key with multiple dots", () => {
    t.mockImplementation((key: string) =>
      key === "ai.msg.system.busy" ? "AI busy" : key
    );
    const result = resolveContent("ai.msg.system.busy", t);
    expect(result).toBe("AI busy");
  });

  it("returns content unchanged when it starts with prefix but has no dot separator in key part", () => {
    // Pattern requires [a-z_]+\.[a-z_.]+: key must have at least one dot
    // "ai." alone won't match ^[a-z_]+\.[a-z_.]+$ (needs chars after dot)
    const result = resolveContent("ai.", t);
    expect(result).toBe("ai.");
    expect(t).not.toHaveBeenCalled();
  });

  it("handles content with special chars that don't match key pattern", () => {
    const result = resolveContent("ai.Msg System Busy", t);
    expect(result).toBe("ai.Msg System Busy");
    expect(t).not.toHaveBeenCalled();
  });
});
