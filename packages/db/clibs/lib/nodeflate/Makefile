# Copyright (c) 2024 SAULX
# SPDX-License-Identifier: MIT
include ../../common.mk

CFLAGS += -fPIC -fvisibility=hidden -iquote ../../include -I ../../../deps/node-v20.11.1/include/node -include ../../include/cdefs.h
LDFLAGS += -shared -g \
		   -L../../../build \
		   -ldeflate
LIB_SUFFIX := .node

OBJ := \
	nodeflate.o

ifeq ($(uname_S),Linux)
	LDFLAGS += -fPIC
endif
ifeq ($(uname_S),Darwin)
	LDFLAGS += -undefined dynamic_lookup \
			   -Wl,-install_name,@rpath/nodeflate$(LIB_SUFFIX) \
			   -Wl,-rpath,@loader_path
endif

TARGET := $(LIB_PATH)/nodeflate$(LIB_SUFFIX)

DEP := $(OBJ:%.o=%.d)

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^

-include $(DEP)
