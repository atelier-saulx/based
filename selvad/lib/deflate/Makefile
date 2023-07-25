# Copyright (c) 2022-2023 SAULX
# SPDX-License-Identifier: MIT
LIBDEFLATE_VER ?= 1.18

# TODO Build only TARGET and use LDFLAGS
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
	cd "./libdeflate-$(LIBDEFLATE_VER)" && cmake -B build && cmake --build build
	rsync --checksum "./libdeflate-$(LIBDEFLATE_VER)/libdeflate.h" "../../include/libdeflate.h"
ifeq ($(uname_S),Linux)
	cp -P "libdeflate-$(LIBDEFLATE_VER)/build/libdeflate.so.0" "../"
	cp -P "libdeflate-$(LIBDEFLATE_VER)/build/libdeflate.so" "../"
endif
ifeq ($(uname_S),Darwin)
	install_name_tool -id @rpath/libdeflate.dylib "libdeflate-$(LIBDEFLATE_VER)/build/libdeflate.dylib"
	install_name_tool -id @rpath/libdeflate.0.dylib "libdeflate-$(LIBDEFLATE_VER)/build/libdeflate.0.dylib"
	cp -P "libdeflate-$(LIBDEFLATE_VER)/libdeflate.0.dylib" "../"
	cd .. && ln -s "libdeflate.0.dylib" "libdeflate.dylib" || true
endif

clean: 
	$(RM) "./libdeflate-$(LIBDEFLATE_VER)/build"

.PHONY: clean deflate
