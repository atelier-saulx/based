# Gemini Contribution Guidelines

This document provides guidelines for Gemini when contributing to this project.

## Core Principles

- **Simplicity First:** Prioritize simple, easy-to-understand code with minimal dependencies.
- **Performance Matters:** When in doubt, measure performance. Avoid trendy solutions without proven benefits.

## TypeScript Guidelines

### Loops

- Use `for...of` for iterating over arrays or map values.
- Use a standard `for` loop for more control over iteration.
- Use `for...of` with `map.entries()` when you need both keys and values.

```typescript
// Good:
for (const x of arr) {
  // ...
}

for (let i = 0; i < arr.length; i++) {
  // ...
}

for (const value of map.values()) {
  // ...
}

for (const [key, value] of map.entries()) {
  // ...
}
```

### Functions

- **Always use arrow functions.**
- Keep functions small and concise, unless it compromises simplicity.

```typescript
// Good:
const myFunc = () => {
  // ...
}
```

### Classes

- **Avoid classes.**
- Only use classes for top-level libraries (e.g., `BasedDb`) or to extend basic Node.js functionality (e.g., `Worker`).
- For shared state, pass context objects instead of using classes.

```typescript
// Good:
const ctx = {
  cnt: 0,
}

const a = (ctx) => {
  ctx.cnt += 1
}
```

### Code Organization

- For frontend code (especially React), aim for a maximum of 250 lines per file, unless it makes the code harder to understand.

### Types

- **Never use `interface`. Always use `type`.**

### Binary Data

- **Always use `Uint8Array` instead of `Buffer`.** `Uint8Array` is the standard.

### Comments

- Avoid redundant comments.
- Prefer self-documenting code (clear variable names, etc.).
- If you must add a comment, keep it minimal and explain the _why_, not the _what_.

## Running Tests

The project uses a custom test runner. **Always use `npm test`** to run tests. Do **NOT** use `npx tsx` or `node` directly on test files.

You can run tests from the root simply with `npm test`. You can pass arguments to filter the tests.

```bash
npm test [filter]
```

There is also a `test-fast` script that skips the build step.

### Filters

You can filter which tests to run by providing one or more filter arguments.

- `stopOnFail`: Stop the test run on the first failing test.
- `<number>`: Repeat the tests a specified number of times.
- `path-filter`: Run tests in files where the path includes `path-filter`.
- `^path-filter`: Run tests in files where the path does not include `path-filter`.
- `path-filter:test-name-filter`: Run only tests where the name includes `test-name-filter` in files where the path includes `path-filter`.

### Examples

- **Run all tests:**
  ```bash
  npm test
  ```
- **Run tests for a specific file or folder (e.g. `query/ast`):**
  ```bash
  npm test query/ast
  ```
- **Run all tests and stop on the first failure:**
  ```bash
  npm test stopOnFail
  ```
- **Run tests with "observe" in the name, in files with "view" in the path:**
  ```bash
  npm test view:observe
  ```
- **Run all tests 10 times:**
  ```bash
  npm test 10
  ```

## Zig version

zig version 0.15.2

## Zig Performance Tests

To run performance tests for a specific Zig file, you can use the `zig test` command with the `ReleaseSafe` optimization flag. This will compile and run the tests in the specified file with optimizations enabled.

### Example

To run performance tests for `singleId.zig` in the `subscription` module, from the root of the project:

```bash
zig test -O ReleaseSafe ./packages/db/native/db/subscription/singleId.zig
```

## Zig code style

when printing timing for perf tests in zig use this format
`std.debug.print("\ngetNewBitSize (branching): {any}\n", .{std.fmt.fmtDuration(branching_time)});`

In zig use Camel_Case e.g `fn generateFiter` vs `fn generate_filter`

In general zig is styled slightly like typescripot to have a more harmonic code style over the 2 languages
