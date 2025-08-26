# Release Plan

This document provides a high-level overview of our database release plan.
It highlights the major planned evolutions and key milestones, without getting into extensive technical details.
Version numers could change due to nightly releases.

## v0.0.72 (Aug 2025)

- Include's internals enhancements
  - 20% faster performance from internal optimizations
  - New API feature: Meta information for adding contextual information through the data pipeline.
  - New API feature: Include options to modify the behaviour of db.include
  - Unpacking and processing results is now 30% faster. This enhancement is also fully supported in our browser client
  - IoWorker thread for saving and loading DB dumps
- Date/time & intervals in Aggregations: Aggregate functions now supports date, time, and interval data types. user can calculate durations, grouping by time windows, day, week, etc.
- `BaseType` options for `'vector'` (8/16/32-bit integers and 32/64-bit floating-points)
- New package: Export to CSV
  - We're introducing a new dedicated package for generating compliant CSV files from dumped datasets

## v0.0.73 (Oct 2025)

-
-
-

## v0.0.74 (Dec 2025)

-
-
-

## v0.0.75 (Jan 2026)
