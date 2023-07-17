<!--
Copyright (c) 2022-2023 SAULX

SPDX-License-Identifier: MIT
-->

# Selva Daemon

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

### Async IO

- Timers: [demo\_timeout](../modules/demo_timeout)
- Promises (async-await): [demo\_await](../modules/demo_await)
- Async file IO: [demo\_sock](../modules/demo_sock)

## Selva Protocol

The server implementation of `selva_proto` is located in the
[server](../modules/server) module. The protocol is documented in
[doc/selva\_proto.md](modules/server/selva_proto.md).

