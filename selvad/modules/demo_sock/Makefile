# Copyright (c) 2022, 2024 SAULX
# SPDX-License-Identifier: MIT

TARGET := ../mod_demo_sock$(MOD_SUFFIX)

$(TARGET): demo.o
	$(CC) -o $@ $(LDFLAGS) $^ $(LDLIBS)

-include demo.d
