# Copyright (c) 2022-2025 SAULX
# SPDX-License-Identifier: MIT

SHELL := /bin/bash
MAKEFLAGS += --jobs=4 --output-sync=target

include common.mk
export uname_S
export uname_M
export TARGET_CFLAGS

# Ordered list of libraries
LIBS := \
		lib/jemalloc \
		lib/deflate \
		lib/xxHash \
		lib/selva

LIB_PATH := ../../../dist/lib/$(PLATFORM)
export LIB_PATH

# Build all libraries (ordered)
all: | prepare $(LIBS)
	cp -R include "$(subst ../../,,$(LIB_PATH))/"

prepare:
	mkdir -p "$(subst ../../,,$(LIB_PATH))"

$(LIBS):
	$(MAKE) -C $@

test:
	$(MAKE) -C test

platform:
	@echo -n "$(PLATFORM)"

clean:
	find . -type f -name "*.d" -exec rm -f {} \;
	find . -type f -name "*.o" -exec rm -f {} \;
	find . -type f -name "*.so" -exec rm -f {} \;
	find . -type f -name "*.so.*" -exec rm -f {} \;
	find ./lib \( -type l -o -type l \) -name "*.so" -exec rm -f {} \;
	find ./lib \( -type l -o -type l \) -name "*.dylib" -exec rm -f {} \;
	find ./lib -type d -maxdepth 1 -exec $(MAKE) -C {} clean \;

# New target for hll executable
hll: lib/selva
	$(CC) -g -std=gnu23 -o lib/selva/hll/hll lib/selva/hll/hll.c lib/selva/db_panic.c -Ilib/selva/include -Iinclude -Ilib/xxHash -L"$(subst ../../,,$(LIB_PATH))/" -lm -lselva -lxxhash -Wno-unknown-attributes -Wl,-rpath,"$(subst ../../,,$(LIB_PATH))/"

.PHONY: all prapare clean lib $(LIBS) test platform
.NOTPARALLEL:
