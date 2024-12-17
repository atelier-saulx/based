# Copyright (c) 2022-2024 SAULX
# SPDX-License-Identifier: MIT

ZSTD_VER := 1.5.6

ifeq ($(uname_S),Linux)
all: linux
endif
ifeq ($(uname_S),Darwin)
all: darwin
endif

ERR = $(error Unsupported platform!)

err: ; $(ERR)

linux: build
	cp -P "zstd-$(ZSTD_VER)/lib/libzstd.so.$(ZSTD_VER)" "$(LIB_PATH)/libzstd.dylib"

darwin: build
	cp -P "zstd-$(ZSTD_VER)/lib/libzstd.$(ZSTD_VER).dylib" "$(LIB_PATH)/libzstd.dylib"
	install_name_tool -id @rpath/libzstd.dylib "$(LIB_PATH)/libzstd.dylib"

build:
	$(MAKE) -C "zstd-$(ZSTD_VER)" ZSTD_LEGACY_SUPPORT=0 ZSTD_LIB_DEPRECATED=0
	rsync --checksum "zstd-$(ZSTD_VER)/lib/zstd.h" "../../include/zstd.h"
	rsync --checksum "zstd-$(ZSTD_VER)/lib/zstd_errors.h" "../../include/zstd_errors.h"
	rsync --checksum "zstd-$(ZSTD_VER)/lib/zdict.h" "../../include/zdict.h"

clean:
	$(MAKE) -C "zstd-$(ZSTD_VER)" clean

.PHONY: all install clean
