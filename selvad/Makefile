# Copyright (c) 2022-2024 SAULX
# SPDX-License-Identifier: MIT

SHELL := /bin/bash
MAKEFLAGS += --jobs=4 --output-sync=target

include common.mk
export uname_S
export uname_M
export TARGET_CFLAGS

INSTALL_DIR ?= binaries/$(uname_S)_$(uname_M)

# Ordered list of libraries
LIBS := \
		lib/deflate \
		lib/jemalloc \
		lib/sha3iuf \
		lib/util

all: selvad modules $(LIBS)

selvad: lib
	$(MAKE) -C src

# Build all libraries (ordered)
lib: | $(LIBS)

$(LIBS):
	$(MAKE) -C $@

modules: lib
	$(MAKE) -C modules

ifeq ($(uname_S),Linux)
install: locale
endif

locale:
	$(MAKE) -C locale LOCPATH=../$(INSTALL_DIR)/locale

install: all
	mkdir -p "$(INSTALL_DIR)/lib"
	mkdir -p "$(INSTALL_DIR)/modules"
	mkdir -p "$(INSTALL_DIR)/locale"
	install $(wildcard lib/lib*) "$(INSTALL_DIR)/lib"
	install $(wildcard modules/*$(MOD_SUFFIX)) "$(INSTALL_DIR)/modules"
	install selvad "$(INSTALL_DIR)/"

test:
	$(MAKE) -C test

test-valgrind: export WITH_VALGRIND = valgrind
test-valgrind:
	$(MAKE) -C test

ifeq ($(uname_S),Linux)
test-gcov: test
	./scripts/coverage.sh
else
test-gcov:
	$(error coverage (gcov) not available on this platform)
endif

check:
	cppcheck src/ modules/

mostlyclean:
	$(RM) selvad
	find ./src -type f -name "*.d" -exec rm -f {} \;
	find ./src -type f -name "*.o" -exec rm -f {} \;
	find ./modules -type f -name "*.d" -exec rm -f {} \;
	find ./modules -type f -name "*.o" -exec rm -f {} \;
	find ./modules -type f -name "*.so" -exec rm -f {} \;
	$(MAKE) -C test clean

clean: mostlyclean
	$(RM) selvad
	find . -type f -name "*.d" -exec rm -f {} \;
	find . -type f -name "*.o" -exec rm -f {} \;
	find ./lib -type f -name "*.so" -exec rm -f {} \;
	find ./lib -type f -name "*.so.*" -exec rm -f {} \;
	find . \( -type l -o -type l \) -name "*.so" -exec rm -f {} \;
	find . \( -type l -o -type l \) -name "*.dylib" -exec rm -f {} \;
	$(MAKE) -C test clean
	find ./lib -type d -maxdepth 1 -exec $(MAKE) -C {} clean \;

.PHONY: all clean check test mostlyclean selvad modules lib $(LIBS) locale
.NOTPARALLEL:
