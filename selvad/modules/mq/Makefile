# Copyright (c) 2024 SAULX
# SPDX-License-Identifier: MIT

OBJ := \
	   mq.o
DEP := $(OBJ:%.o=%.d)
LDFLAGS += -lutil -ljemalloc_selva -ldeflate
TARGET := ../mod_mq$(MOD_SUFFIX)

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^

-include $(DEP)
