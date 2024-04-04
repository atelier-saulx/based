# Copyright (c) 2022-2023 SAULX
# SPDX-License-Identifier: MIT
LIBDEFLATE_VER ?= 1.14

ifeq ($(uname_S),Linux)
	LDFLAGS := -z relro -z now
	TARGET := libdeflate.so
endif
ifeq ($(uname_S),Darwin)
	TARGET := libdeflate.dylib
endif
ifndef TARGET
$(error TARGET is not set)
endif

CUSTOM_CFLAGS := -fPIC $(TARGET_CFLAGS)

deflate:
	$(MAKE) "CFLAGS=$(CUSTOM_CFLAGS)" "LDFLAGS=$(LDFLAGS)" -C ./libdeflate-$(LIBDEFLATE_VER) $(TARGET)
	rsync --checksum "./libdeflate-$(LIBDEFLATE_VER)/libdeflate.h" "../../include/libdeflate.h"
ifeq ($(uname_S),Linux)
	cp -P libdeflate-$(LIBDEFLATE_VER)/libdeflate.so.0 "../"
	cp -P libdeflate-$(LIBDEFLATE_VER)/libdeflate.so "../"
endif
ifeq ($(uname_S),Darwin)
	install_name_tool -id @rpath/libdeflate.dylib libdeflate-$(LIBDEFLATE_VER)/libdeflate.dylib
	install_name_tool -id @rpath/libdeflate.0.dylib libdeflate-$(LIBDEFLATE_VER)/libdeflate.0.dylib
	cp -P libdeflate-$(LIBDEFLATE_VER)/libdeflate.0.dylib "../"
	cd .. && ln -s "libdeflate.0.dylib" "libdeflate.dylib" || true
endif

clean: 
	$(MAKE) -C ./libdeflate-$(LIBDEFLATE_VER) clean

.PHONY: clean deflate
