# BasedDb

BasedDb is a powerful node graph based database solution that supports various
data types, references, edges, and operations. It also offers concurrency
handling, client-server architecture support, and more.

- Schema definition and management
- Data creation, querying, updating, and deletion
- Supported field types
  - `string`
  - `text`, locale aware multi-language [text](/db/text)
  - `binary` strings
  - `timestamp`
  - numeric types: `number` (double-precision floating-point), `int8`, `uint8`, `int16`, `uint16`, `int32`, `uint64`
  - `boolean`
  - `alias`
  - `enum`
  - row and columnar vectors: `vector` and `colvec`
  - `cardinality` set
- References and edge properties for advanced data modeling
- Concurrency support for high-load scenarios
- Client-server design for distributed systems
- Checksum, analytics, and expiration features
- Async block based backups, i.e. only dirty blocks needs to be written on save

Pick your next step:

- [Install](/db/install) – npm, Docker or build from source
- [Getting started](/db/getting-started) – define a schema and query nodes
- [API](/db/api) - Database API
- [Examples](/db/examples)
