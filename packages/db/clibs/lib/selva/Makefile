# Copyright (c) 2022-2024 SAULX
# SPDX-License-Identifier: MIT
include ../../common.mk

CFLAGS += -fPIC -fvisibility=hidden -iquote ../../include -I ../../../deps/node-v20.11.1/include/node -include ../../include/cdefs.h
LDFLAGS += -shared -g \
		   -L../../../build \
		   -ljemalloc_selva -ldeflate -lutil -lxxhash
LIB_SUFFIX := .node

OBJ := \
	db.o \
	db_panic.o \
	fields.o \
	filter.o \
	find.o \
	io/dump.o \
	io/io.o \
	io/sdb.o \
	schema.o \
	selva.o \
	selva_object/selva_object.o \
	selva_object/selva_object_foreach.o \
	selva_set/selva_set.o \
	traverse.o \
	update.o

ifeq ($(uname_S),Linux)
	LDFLAGS += -ldl -fPIC -rdynamic -Wl,-rpath,'$$ORIGIN'
endif
ifeq ($(uname_S),Darwin)
	LDFLAGS += -undefined dynamic_lookup \
			   -Wl,-install_name,@rpath/libselva$(LIB_SUFFIX) \
			   -Wl,-rpath,@loader_path
endif

TARGET := $(LIB_PATH)/libselva$(LIB_SUFFIX)

DEP := $(OBJ:%.o=%.d)

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^

-include $(DEP)
