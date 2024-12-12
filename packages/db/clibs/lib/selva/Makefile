# Copyright (c) 2022-2024 SAULX
# SPDX-License-Identifier: MIT
include ../../common.mk

CFLAGS += -fPIC -fvisibility=hidden \
		  -iquote ../../include -I ../../../deps/node-v20.11.1/include/node -include ../../include/cdefs.h
LDFLAGS += -shared -g \
		   -L../../../build \
		   -ljemalloc_selva -ldeflate -lutil -lxxhash -lzstd

ifeq ($(uname_S),Linux)
	LDFLAGS += -ldl -fPIC -rdynamic -Wl,-rpath,'$$ORIGIN'
endif
ifeq ($(uname_S),Darwin)
	CFLAGS += -Wno-gnu-alignof-expression
	LDFLAGS += -undefined dynamic_lookup \
			   -Wl,-install_name,@rpath/libselva$(LIB_SUFFIX) \
			   -Wl,-rpath,@loader_path
endif

OBJ := \
	alias.o \
	db.o \
	db_panic.o \
	fast_linear_search.o \
	fields.o \
	find.o \
	idz.o \
	io/dump.o \
	io/io.o \
	io/sdb.o \
	node_id_set.o \
	print_ready.o \
	ref_save_map.o \
	schema.o \
	selva_hash128.o \
	selva_lang/selva_deflate_mbscmp.o \
	selva_lang/selva_deflate_mbsstrstr.o \
	selva_lang/selva_lang.o \
	selva_lang/selva_mbscmp.o \
	selva_lang/selva_mbsstrstr.o \
	selva_lang/selva_mbstowc.o \
	selva_lang/selva_mbstrans.o \
	sort.o \
	strsearch.o \
	traverse.o \
	types.o \
	worker_ctx.o

TARGET := $(LIB_PATH)/libselva$(LIB_SUFFIX)

DEP := $(OBJ:%.o=%.d)

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^

-include $(DEP)
