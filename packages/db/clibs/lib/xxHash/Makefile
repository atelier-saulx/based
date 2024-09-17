# Copyright (c) 2022-2024 SAULX
# SPDX-License-Identifier: MIT

XXHASH_SRC_PATH := xxHash-0.8.2

ifeq ($(uname_S),Linux)
	# TODO rpath_linux
endif
ifeq ($(uname_S),Darwin)
all: darwin
endif

build:
	$(MAKE) -C $(XXHASH_SRC_PATH)
	cp $(XXHASH_SRC_PATH)/libxxhash*.dylib ../../../build/
	cp $(XXHASH_SRC_PATH)/xxhash.h ../../include

darwin: build
	install_name_tool -id @rpath/libxxhash.dylib ../../../build/libxxhash.dylib

clean:
	$(MAKE) -C xxHash-0.8.2 clean

.PHONY: all clean
