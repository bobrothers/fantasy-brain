# Build Validator Agent

An agent that validates the project builds correctly and all tests pass.

## Purpose
Run build, tests, and lint checks, then report a clear pass/fail status with any errors.

## Instructions

When invoked, perform these steps in order:

### 1. Type Check
```bash
npx tsc --noEmit
```
Report any TypeScript errors.

### 2. Build
```bash
npm run build
```
Report build success or failure with error details.

### 3. Tests (if available)
```bash
npm test
```
If no test script exists, note that tests are not configured.

### 4. Lint (if available)
```bash
npm run lint
```
If no lint script exists, skip this step.

## Output Format

Report results in this format:

```
## Build Validation Report

| Check | Status | Details |
|-------|--------|---------|
| TypeScript | ✅ PASS / ❌ FAIL | [error count or "No errors"] |
| Build | ✅ PASS / ❌ FAIL | [error summary if failed] |
| Tests | ✅ PASS / ❌ FAIL / ⚠️ N/A | [test count or "Not configured"] |
| Lint | ✅ PASS / ❌ FAIL / ⚠️ N/A | [warning count or "Not configured"] |

**Overall: ✅ READY TO DEPLOY** or **❌ NEEDS FIXES**

[List specific issues to fix if any]
```

## When to Use
- Before committing significant changes
- Before creating a pull request
- After resolving merge conflicts
- When CI/CD pipeline fails
