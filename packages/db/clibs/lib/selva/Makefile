# Copyright (c) 2022-2024 SAULX
# SPDX-License-Identifier: MIT
include ../../common.mk

CFLAGS += -fPIC -fvisibility=hidden \
		  -iquote ../../include -I ../../../deps/node-v20.11.1/include/node -include ../../include/cdefs.h
LDFLAGS += -shared -g \
		   -L../../../build \
		   -ljemalloc_selva -ldeflate -lutil -lxxhash

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
	fields.o \
	filter.o \
	find.o \
	idz.o \
	io/dump.o \
	io/io.o \
	io/sdb.o \
	langs.o \
	ref_save_map.o \
	schema.o \
	sort.o \
	traverse.o \
	types.o \
	update.o

ifeq ($(NAPI),1)
	OBJ += node_selva.o
	LIB_SUFFIX := .node
endif

TARGET := $(LIB_PATH)/libselva$(LIB_SUFFIX)

DEP := $(OBJ:%.o=%.d)

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^

-include $(DEP)
