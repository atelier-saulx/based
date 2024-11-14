# Copyright (c) 2022-2024 SAULX
# SPDX-License-Identifier: MIT
include ../../common.mk

CFLAGS += -fPIC -Wno-unused-function -I../../include
# To remove warnings about asserts
CFLAGS += -Wno-unused-value
ifeq ($(uname_S),Darwin)
CFLAGS += -Wunused-comparison
endif
LDFLAGS += -g -L../../../build

OBJ := \
	array_field.o \
	auto_free.o \
	backoff_timeout.o \
	base64.o \
	base64url.o \
	bitmap.o \
	cstrings.o \
	ctime.o \
	eztrie.o \
	finalizer.o \
	hll.o \
	ida.o \
	mempbrk.o \
	mempool.o \
	poptop.o \
	queue_r.o \
	selva_cpu.o \
	selva_error.o \
	selva_lang/selva_lang.o \
	selva_lang/selva_mbscmp.o \
	selva_lang/selva_mbsstrstr.o \
	selva_lang/selva_mbstowc.o \
	selva_lang/selva_mbstrans.o \
	selva_rusage.o \
	selva_string.o \
	sigstr.o \
	strntol.o \
	svector.o \
	timestamp.o \
	trx.o

ifeq ($(uname_M),x86_64)
OBJ += \
	crc32c/crc32c_x64.o
else ifeq ($(uname_M),arm64)
OBJ += \
	crc32c/crc32c_arm64.o
else
OBJ += \
	crc32c/crc32c.o
endif

LDFLAGS += -ljemalloc_selva -ldeflate
ifeq ($(uname_S),Linux)
	OBJ += \
		selva_cpu_linux.o
	LDFLAGS += -shared -fPIC -z nodelete -ldl -Wl,-rpath,'$$ORIGIN'
endif
ifeq ($(uname_S),Darwin)
	OBJ += \
		memrchr.o \
		selva_cpu_darwin.o
	LDFLAGS += -shared -Wl,-install_name,@rpath/libutil$(LIB_SUFFIX)
endif

TARGET := $(LIB_PATH)/libutil$(LIB_SUFFIX)

DEP := $(OBJ:%.o=%.d)

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^

-include $(DEP)
