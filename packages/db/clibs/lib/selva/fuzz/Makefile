# Copyright (c) 2022-2023, 2025 SAULX
# SPDX-License-Identifier: MIT

CFLAGS := -std=gnu2x -g -O1 \
		  -include ../../../include/cdefs.h -I../../../include \
		  -Wno-unknown-attributes \
		  -fsanitize=fuzzer,signed-integer-overflow

all: strrnchr get_array_field_index stringlist_search

strrnchr: strrnchr.c ../string/cstrings.c
	clang $(CFLAGS) $^ -o $@

stringlist_search: stringlist_search.c ../cstrings.c
	clang $(CFLAGS) $^ -o $@
