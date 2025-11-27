# Copyright (c) 2022-2025 SAULX
# SPDX-License-Identifier: MIT
include ../../common.mk

# TODO Move this to common?
cc-option = $(shell if $(CC) $(1) -c -x c /dev/null -o /dev/null \
	      1>&2 2>/dev/null; then echo $(1); fi)

CFLAGS += -fPIC -fvisibility=hidden -I../../include \
	-O2 -fomit-frame-pointer -Wall -Wundef	\
	$(call cc-option,-Wimplicit-fallthrough) \
	$(call cc-option,-Wmissing-prototypes) \
	$(call cc-option,-Wpedantic) \
	$(call cc-option,-Wshadow) \
	$(call cc-option,-Wstrict-prototypes) \
	$(call cc-option,-Wvla) \
	$(call cc-option,-Wno-keyword-macro) \
	$(call cc-option,-Wno-constant-logical-operand) \
	-DNDEBUG
LDFLAGS += -g -L$(LIB_PATH)

OBJ := \
	lib/deflate_compress.o \
	lib/deflate_decompress.o \
	lib/deflate_decompress_stream.o \
	lib/strings.o

ifeq ($(uname_M),aarch64)
	OBJ += lib/arm/cpu_features.o
endif
ifeq ($(uname_M),x86_64)
	OBJ += lib/x86/cpu_features.o
endif

LDFLAGS += -ljemalloc_selva
ifeq ($(uname_S),Linux)
	LDFLAGS += -shared -fPIC -z relro -z now
endif
ifeq ($(uname_S),Darwin)
	LDFLAGS += -shared -Wl,-install_name,@rpath/libdeflate$(LIB_SUFFIX)
endif

TARGET := $(LIB_PATH)/libdeflate$(LIB_SUFFIX)

DEP := $(OBJ:%.o=%.d)

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^
	$(stripLinux)

-include $(DEP)
