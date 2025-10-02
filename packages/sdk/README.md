# @based/sdk

Welcome to the official SDK for the Based platform. This package is the single, unified entry point for all official `@based` libraries and tools.

## Why use `@based/sdk`?

Previously, to use different parts of the Based ecosystem, you had to install and manage multiple packages individually (e.g., `@based/db`, `@based/schema`).

The `@based/sdk` package simplifies this by providing a single, consistent, and optimized way to access the entire Based toolset.

- **Simplified Dependency Management**: Install one package, not many.

- **Improved Developer Experience**: A single, predictable import source for all Based functionalities.

- **Optimized for Modern Tooling**: Designed with a modern `exports` map for better tree-shaking, ensuring your application bundles only the code they actually use.

- **Controlled API Surface**: Provides a stable and clear public API, preventing accidental reliance on internal functionalities.

## Installation

Install the SDK using your package manager:

```bash
npm install @based/sdk
```

## Usage

The SDK is designed to be flexible, allowing you to import exactly what you need.

### Importing an Entire Module

You can import an entire module (like `db` or `schema`) directly from its subpath. This is the recommended approach for clarity and organization.

```js
import * as db from '@based/sdk/db'
import * as schema from '@based/sdk/schema'

// Now you can use functions from each module
const myDb = db.create(/* ... */)
const mySchema = schema.parse({
  /* ... */
})
```

### Importing Specific Functions

For better tree-shaking and cleaner code, you can import specific functions or components directly from the module's subpath.

```js
import { BasedDb } from '@based/sdk/db';
import { SchemaProp, SchemaType } from '@based/sdk/schema';
import { wait } from '@based/sdk/utils';

// Use the imported functions directly
const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const voteCountrySchema: SchemaProp = countrySchema

  await wait(500)
```

## Main Entry Point (Convenience Exports)

The main entry point provides convenient, top-level exports for the most commonly used functionalities.

```ts
import { db, schema } from '@based/sdk'

const client = db.create()
const userSchema = schema.parse({
  /* ... */
})
```

## Packages Included

This SDK provides exports from the following core Based packages:

- @based/db - The core database client.
- @based/schema - Tools for schema definition and validation.
- @based/utils - Shared utility functions.
- @based/hash - Fast, low collision hashing based on djb2
- @based/protocol - Protocols for network operations and storage
- @based/functions - To be used with based cloud functions, adds types and utilities.
- @based/errors - Error codes and handlers
- @based/server - Live graph data platform, build for hyper-scale & progressive security
- @based/type-gen - Generates based client types and validators from functions & schema
- @based/client - Based client
- @based/react - Wraps the [`@based/client`](https://github.com/atelier-saulx/based/tree/main/packages/client) into react hooks
- @based/schema-diagram - Utility to generate [mermaid](https://mermaid.js.org/intro/).js diagrams

For detailed documentation on the specific functions available within each module, please refer to the documentation for that individual package.

## Contributing

This SDK is part of the main Based [monorepo](https://github.com/atelier-saulx/based). Please see the repository for contribution guidelines.

## License

Copyright (c) 2025 Saulx B.V.

This monorepo contains multiple packages, each governed by its own license.
Individual packages within this monorepo are licensed under either the MIT License or the Apache License 2.0.
