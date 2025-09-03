# Release Plan

This document provides a high-level overview of our database release plan.
It highlights the major planned evolutions and key milestones, without getting into extensive technical details.
Note that version numbers may change due to nightly releases.

## v0.1.1 (Sep 2025)

**Include**

- 20% faster performance from internal optimizations
- New API feature: Metadata for adding contextual information like crc32, size, and checksum.
- New API feature: "End option" allows to get the end of a property, by default counts characters for strings and text including multibyte characters.
- Reading is now fully supported in the `@based/client`, removing the need to call `.toObject()` when returning data from based functions
- Reading and deserializing database results is now 30% faster.

**Query**

- Id prop on a based query response now returns the ID of a node if the target is a single node
- Added queryId that is the

**Backups**

- Backup improvement. I/O worker threads for non-blocking saving and loading (a huge improvement)
- Start of [partial](https://atelier-saulx.github.io/based/#/db/internals?id=partial-data) loading of backups (works for types without references)
- Improved backup checksums

**Modify**

- Refactored all client code for a much cleaner and easier-to-understand codebase
- An offset system is now in place, allowing the offloading of validation and modify buffer preparation to the DB client
- A growing preallocated modify buffer (saves memory when a low amount is used)
- Better support for async reference
- Better migration using native lastIds where applicable
- Improved validation for most types, which also works better with _customValidators_
- New API feature: The modify result is now standardized as a _Promise_

**Aggregations**

- [Date/time & intervals in Aggregations](https://atelier-saulx.github.io/based/#/db/aggregate?id=temporal-grouping-time-based-aggregations): Aggregate functions now supports date, time, and interval data types.
- Grouping by time windows, named intervals (day, week, ISO week, ISO year, etc) with [timezone support](https://atelier-saulx.github.io/based/#/db/aggregate?id=working-with-timezones)
- [Group by reference node IDs](https://atelier-saulx.github.io/based/#/db/aggregate?id=grouping-by-reference-node-ids)
- `BaseType` options for `'vector'` (8/16/32-bit integers and 32/64-bit floating-points)
- New [harmonic_mean](https://atelier-saulx.github.io/based/#/db/aggregate?id=hmeanproperty-string-string) aggregation function
- Improved [stddev and variance option to compute on [sample or population mode](https://atelier-saulx.github.io/based/#/db/aggregate?id=stddevproperty-string-string-options-mode-39sample39-39population39-)

**Interoperability**

- New package: [Export to CSV](https://atelier-saulx.github.io/based/#/db/export)
  - We're introducing a new dedicated package for generating compliant CSV files from dumped datasets

**Schema**

- A TypeScript utility to infer types from the schema
- Introduced Schema Migration format:
  - Allows you to define custom transformations between schema versions making it easy to migrate
- New API feature: Schema hooks
  - Allows overwriting each method for specific nodes
    e.g. `url docs`

**General Fixes & Improvements**

- Fixed stability issues with `.expire()`
- Fixed condition length of var string filters
- Fixed out of bounds read for an edge case with search
- Fixed incorrect timestamp validation, not allowing dates before 1970
- Fixed incorrect reading of references data for certain edge cases
- Fixed incorrect length encoding of filters on cardinality (from 2 to 4 bytes)
- Fixed defaults for enums are now handled correctly
- Fixed arbitrary unloading of WorkerCtx by napi external
  - solves filtering on compressed data (avoids **segfault**)
  - solves db process getting stuck when the db variable goes out of scope in js
- Fixed all handling of modify cursor mismatches during errors

**Documentation & Examples**

- Initial documentation can be found [here](https://atelier-saulx.github.io/based/#/)
- [Northwind sample dataset](https://atelier-saulx.github.io/based/#/db/sql?id=northwind-sample-database) - comparing SQL to BasedDb

**Based Platform**

- Alpha version of new environment hub & cli
  - Builds and watches large projects
  - Reconnects
  - Uses based-db on new env-hub this will be expanded further in the future
- Launcher for Linux testing on MacOS
- Initial @based/protocol to centralize all protocols in 1 place
- @saulx/utils is replaced by `@based/utils`; please use this in the future
- @saulx/hash is replaced by `@based/hash`; please use this in the future

### Breaking changes

- \*Changed the `$count` result in aggregations to `count`
- Filter operation `has` has been renamed to `ìncludes`. As shown in the [documentation](https://atelier-saulx.github.io/based/#/db/filtering?id=operators)
- Removed the `transform` option from _schema_ properties in favor of _schema hooks_
- Removed the `upsert` option from _references_ modify api in favor of newly created `db.upsert` command.
- The _BasedQueryResponse_ now uses _id_ for node IDs, as opposed to the _queryId_
- Setting a string to _text_ properties without a _locale_ is no longer allowed

## v0.2.\* (Oct 1st 2025)

- Database Documentation
- High performance DB subscriptions
  - Integration in the modify core
  - Subscriptions tracking
    - Id based subscriptions + include
    - Filters based subscriptions - check if conditions pass / change after updates
    - Sort (integrated within the seperate sort command)
- Optimized Server client integration
  - Complete protocol package for each format of based server / client e.g. response formats - support full js object including Set and Map
  - Improved performance by refactoring buffer loading to allow sending and receiving chunks on the client, avoiding memory copies
- Improved reliability of client-server communication by replacing the current get and set processes with atomic upserting
- Improved reference(s) implementation (step 1 of partial)
  - space requirement improvements
  - edge relations as true node types
  - support all property types in edges
  - update reference upsert behavior to support defaults & hooks
- New result type for aggregations
- Aggregation with multiple distinct function types
- Option to include data from the session context in basedQueries
- Expose function 'entrypoint' on context
- "Insert" option for upsert (only create if alias does not exist)
- Cardinality property migration fix
- Order main buffer for better alignment
- Use SIMD for improved accumulation on aggregate functions when with ARM Neon CPUs
- Complete schema infer type
- Improved db hook system
  - Property hooks
  - Guard against side effect
- Allows array payloads for create and upsert (improves developer experience)

## v0.3.\* (Nov 1st 2025)

- CLI v.1 nightly
  - Enabling strong typed db query responses with automatic inference
  - Added a feature-rich logging system that presents all relevant information about the environment
  - Feature complete local development environment
  - Improved bundling and deployment performance
  - Hooks should build external function
  - In-memory DB (no persistence)
- Env-hub v.1
  - Monitoring of function performance and calls
  - Searchable log storage
  - Installation and handling of Based functions
- User-sortable _references_ as an option on the schema
- A Max len option for _references_ and _types_
- Partial loading of large databases (Experimental) better memory and concurency management
- Parquet exporter
- Filter engine working for partials - automatically loads and unloads blocks when visiting
- JS function support for include, filter, and aggregate, allowing users to create custom query functions
- Graceful handling of incompatible dumps

## v0.4.\* (Dec 1st 2025)

- Fully automated partial loading & offloading of large databases
- Sorted results and Range on aggregations
- Automatic testing for Linux (all the tests in CI/CD setup)
- Cloud v.1 nightly
  - Orchestrator working on new Based Db
  - Authorization System in accordance with with Team / Org / Individual login
  - Env management
  - Ability to deploy in branches or manual deploy
  - CLI v.1 fully operational in combination with the Cloud v.1 nightly

## v0.5.\* (Feb 1st 2026)

- Based Platform Documentation
- Cloud v.1 release
  - UI Dashboard
  - Database playground
  - Usage statistics report
  - Billing information report
  - Integration with external cloud providers
  - An issue reporting system that integrates with the UI to tag which functions are not working
- Fully integrated internal columnar vector storage for `'insertOnly'` types
  - More space-efficient for large datasets
  - Improved filter and aggregate performance
