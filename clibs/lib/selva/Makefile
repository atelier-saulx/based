# Copyright (c) 2022-2025 SAULX
# SPDX-License-Identifier: MIT
include ../../common.mk

SELVA_VERSION := $(shell sh -c 'git rev-parse --verify HEAD')
CFLAGS += -fPIC -fvisibility=hidden \
		  -iquote ../../include \
		  -iquote ./include \
		  -include ../../include/cdefs.h
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
	bitmap.o \
	colvec.o \
	db.o \
	db_panic.o \
	expire.o \
	fast_linear_search.o \
	fields.o \
	fields_empty_text.o \
	ida.o \
	hll/hll.o \
	idz.o \
	io/dump.o \
	io/io.o \
	io/sdb.o \
	membar.o \
	mem/auto_free.o \
	mem/finalizer.o \
	mem/mempool.o \
	node_id_set.o \
	poptop.o \
	print_ready.o \
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
	string/cstrings.o \
	string/eztrie.o \
	string/fast_memmem.o \
	string/mblen.o \
	string/mempbrk.o \
	string/strntol.o \
	string/strsearch_hamming.o \
	string/strsearch_levenshtein.o \
	svector.o \
	time/backoff_timeout.o \
	time/ctime.o \
	time/gmtime.o \
	time/timestamp.o \
	types.o \
	vector/vdot.o \
	vector/vl1.o \
	vector/vl2s.o \
	vector/vsc.o \
	version.o

ifeq ($(uname_M),x86_64)
OBJ += \
	crc32c/crc32c_x64.o \
	string/fast_memcmp.o
	# This is not necessarily always faster, despite being vectorized
	# string/fast_memcmp_x64.o
else ifeq ($(uname_M),aarch64)
OBJ += \
	crc32c/crc32c_arm64.o \
	string/fast_memcmp_arm64.o
else
OBJ += \
	crc32c/crc32c.o \
	string/fast_memcmp.o
endif

ifeq ($(uname_S),Darwin)
	OBJ += \
		string/memrchr.o
endif

TARGET := $(LIB_PATH)/libselva$(LIB_SUFFIX)

DEP := $(OBJ:%.o=%.d)

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^

version.c: FORCE
	@echo selva_version $(SELVA_VERSION)
	@echo "const char * const selva_version = \"$(SELVA_VERSION)\";" > version.c

FORCE:

-include $(DEP)
