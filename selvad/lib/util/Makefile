# Copyright (c) 2022-2024 SAULX
# SPDX-License-Identifier: MIT
include ../../common.mk

CFLAGS += -fPIC -Wno-unused-function -I../../include
# To remove warnings about asserts
CFLAGS += -Wno-unused-value
ifeq ($(uname_S),Darwin)
CFLAGS += -Wunused-comparison
endif
LDFLAGS += -g -L../

OBJ := \
	array_field.o \
	auto_free.o \
	backoff_timeout.o \
	base64.o \
	bitmap.o \
	crc32c/crc32c.o \
	cstrings.o \
	ctime.o \
	eztrie.o \
	fd_to_str.o \
	finalizer.o \
	hll.o \
	ida.o \
	mempbrk.o \
	mempool.o \
	poptop.o \
	queue_r.o \
	selva_error.o \
	selva_lang/selva_lang.o \
	selva_lang/selva_mbscmp.o \
	selva_lang/selva_mbstrans.o \
	selva_proto.o \
	selva_proto_buf.o \
	selva_proto_builder.o \
	selva_proto_print.o \
	selva_proto_scanf.o \
	selva_rusage.o \
	selva_string.o \
	sigstr.o \
	strntol.o \
	svector.o \
	tcp.o \
	timestamp.o \
	trx.o

ifeq ($(uname_S),Linux)
	LDFLAGS += -shared -fPIC -z nodelete
endif
ifeq ($(uname_S),Darwin)
	OBJ += memrchr.o
	LDFLAGS += -shared -Wl,-install_name,@rpath/libutil$(LIB_SUFFIX)
	LDFLAGS += -ljemalloc_selva -ldeflate
endif

ifndef LIB_SUFFIX
$(error LIB_SUFFIX is not set)
endif
TARGET := ../libutil$(LIB_SUFFIX)

DEP := $(OBJ:%.o=%.d)

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^

-include $(DEP)
