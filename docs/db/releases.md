# Release Plan

This document provides a high-level overview of our database release plan.
It highlights the major planned evolutions and key milestones, without getting into extensive technical details.
Version numbers could change due to nightly releases.

## v0.1.0 (Sep 2025)

**Include**

- 20% faster performance from internal optimizations
- New API feature: Meta information for adding contextual information like crc32, size and checksum.
- New API feature: "End option" allowing getting the start of a property, by default counts characters for strings and text including multibyte characters.
- Read is now fully supported in the `@based/client`, removing the need to call `.toObject()` when returning data from based functions
- Reading and deserializing database results is now 30% faster.

**Query**

- Id on a based query response now returns the id of a node if the target is single node
- Added queryId that is the

**Backups**

- Backup improvement. IoWorker threads for non blocking saving and loading (huge improvement)
- Start of [partial](https://atelier-saulx.github.io/based/#/db/internals?id=partial-data) loading of backups (works for types without references)
- Improved backup checksums

**Modify**

- Refactor of all client code, much cleaner and easier to understand codebase
- Offset system in place allows offloading validation & modify buffer preparation to db-client
- Growing preallocated modify buffer (saves memory if a low amount is used)
- Better support for async reference
- Better migration using native lastIds where applicable
- Better validation for most types - works better with customValidators as well
- New api feature: Standardizes modify result: Promise

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

- Infer typescript utility to infer types from the schema
- Introduced Schema Migration format:
  - Allows you to define custom transformations between schema versions making it easy to migrate
- New API feature: Schema hooks
  - Allows overwriting of each method for specific nodes
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
- Fixed all handling of modify cursor mismatches on error

**Documentation & Examples**

- Start of documentation can be found [here](https://atelier-saulx.github.io/based/#/)
- [Northwind sample dataset](https://atelier-saulx.github.io/based/#/db/sql?id=northwind-sample-database) - comparing SQL to BasedDb

**Based Platform**

- Alpha version of new environment hub & cli
  - Builds and watches large projects
  - Reconnects
  - Uses based-dbn on new env-hub this will go further in the future
- Launcher for Linux testing on MacOS
- Start of @based/protocol will centralize all protocols in 1 place
- @saulx/utils is replaced with `@based/utils` use this in the future
- @saulx/hash is replaced with `@based/hash` use this in the future

### Breaking changes

- \*Changed the `$count` result in aggegrations to `count`
- Filter operation `has` has been renamed to `ìncludes`. As shown in the [docs](https://atelier-saulx.github.io/based/#/db/filtering?id=operators)
- Removed `transform` opton from schema properties in favor of Schema Hooks
- Removed `upsert` option from references modify api in favor of newly created `db.upsert` command.
- BasedQueryResponse now uses id for node ids vs the queryId
- Don't allow setting a string to text props without a locale

## v0.1.1 (Oct 2025)

- Database Documentation
- High performance native subscriptions
- Optimized Server client integration
  - Protocol package for each format
  - Refactor of buffer loading - allow sending chunks and receive accordingly on client - avoids memcopies
- Improved reference(s) implementation
  - space requirement improvements
  - support all property types in edges
  - edges as nodes remove the transient type
- New result type for aggregations
- Aggregation with multiple distinct function types
- Option to include data from session context in basedQueries
- "Insert" option for upsert (only create if alias does not exist)

## v0.1.2 (Nov 2025)

- CLI v.1 nightly
  - Automatic infered response types from db queries
  - Can show all information about and env e.g. logs, stats
- Env-hub v.1
  - Monitoring of function perfomance and calls
  - Searchable log storage
- Sort on References as option on schema
- Max len option for references & types
- Partial loading of large databases (Experimental)
- CSV export working with References
- Parquet exporter
- Filter engine v.1 working for partials
- JS function support for include / filter / aggregate

## v0.1.3 (Dec 2025)

- Fully automated partial loading & offloading of large databases
- Sorted results on aggregations
- Automatic testing for Linux (all the tests in CI/CD setup)
- Cloud v.1 nightly
  - Orchestrator working on new based-db
  - Team / Org / Individual login
  - Env management
  - Branch deploy / normal deploy
  - Cli fully operational in combination with Cloud v.1

## v0.1.4 (Jan 2026)

- Based Platform Documentation
- Cloud v.1 release
  - UI for cloud v1
  - Clear organisation wide usage statistics and billing information
  - Integration with external suppliers
- Fully integrated internal columnar vector storage for `'insertOnly'` types
  - More space efficient for large data sets
  - Improved filter and aggregate performance
