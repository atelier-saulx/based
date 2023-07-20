# Copyright (c) 2022-2023 SAULX
# SPDX-License-Identifier: MIT

OBJ := \
	   main.o \
	   trace.o

DEP := $(OBJ:%.o=%.d)
TARGET := ../mod_signal$(MOD_SUFFIX)

ifeq ($(uname_S),Linux)
	LDFLAGS += -Wl,-z,nodelete
endif

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^

-include $(DEP)
