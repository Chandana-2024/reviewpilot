import { describe, expect, it } from "vitest";
import { reviewCode, ReviewRequestSchema } from "./index.js";

describe("reviewCode", () => {
  it("flags eval and returns line evidence", () => {
    const result = reviewCode({ filename: "src/demo.js", code: "const input = userValue;\neval(input);" });
    expect(result.findings.some((f) => f.ruleId === "SEC-DYNAMIC-EVAL" && f.line === 2)).toBe(true);
  });

  it("flags direct innerHTML assignment", () => {
    const result = reviewCode({ filename: "src/ui.ts", code: "element.innerHTML = userInput;" });
    expect(result.findings.some((f) => f.ruleId === "SEC-DOM-INNERHTML")).toBe(true);
  });

  it("flags likely hard-coded credentials as a heuristic", () => {
    const result = reviewCode({ filename: "src/config.js", code: 'const api_key = "abc123456789xyz";' });
    expect(result.findings.some((f) => f.ruleId === "SEC-POSSIBLE-HARDCODED-SECRET")).toBe(true);
  });

  it("does not report these patterns for ordinary safe text", () => {
    const result = reviewCode({ filename: "src/safe.js", code: 'const message = "Hello world";\nconsole.log(message);' });
    expect(result.findings).toHaveLength(0);
  });

  it("rejects path traversal in filenames", () => {
    expect(() => ReviewRequestSchema.parse({ filename: "../secret.js", code: "x" })).toThrow();
  });

  it("rejects empty code", () => {
    expect(() => ReviewRequestSchema.parse({ filename: "src/a.js", code: "" })).toThrow();
  });

  it("reports line count and limitations", () => {
    const result = reviewCode({ filename: "src/a.ts", code: "const answer: number = 42;" });
    expect(result.linesReviewed).toBe(1);
    expect(result.limitations.length).toBeGreaterThan(0);
  });
});
