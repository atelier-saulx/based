<!--
Copyright (c) 2022-2024 SAULX

SPDX-License-Identifier: MIT
-->

# Selva Daemon

## Architecture

The Selvad daemon is built on an in-house event\_loop lib/base. The base daemon
only provides some basic initialization, a simple event loop system, and a
module loader. All the database functionality is divided into several loadable
modules.

## Modules

The most important modules are the following:

- **db**: Implements the database (data structures and such)
- **io**: Implements the serialization to disk and in-mem
- **server**: Implements the networking parts, TCP server and command message serialization over the wire
- **replication**: Implements the replication of commands and database dumps over the network using **server**

### db

The **db** module provides the hierarchy, objects, indexing, subscriptions, and queries.
It registers a number of RPC-like commands with the **server** module, so that a client
can read and write the database.

Read [more](modules/db/README.md).

### io

Implements the persistent data serialization format called `SDB` as well as client
commands to dump and load `SDB` files.

Read [more](modules/io/README.md).

### server

Read [more](modules/server/README.md).


### replication

The **replication** module implements server roles (origin and replica),
replication of server commands ran on an origin node to the replicas, and
commands to observe and change the replication. Replication of commands doesn't
happen implicitly but each command function must explicitly call one of the
`replicate` functions to trigger the replication.

Read [more](modules/replication/README.md).

## Feature Notes

### Fast incremental counters

Sometimes it's necessary to increment counters fast and often (e.g. live
voting). This kind of task can be accelerated efficiently by using the
`object.incrby` and `object.incrbydouble` commands.

### Publisher/subscriber pattern

The **server** module implements a **pubsub** feature divided into channels
(number). It's possible to publish a message to a channel internally with the
`selva_pubsub_publish()` function or externally wit the `publish` command.
Channels are subscribed with the `subscribe` command and unsubscribed with
`unsubscribe`.

The `subscribe` command is implemented as an asynchronous stream in
**selva_proto** and thus the client nor the server are blocked when the
command is called, i.e. the client subscribes to a channel.

The subscription marker system implemnted by the **hierarchy** module utilizes
**pubsub** for sending subscription events to the client(s).

## API

### Globally available symbols

Module symbols are never shared between the main program or the modules by
default and the only way to access functions and global variables from modules
and the `event_loop` API is by using the import macros from `module.h` (which
in turn does the right tricks with `dlfcn.h`).

For convenience and to be still compatible with standard C programming workflows
the libc and jemalloc functions are always made available in the global namespace
by the dynamic linker.

### Importing module API functions

```c
#include "module.h"
/* TODO #include required headers */

/* ... */

/*
 * The best practice is to declare all imports in an IMPORT() block at the end
 * of the file (before the __constructor function of the module).
 */
IMPORT() {
    evl_import(func, "mod"); /* Import func from "mod" */
    evl_import_main(selva_log); /* Import a single function from the main program. */
    evl_import_event_loop(); /* Some headers have a helper to import everything at once. */
}
```

### Memory Allocation

Never allocate memory with `malloc()`, `calloc()`, or `realloc()` nor free
memory using `free()`. Instead of the libc memory allocator the `selva_`
prefixed jemalloc should be preferred.

### Logging

In case of a fatal error, print an error message using `SELVA_LOG(SELVA_LOGL_CRIT, ...)`
and terminate with either `abort()` or `exit()`. `abort()` should be used if the
integrity of the database has been compromised and there is nothing to dump. If the
state of the database is likely valid then `exit()` should be called to allow a
graceful shutdown and dump.

### Async IO

- Timers: [demo\_timeout](../modules/demo_timeout)
- Promises (async-await): [demo\_await](../modules/demo_await)
- Async file IO: [demo\_sock](../modules/demo_sock)

## Selva Protocol

The server implementation of `selva_proto` is located in the
[server](../modules/server) module. The protocol is documented in
[doc/selva\_proto.md](modules/server/selva_proto.md).
