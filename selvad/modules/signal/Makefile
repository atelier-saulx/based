# Copyright (c) 2022-2024 SAULX
# SPDX-License-Identifier: MIT

OBJ := \
	   main.o \
	   reaper.o \
	   trace.o

DEP := $(OBJ:%.o=%.d)
CFLAGS += -DSELVA_SIGNAL_MAIN=1
LDLIBS += -lutil
TARGET := ../mod_signal$(MOD_SUFFIX)

ifeq ($(uname_S),Linux)
	LDFLAGS += -z nodelete
endif

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^ $(LDLIBS)

-include $(DEP)
