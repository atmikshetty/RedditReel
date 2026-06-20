import { describe, test, expect } from "bun:test";
import { validateReelScript, estimateReelDuration } from "@/reel/validation";

describe("ReelValidation", () => {
  test("accepts valid script", () => {
    const result = validateReelScript("This is a valid test script with enough words");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects empty script", () => {
    const result = validateReelScript("");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Script text is required");
  });

  test("rejects whitespace-only script", () => {
    const result = validateReelScript("   ");
    expect(result.valid).toBe(false);
  });

  test("rejects script with too few words", () => {
    const result = validateReelScript("Hi there");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("at least 5 words");
  });

  test("accepts exactly minimum words", () => {
    const result = validateReelScript("One two three four five");
    expect(result.valid).toBe(true);
  });

  test("rejects script exceeding max words", () => {
    const longScript = Array(1001).fill("word").join(" ");
    const result = validateReelScript(longScript);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("at most 1000 words");
  });

  test("accepts clean short scripts with no errors", () => {
    const result = validateReelScript("A simple clean test script for validation");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe("estimateReelDuration", () => {
  test("estimates duration in seconds based on word count (150 wpm)", () => {
    const duration = estimateReelDuration("One two three four five six seven eight nine ten");
    // 10 words at 150 wpm = 4 seconds
    expect(duration).toBe(4);
  });

  test("handles empty text", () => {
    const duration = estimateReelDuration("");
    expect(duration).toBe(0);
  });
});
