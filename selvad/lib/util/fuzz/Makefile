# Copyright (c) 2022-2023 SAULX
#
# SPDX-License-Identifier: MIT

CFLAGS := -std=gnu2x -g -O1 -include ../../../include/cdefs.h -I../../../include

all: strrnchr get_array_field_index selva_proto_parse_vtype stringlist_search

strrnchr: strrnchr.c ../cstrings.c
	clang $(CFLAGS) -fsanitize=fuzzer,signed-integer-overflow $^ -o $@

get_array_field_index: get_array_field_index.c ../cstrings.c
	clang $(CFLAGS) -fsanitize=fuzzer,signed-integer-overflow $^ -o $@

selva_proto_parse_vtype: get_array_field_index.c ../cstrings.c
	clang $(CFLAGS) -fsanitize=fuzzer,signed-integer-overflow $^ -o $@

stringlist_search: stringlist_search.c ../cstrings.c
	clang $(CFLAGS) -fsanitize=fuzzer,signed-integer-overflow $^ -o $@
