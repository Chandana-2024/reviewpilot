import ts from "typescript";
import { z } from "zod";

export const ReviewRequestSchema = z.object({
  filename: z.string().min(1).max(200).regex(/^[a-zA-Z0-9._/-]+$/).refine(
    (name) => !name.split("/").includes(".."),
    "Path traversal is not allowed"
  ),
  code: z.string().min(1).max(256 * 1024)
}).strict();

export type ReviewRequest = z.infer<typeof ReviewRequestSchema>;
export type Severity = "Critical" | "High" | "Medium" | "Low" | "Info";

export interface Finding {
  id: string;
  ruleId: string;
  title: string;
  severity: Severity;
  confidence: number;
  line: number;
  column: number;
  evidence: string;
  explanation: string;
  suggestion: string;
  source: "deterministic"| "ai";
}

export interface ReviewResult {
  filename: string;
  findings: Finding[];
  summary: string;
  prRisk: "Low" | "Medium" | "High" | "Critical";
  linesReviewed: number;
  limitations: string[];
}

const MAX_LINES = 2000;

function makeFinding(
  ruleId: string,
  title: string,
  severity: Severity,
  confidence: number,
  line: number,
  column: number,
  evidence: string,
  explanation: string,
  suggestion: string
): Finding {
  return {
    id: `${ruleId}:${line}:${column}`,
    ruleId, title, severity, confidence, line, column,
    evidence: evidence.trim().slice(0, 240),
    explanation, suggestion, source: "deterministic"
  };
}

export function reviewCode(input: ReviewRequest): ReviewResult {
  const lines = input.code.split(/\r?\n/);
  if (lines.length > MAX_LINES) {
    throw new Error(`File has ${lines.length} lines; maximum is ${MAX_LINES}.`);
  }

  const findings: Finding[] = [];
  const isTs = /\.tsx?$/.test(input.filename);
  const isJsLike = /\.(jsx?|tsx?)$/.test(input.filename);

  if (isJsLike) {
    const transpile = ts.transpileModule(input.code, {
      fileName: input.filename,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        allowJs: true
      }
    });
    for (const diagnostic of transpile.diagnostics ?? []) {
      if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
      const start = diagnostic.start ?? 0;
      const pos = ts.getLineAndCharacterOfPosition(ts.createSourceFile(
        input.filename, input.code, ts.ScriptTarget.Latest, true
      ), start);
      findings.push(makeFinding(
        "TS-SYNTAX", "Possible syntax error", "High", 0.95,
        pos.line + 1, pos.character + 1,
        ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
        "The TypeScript parser reported a syntax diagnostic. This check does not perform full project type checking.",
        "Fix the syntax issue, then run your project's compiler and test suite."
      ));
    }
  }

  lines.forEach((lineText, index) => {
    const line = index + 1;
    const checks: Array<{
      regex: RegExp; ruleId: string; title: string; severity: Severity;
      confidence: number; explanation: string; suggestion: string;
    }> = [
      {
        regex: /\beval\s*\(/,
        ruleId: "SEC-DYNAMIC-EVAL",
        title: "Dynamic code execution with eval",
        severity: "High",
        confidence: 0.91,
        explanation: "Evaluating a string as code can turn untrusted input into executable code and makes behavior difficult to audit.",
        suggestion: "Avoid eval. Use explicit parsing, a lookup table, or a safe expression parser for the specific requirement."
      },
      {
        regex: /\bnew\s+Function\s*\(/,
        ruleId: "SEC-DYNAMIC-FUNCTION",
        title: "Dynamic code execution with Function constructor",
        severity: "High",
        confidence: 0.9,
        explanation: "The Function constructor compiles a string into executable JavaScript and can create injection risk if any part is untrusted.",
        suggestion: "Replace dynamically constructed code with ordinary functions and explicit data handling."
      },
      {
        regex: /\.innerHTML\s*=/,
        ruleId: "SEC-DOM-INNERHTML",
        title: "Direct innerHTML assignment",
        severity: "Medium",
        confidence: 0.78,
        explanation: "Assigning HTML strings can introduce DOM-based cross-site scripting when the value includes untrusted content.",
        suggestion: "Prefer textContent or framework-safe rendering. If HTML is required, sanitize it with a well-maintained sanitizer and define a strict trust boundary."
      },
      {
        regex: /\b(?:api[_-]?key|secret|password|access[_-]?token)\b\s*[:=]\s*['"][^'"]{8,}['"]/i,
        ruleId: "SEC-POSSIBLE-HARDCODED-SECRET",
        title: "Possible hard-coded secret",
        severity: "High",
        confidence: 0.62,
        explanation: "This assignment resembles a hard-coded credential. The pattern is heuristic and can flag test fixtures or placeholders.",
        suggestion: "If this is a real credential, revoke and rotate it. Load secrets from a managed secret store or environment configuration; do not commit the secret."
      }
    ];

    for (const check of checks) {
      const match = check.regex.exec(lineText);
      if (match?.index !== undefined) {
        findings.push(makeFinding(
          check.ruleId, check.title, check.severity, check.confidence,
          line, match.index + 1, lineText,
          check.explanation, check.suggestion
        ));
      }
    }
  });

  const unique = [...new Map(findings.map((f) => [f.id, f])).values()]
    .sort((a, b) => a.line - b.line || a.column - b.column);

  const highOrCritical = unique.filter((f) => f.severity === "Critical" || f.severity === "High");
  const medium = unique.filter((f) => f.severity === "Medium");
  const prRisk: ReviewResult["prRisk"] =
    highOrCritical.some((f) => f.confidence >= 0.85) ? "High" :
    highOrCritical.length > 0 || medium.length >= 3 ? "Medium" :
    medium.length > 0 ? "Low" : "Low";

  const summary = unique.length === 0
    ? "No findings from the current Phase 1 rules. This does not prove the code is bug-free."
    : `Found ${unique.length} potential issue(s): ${highOrCritical.length} high/critical and ${medium.length} medium. Review the evidence and validate findings before merging.`;

  return {
    filename: input.filename,
    findings: unique,
    summary,
    prRisk,
    linesReviewed: lines.length,
    limitations: [
      "Only a small set of deterministic rules is enabled in Phase 1.",
      ...(isTs ? ["Syntax transpilation is not full TypeScript type checking; project tsconfig, imports, and types are not resolved."] : []),
      "No submitted code is executed.",
      "A clean result is not a guarantee of security or correctness."
    ]
  };
}
