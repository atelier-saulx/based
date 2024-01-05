# Copyright (c) 2022-2024 SAULX
# SPDX-License-Identifier: MIT

OBJ := \
	   conn.o \
	   message_buf.o \
	   message_none.o \
	   message_sock.o \
	   pubsub.o \
	   selva_send.o \
	   server.o \
	   server_recv_message.o
DEP := $(OBJ:%.o=%.d)
CFLAGS += -DSELVA_SERVER_MAIN=1
LDFLAGS += -lutil -ljemalloc_selva
TARGET := ../mod_server$(MOD_SUFFIX)

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^

-include $(DEP)
