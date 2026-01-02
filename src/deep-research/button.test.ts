import { describe, expect, it } from "vitest";

import {
  CallbackActions,
  CALLBACK_PREFIX,
  createExecuteButton,
  createRetryButton,
  parseCallbackData,
} from "./button.js";

type InlineKeyboardLike = {
  inline_keyboard: Array<Array<{ callback_data?: string }>>;
};

function getCallbackData(button: InlineKeyboardLike): string {
  return button.inline_keyboard[0]?.[0]?.callback_data ?? "";
}

describe("deep-research button callbacks", () => {
  it("round-trips short topic for execute", () => {
    const topic = "квантовые компьютеры";
    const ownerId = 14835038;
    const keyboard = createExecuteButton(topic, ownerId);
    const data = getCallbackData(keyboard);

    expect(data.startsWith(`${CALLBACK_PREFIX}${CallbackActions.EXECUTE}:`)).toBe(
      true,
    );

    const parsed = parseCallbackData(data);
    expect(parsed?.action).toBe(CallbackActions.EXECUTE);
    expect(parsed?.topic).toBe(topic);
    expect(parsed?.ownerId).toBe(ownerId);
  });

  it("round-trips short topic for retry", () => {
    const topic = "AI safety";
    const ownerId = 42;
    const keyboard = createRetryButton(topic, ownerId);
    const data = getCallbackData(keyboard);

    expect(data.startsWith(`${CALLBACK_PREFIX}${CallbackActions.RETRY}:`)).toBe(
      true,
    );

    const parsed = parseCallbackData(data);
    expect(parsed?.action).toBe(CallbackActions.RETRY);
    expect(parsed?.topic).toBe(topic);
    expect(parsed?.ownerId).toBe(ownerId);
  });

  it("handles long topics without throwing", () => {
    const topic = "a".repeat(200);
    const keyboard = createExecuteButton(topic, 1);
    const data = getCallbackData(keyboard);

    const parsed = parseCallbackData(data);
    expect(parsed?.action).toBe(CallbackActions.EXECUTE);
    expect(parsed?.topic).toBeTruthy();
  });

  it("parses callbacks without owner id", () => {
    const topic = "plain topic";
    const keyboard = createExecuteButton(topic);
    const data = getCallbackData(keyboard);

    const parsed = parseCallbackData(data);
    expect(parsed?.action).toBe(CallbackActions.EXECUTE);
    expect(parsed?.topic).toBe(topic);
    expect(parsed?.ownerId).toBeUndefined();
  });

  it("returns null for unrelated callback data", () => {
    expect(parseCallbackData("other:payload")).toBeNull();
  });
});
