# Copyright (c) 2022, 2024 SAULX
# SPDX-License-Identifier: MIT

TARGET := ../mod_demo_async$(MOD_SUFFIX)

$(TARGET): demo.o
	$(CC) -o $@ $(LDFLAGS) $^ $(LDIBS)

-include demo.d
