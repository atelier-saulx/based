# Copyright (c) 2022-2024 SAULX
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
		lib/nodeflate \
		lib/xxHash \
		lib/util \
		lib/selva

LIB_PATH := ../../../build
export LIB_PATH

# Build all libraries (ordered)
all: | $(LIBS) nodeselva locale

$(LIBS):
	$(MAKE) -C $@

ifeq ($(uname_S),Linux)
locale: locale-linux
endif

locale-linux:
	$(MAKE) -C locale LOCPATH=../../build/locale

test:
	$(MAKE) -C test

clean:
	find . -type f -name "*.d" -exec rm -f {} \;
	find . -type f -name "*.o" -exec rm -f {} \;
	find . -type f -name "*.so" -exec rm -f {} \;
	find . -type f -name "*.so.*" -exec rm -f {} \;
	find ./lib \( -type l -o -type l \) -name "*.so" -exec rm -f {} \;
	find ./lib \( -type l -o -type l \) -name "*.dylib" -exec rm -f {} \;
	find ./lib -type d -maxdepth 1 -exec $(MAKE) -C {} clean \;

.PHONY: all clean lib $(LIBS) nodeselva locale locale-linux test
.NOTPARALLEL:
