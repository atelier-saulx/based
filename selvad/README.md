<!--
Copyright (c) 2022 SAULX

SPDX-License-Identifier: MIT
-->

Selvad
======

Directory Structure
-------------------

- [doc/README.md](doc) documentation
- `src/` contains sources for the main executable (event loop and module loader)
- `modules/` contains sources for loadable modules (selva)
- `lib/` contains libraries that can be used in modules (e.g. util, deflate, jemalloc)

Some source directories may have a subdirectory called `fuzz/`, that's for
fuzzers (using LLVM LibFuzzer).

Build Goals
-----------

The project build uses `make`.

**Targets:**
- `all` - Builds all targets
- `selvad` - Builds the main executable `selvad`
- `lib` - Builds all libraries
- `modules` - Builds all loadable modules 

**Phony targets:**
- `clean` - Cleans the build results
- `mostlyclean` - Refrain from deleting libraries
- `check` - Run `cppcheck`

Running the Server
------------------

```
./selvad
```

**Environment Variables**

Check `config` command with `dbgcli`.

