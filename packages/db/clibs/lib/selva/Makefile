# Copyright (c) 2022-2025 SAULX
# SPDX-License-Identifier: MIT
include ../../common.mk

CFLAGS += -fPIC -fvisibility=hidden \
		  -iquote ../../include -include ../../include/cdefs.h
LDFLAGS += -shared -g3 \
		   -L$(LIB_PATH) \
		   -ljemalloc_selva -ldeflate -lxxhash

ifeq ($(uname_S),Linux)
	LDFLAGS += -ldl -fPIC -z nodelete -rdynamic -Wl,-rpath,'$$ORIGIN'
endif
ifeq ($(uname_S),Darwin)
	CFLAGS += -Wno-gnu-alignof-expression
	LDFLAGS += -undefined dynamic_lookup \
			   -Wl,-install_name,@rpath/libselva$(LIB_SUFFIX) \
			   -Wl,-rpath,@loader_path
endif

OBJ := \
	alias.o \
	backoff_timeout.o \
	bitmap.o \
	db.o \
	db_panic.o \
	eztrie.o \
	fast_linear_search.o \
	fields.o \
	find.o \
	ida.o \
	idz.o \
	io/dump.o \
	io/io.o \
	io/sdb.o \
	mem/auto_free.o \
	mem/finalizer.o \
	mem/mempool.o \
	node_id_set.o \
	poptop.o \
	print_ready.o \
	queue_r.o \
	ref_save_map.o \
	schema.o \
	selva_error.o \
	selva_hash128.o \
	selva_lang/selva_deflate_mbscmp.o \
	selva_lang/selva_deflate_mbsstrstr.o \
	selva_lang/selva_lang.o \
	selva_lang/selva_mbscmp.o \
	selva_lang/selva_mbsstrstr.o \
	selva_lang/selva_mbstowc.o \
	selva_lang/selva_mbstrans.o \
	selva_string.o \
	sort.o \
	string/base64.o \
	string/base64url.o \
	string/cstrings.o \
	string/fast_memmem.o \
	string/mempbrk.o \
	string/strntol.o \
	string/strsearch.o \
	svector.o \
	time/ctime.o \
	time/timestamp.o \
	traverse.o \
	trx.o \
	types.o \
	worker_ctx.o

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

ifeq ($(uname_S),Darwin)
	OBJ += \
		string/memrchr.o
endif

TARGET := $(LIB_PATH)/libselva$(LIB_SUFFIX)

DEP := $(OBJ:%.o=%.d)

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^

-include $(DEP)
