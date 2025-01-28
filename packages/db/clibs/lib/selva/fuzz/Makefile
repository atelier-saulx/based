# Copyright (c) 2022-2023 SAULX
#
# SPDX-License-Identifier: MIT

CFLAGS := -std=gnu2x -g -O1 -include ../../../include/cdefs.h -I../../../include

all: strrnchr get_array_field_index stringlist_search

strrnchr: strrnchr.c ../cstrings.c
	clang $(CFLAGS) -fsanitize=fuzzer,signed-integer-overflow $^ -o $@

stringlist_search: stringlist_search.c ../cstrings.c
	clang $(CFLAGS) -fsanitize=fuzzer,signed-integer-overflow $^ -o $@
