# Copyright (c) 2023 SAULX
# SPDX-License-Identifier: MIT

OBJ := \
	   find2find.o \
	   piper.o \
	   piper_error.o
DEP := $(OBJ:%.o=%.d)
LDFLAGS += -lutil -ljemalloc_selva -ldeflate
TARGET := ../mod_piper$(MOD_SUFFIX)

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^

-include $(DEP)
