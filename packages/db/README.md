# BasedDb

BasedDb is a powerful database solution that supports various data types, references, edges, and operations. It also offers concurrency handling, client-server architecture support, and more.

## Features

- Schema definition and management
- Data creation, querying, updating, and deletion
- Support for strings, numbers, booleans, binaries, aliases, enums, and cardinality
- Edges and references for advanced data modeling
- Concurrency support for high-load scenarios
- Client-server design for distributed systems
- Checksum, analytics, and expiration features

## Install

**Prerequisites:**

- recent GNU make
- gcc with recent enough C23 support
- zig 0.14.0
- npm & node.js, v20.11.1 or newer

```bash
npm i
npm run get-napi // only need this the first time
npm run build
```

## Running tests

Run all tests + ldb + build c, zig and js

```bash
npm run test
```

Run specific test file - does substring matching

```bash
npm run test -- range.js
```

Run specific test file & run specific test

```bash
npm run test -- range.js:range
```

Different flavours of test

Only builds zig

```bash
npm run test-zig
```

Builds nothing only runs tests

```bash
npm run test-fast
```
