# Release Plan

This document provides a high-level overview of our database release plan.
It highlights the major planned evolutions and key milestones, without getting into extensive technical details.
Version numers could change due to nightly releases.

## v0.0.72 (Aug 2025)

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
- Backup improvement. IoWorker thread for saving and loading DB backups asyncronously
- Start of partial loading of backups (works for types without references)
- Improved backup checksums

**Aggregations**
- Date/time & intervals in Aggregations: Aggregate functions now supports date, time, and interval data types. user can calculate durations, grouping by time windows, day, week, etc.
- `BaseType` options for `'vector'` (8/16/32-bit integers and 32/64-bit floating-points)

**Interoperability**
- New package: Export to CSV
  - We're introducing a new dedicated package for generating compliant CSV files from dumped datasets

**Schema**
- Infer typescript utility to infer types from the schema
- Introduced Schema Migration format:
  - Allows you to define custom transformations between schema versions making it easy to migrate
- New API feature: Schema hooks   
  - Allows overwriting of each method for specific nodes
    e.g. ``url docs``

**General Fixes & Improvements**
- Fixed stability issues with `.expire()`
- Fixed condition length of strict equality fixed string filters
- Fixed out of bounds read for an edge case with search
- Fixed incorrect timestamp validation, not allowing dates before 1970
- Fixed incorrect reading of references data for certain edge cases
- Fixed defaults for enums are now handled correctly
- Fixed arbitrary unloading of WorkerCtx by napi external
  - solves filtering on compressed data (avoids **segfault**)
  - solves db process getting stuck when the db variable goes out of scope in js

**Documentation & Examples**
- Start of documentation can be found [here](db/schema#hooks)
- Northwind sample dataset - comparing SQL to BasedDb

**Based Platform**
- Alpha version of new environment hub & cli

### Breaking changes
- *Changed the $count result in aggegrations with [.....]*
- Filter operation `has` has been renamed to `ìncludes`. As shown in the [docs](db/filter#Operators)
- Removed `transform` opton from schema properties in favor of Schema Hooks
- Removed `upsert` option from references modify api in favor of newly created `db.upsert` command. See the [docs](db/upsert)*
- BasedQueryResponse now uses id for node ids vs the queryId
- Don't allow setting a string to text props without a locale

## v0.0.73 (Oct 2025)

- Optimzed Native Subscriptions
- Optimized Server client integration
-

## v0.0.74 (Dec 2025)

-
-
-

## v0.0.75 (Jan 2026)
