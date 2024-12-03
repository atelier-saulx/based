# Copyright (c) 2022-2024 SAULX
# SPDX-License-Identifier: MIT

ZSTD_VER := 1.5.6

all:
	$(MAKE) -C "zstd-$(ZSTD_VER)" ZSTD_LEGACY_SUPPORT=0 ZSTD_LIB_DEPRECATED=0
	cp -P "zstd-$(ZSTD_VER)/lib/libzstd.$(ZSTD_VER).dylib" "$(LIB_PATH)/libzstd.dylib"
	install_name_tool -id @rpath/libzstd.dylib "$(LIB_PATH)/libzstd.dylib"
	rsync --checksum "zstd-$(ZSTD_VER)/lib/zstd.h" "../../include/zstd.h"
	rsync --checksum "zstd-$(ZSTD_VER)/lib/zstd_errors.h" "../../include/zstd_errors.h"
	rsync --checksum "zstd-$(ZSTD_VER)/lib/zdict.h" "../../include/zdict.h"

clean:
	$(MAKE) -C "zstd-$(ZSTD_VER)" clean

.PHONY: all install clean
