import { useMemo, useState } from "react";
import { AlertTriangle, Bug, CheckCircle2, Code2, FileCode2, LoaderCircle, ShieldCheck } from "lucide-react";

type Finding = {
  id: string;
  ruleId: string;
  title: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "Info";
  confidence: number;
  line: number;
  column: number;
  evidence: string;
  explanation: string;
  suggestion: string;
  source: string;
};
type Review = {
  filename: string;
  findings: Finding[];
  summary: string;
  prRisk: string;
  linesReviewed: number;
  limitations: string[];
};

const sample = `function renderUserMessage(userInput: string) {
  const panel = document.querySelector("#message");
  if (panel) {
    panel.innerHTML = userInput;
  }
}

function runExpression(expression: string) {
  return eval(expression);
}`;

const severityOrder = ["Critical", "High", "Medium", "Low", "Info"];

export default function App() {
  const [filename, setFilename] = useState("src/example.ts");
  const [code, setCode] = useState(sample);
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const counts = useMemo(() => {
    const result: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 };
    review?.findings.forEach((f) => {
    result[f.severity] = (result[f.severity] ?? 0) + 1;
  });
    return result;
  }, [review]);

  async function runReview() {
    setLoading(true);
    setError("");
    setReview(null);
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, code })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Review failed");
      setReview(data as Review);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the API. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-mark"><Code2 size={21} /></div>
        <div>
          <div className="brand-name">ReviewPilot <span className="phase">PHASE 1</span></div>
          <div className="brand-subtitle">JavaScript / TypeScript review engine</div>
        </div>
        <div className="local-pill"><span /> Local analysis</div>
      </header>

      <section className="intro">
        <div className="eyebrow"><ShieldCheck size={15} /> EVIDENCE-FIRST CODE REVIEW</div>
        <h1>Find the bugs before<br /><span>they find production.</span></h1>
        <p>Run an initial deterministic review against a source file. Findings include line-level evidence and practical remediation guidance.</p>
      </section>

      <section className="workspace">
        <div className="editor-panel panel">
          <div className="panel-head">
            <div className="panel-title"><FileCode2 size={17} /> Source file</div>
            <span className="file-badge">JS / TS</span>
          </div>
          <label className="field-label" htmlFor="filename">FILE PATH</label>
          <input id="filename" className="filename-input" value={filename} onChange={(e) => setFilename(e.target.value)} maxLength={200} />
          <label className="field-label code-label" htmlFor="source">SOURCE CODE</label>
          <textarea id="source" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} />
          <div className="editor-footer">
            <span>{code.split(/\r?\n/).length} lines · {new TextEncoder().encode(code).length.toLocaleString()} bytes</span>
            <button className="review-button" onClick={runReview} disabled={loading || !code.trim() || !filename.trim()}>
              {loading ? <><LoaderCircle className="spin" size={16} /> Reviewing…</> : <><ShieldCheck size={16} /> Review code</>}
            </button>
          </div>
          <p className="privacy-note"><ShieldCheck size={14} /> Code is analyzed as text; this prototype does not execute it.</p>
        </div>

        <div className="results-column">
          {!review && !error && (
            <div className="empty-state panel">
              <div className="empty-icon"><Bug size={25} /></div>
              <h2>Your review starts here</h2>
              <p>Run the sample review to see how evidence, severity and fix suggestions are presented.</p>
              <div className="check-row"><CheckCircle2 size={15} /> Syntax diagnostics</div>
              <div className="check-row"><CheckCircle2 size={15} /> Risky JavaScript patterns</div>
              <div className="check-row"><CheckCircle2 size={15} /> Line-level evidence</div>
            </div>
          )}

          {error && <div className="error-box"><AlertTriangle size={19} /><div><strong>Review could not run</strong><p>{error}</p></div></div>}

          {review && (
            <>
              <div className="risk-card panel">
                <div>
                  <div className="panel-title"><ShieldCheck size={17} /> Preliminary PR risk</div>
                  <div className="risk-caption">Based on current rules only</div>
                </div>
                <span className={`risk-badge risk-${review.prRisk.toLowerCase()}`}>{review.prRisk}</span>
                <div className="risk-summary">{review.summary}</div>
                <div className="metric-row">
                  {severityOrder.map((severity) => (
                    <div className="metric" key={severity}>
                      <span className={`metric-dot dot-${severity.toLowerCase()}`} />
                      <strong>{counts[severity]}</strong><span>{severity}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="findings-heading">
                <div><h2>Findings <span>{review.findings.length}</span></h2><p>{review.filename} · {review.linesReviewed} lines reviewed</p></div>
              </div>

              {review.findings.length === 0 && (
                <div className="panel clean-state"><CheckCircle2 size={23} /><strong>No findings from enabled rules</strong><p>A clean result is not proof that the code is bug-free.</p></div>
              )}

              {review.findings.map((finding) => (
                <article className="finding panel" key={finding.id}>
                  <div className="finding-top">
                    <span className={`severity severity-${finding.severity.toLowerCase()}`}>{finding.severity}</span>
                    <span className="rule-id">{finding.ruleId}</span>
                    <span className="line-number">L{finding.line}:{finding.column}</span>
                  </div>
                  <h3>{finding.title}</h3>
                  <pre className="evidence"><code>{finding.evidence}</code></pre>
                  <p>{finding.explanation}</p>
                  <div className="suggestion"><strong>Suggested next step</strong><p>{finding.suggestion}</p></div>
                  <div className="confidence">Rule confidence estimate: {Math.round(finding.confidence * 100)}% · deterministic heuristic</div>
                </article>
              ))}

              <div className="panel limitations">
                <strong>Review limitations</strong>
                <ul>{review.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </>
          )}
        </div>
      </section>
      <footer>Prototype · No LLM verification or GitHub PR integration yet · Validate findings before merging</footer>
    </main>
  );
}
