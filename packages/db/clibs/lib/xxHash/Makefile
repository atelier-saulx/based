# Copyright (c) 2022-2024 SAULX
# SPDX-License-Identifier: MIT

XXHASH_SRC_PATH := xxHash-0.8.2

ifeq ($(uname_S),Linux)
all: linux
endif
ifeq ($(uname_S),Darwin)
all: darwin
endif

ERR = $(error Unsupported platform!)

err: ; $(ERR)

linux: build
	cp $(XXHASH_SRC_PATH)/libxxhash.so* ../../../build/

darwin: build
	cp $(XXHASH_SRC_PATH)/libxxhash*.dylib ../../../build/
	install_name_tool -id @rpath/libxxhash.dylib ../../../build/libxxhash.dylib

build:
	$(MAKE) -C $(XXHASH_SRC_PATH)
	rsync --checksum $(XXHASH_SRC_PATH)/xxhash.h ../../include

clean:
	$(MAKE) -C xxHash-0.8.2 clean

.PHONY: all err clean
