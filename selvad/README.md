<!--
Copyright (c) 2022-2023 SAULX

SPDX-License-Identifier: MIT
-->

Selvad
======

Directory Structure
-------------------

- [doc/](doc) documentation
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
- `install` - Install all binaries and required files (supports `$INSTALL_DIR`)
- `check` - Run `cppcheck`
- `test` - Run unit tests
- `test-gcov` - Run unit tests with gcov
- `clean` - Cleans the build results
- `mostlyclean` - Refrain from deleting libraries

Running the Server
------------------

```
./tools/demo-env/origin/start.sh
```

**Environment Variables**

Most config parameters are changed using environment variables.

See the available parameters by executing `config` command with `dbgcli`.

```
./tools/dbgcli/dbgcli
```

or

```
./tools/dbgcli/dbgcli -p PORT ADDR
```
