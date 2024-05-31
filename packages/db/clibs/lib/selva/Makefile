# Copyright (c) 2022-2024 SAULX
# SPDX-License-Identifier: MIT
include ../../common.mk

CFLAGS += -fPIC -fvisibility=hidden -I../../include
LDFLAGS += -shared -g -L../ \
		   -ljemalloc_selva -ldeflate

OBJ := \
	main.o

ifeq ($(uname_S),Linux)
	LDFLAGS += -fPIC
endif
ifeq ($(uname_S),Darwin)
	LDFLAGS += -Wl,-install_name,@rpath/libselva$(LIB_SUFFIX)
endif

TARGET := ../libselva$(LIB_SUFFIX)

DEP := $(OBJ:%.o=%.d)

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^

-include $(DEP)
