# AI Code Review Bot — Phase 1

A local JavaScript/TypeScript review-engine prototype based on the uploaded SRS. It uses React + Vite, Node.js + TypeScript + Fastify, Zod validation, a deterministic review engine, and tests.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- Git (recommended)

Check versions:

```bash
node --version
npm --version
```

## Install and run

From this project directory:

```bash
npm install
npm run dev
```

Open the Vite URL printed in the terminal (normally http://localhost:5173). The API runs on http://127.0.0.1:3001.

## Verify before changing code

```bash
npm test
npm run typecheck
npm run build
```

## Current review checks

- TypeScript/JavaScript syntax diagnostics (via TypeScript's transpiler; this is not full type checking)
- Dynamic code execution (`eval`, `new Function`)
- Risky direct DOM HTML assignment (`innerHTML`)
- Secret-looking hard-coded assignments (heuristic; may produce false positives)

Every finding includes a rule ID, severity, confidence, line, explanation, and remediation guidance. The PR Risk label is a prototype heuristic, not a security certification.

## Architecture

- `apps/web`: React/Vite interface
- `apps/api`: Fastify HTTP API and request validation
- `packages/review-engine`: deterministic rules and tests

## Security boundaries

- The server analyzes source as text and **does not execute submitted code**.
- Requests are limited to 256 KiB and 2,000 lines.
- The API binds to loopback by default and only allows the local Vite origin.
- Do not expose this prototype to the public internet.
- Do not paste production secrets or confidential source code into it.
- The secret detector is heuristic and cannot prove that code is secret-free.
- No LLM or GitHub token is configured in Phase 1.

## Next milestones

1. Add parser-aware linting and full TypeScript project diagnostics.
2. Benchmark rules against labeled bugs and false positives.
3. Add GitHub App webhook verification, asynchronous queue, diff/context collection, and idempotency.
4. Add an LLM detector with strict schema validation and a separate verifier pass.
5. Add persisted reviews, tenant isolation, observability, and a dashboard for Code Strength.

See the SRS for the broader release plan. Do not claim comprehensive bug detection until benchmark results support it.
