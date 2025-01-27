# Copyright (c) 2022-2025 SAULX
# SPDX-License-Identifier: MIT
include ../../common.mk

CFLAGS += -fPIC -Wno-unused-function -I../../include
# To remove warnings about asserts
CFLAGS += -Wno-unused-value
ifeq ($(uname_S),Darwin)
CFLAGS += -Wunused-comparison
endif
LDFLAGS += -g -L$(LIB_PATH)

OBJ := \
	auto_free.o \
	backoff_timeout.o \
	base64.o \
	base64url.o \
	bitmap.o \
	cstrings.o \
	ctime.o \
	eztrie.o \
	fast_memmem.o \
	finalizer.o \
	ida.o \
	mempbrk.o \
	mempool.o \
	poptop.o \
	queue_r.o \
	selva_error.o \
	selva_string.o \
	strntol.o \
	svector.o \
	timestamp.o \
	trx.o

ifeq ($(uname_M),x86_64)
OBJ += \
	crc32c/crc32c_x64.o
else ifeq ($(uname_M),aarch64)
# TODO This only works on Darwin currently
ifeq ($(uname_S),Darwin)
OBJ += \
	crc32c/crc32c_arm64.o
else
OBJ += \
	crc32c/crc32c.o
endif
else
OBJ += \
	crc32c/crc32c.o
endif

LDFLAGS += -ljemalloc_selva -ldeflate
ifeq ($(uname_S),Linux)
	LDFLAGS += -shared -fPIC -z nodelete -ldl -Wl,-rpath,'$$ORIGIN'
endif
ifeq ($(uname_S),Darwin)
	OBJ += \
		memrchr.o
	LDFLAGS += -shared -Wl,-install_name,@rpath/libutil$(LIB_SUFFIX)
endif

TARGET := $(LIB_PATH)/libutil$(LIB_SUFFIX)

DEP := $(OBJ:%.o=%.d)

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^

-include $(DEP)
