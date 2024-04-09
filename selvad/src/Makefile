# Copyright (c) 2022-2024 SAULX
# SPDX-License-Identifier: MIT

include ../common.mk

OBJ := \
	   config.o \
	   event_loop.o \
	   heap.o \
	   langs.o \
	   main.o \
	   module.o \
	   proc_init.o \
	   promise.o \
	   selva_log.o \
	   timers.o

CFLAGS += -fvisibility=hidden \
		  -I../include \
		  -include ../include/cdefs.h \
		  -DEVL_MAIN=1

LDFLAGS += -L ../lib
LDLIBS := -ljemalloc_selva -lutil -ldeflate
ifeq ($(uname_S),Linux)
OBJ += \
	   linux/poll.o \
	   linux/signal.o
CFLAGS += -DUSE_EPOLL=1
LDFLAGS += -rdynamic -ldl -lm -Wl,-rpath,'$$ORIGIN'/lib:'$$ORIGIN'/modules
endif
ifeq ($(uname_S),Darwin)
OBJ += \
	   darwin/poll.o \
	   darwin/signal.o
CFLAGS += -DUSE_POLL=1
LDFLAGS += -Wl,-rpath,@executable_path/lib,-rpath,@executable_path/modules
endif

DEP := $(OBJ:%.o=%.d)

../selvad: $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^ $(LDLIBS)

-include $(DEP)
