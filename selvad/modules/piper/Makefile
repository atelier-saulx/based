# Copyright (c) 2023-2024 SAULX
# SPDX-License-Identifier: MIT

OBJ := \
	   find2find.o \
	   piper.o \
	   piper_error.o
DEP := $(OBJ:%.o=%.d)
LDLIBS := -lutil -ljemalloc_selva -ldeflate
TARGET := ../mod_piper$(MOD_SUFFIX)

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^ $(LDLIBS)

-include $(DEP)
