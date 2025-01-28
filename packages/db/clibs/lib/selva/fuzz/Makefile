# Copyright (c) 2022-2023, 2025 SAULX
# SPDX-License-Identifier: MIT

CFLAGS := -std=gnu2x -g -O1 \
		  -include ../../../include/cdefs.h -I../../../include \
		  -Wno-unknown-attributes \
		  -fsanitize=fuzzer,signed-integer-overflow,address

all: strrnchr stringlist_search strsearch_hamming_mbs fast_linear_search

strrnchr: strrnchr.c ../string/cstrings.c
	clang $(CFLAGS) $^ -o $@

stringlist_search: stringlist_search.c ../string/cstrings.c
	clang $(CFLAGS) $^ -o $@

strsearch_hamming_mbs: strsearch_hamming_mbs.c ../string/strsearch_hamming.c
	clang $(CFLAGS) $^ -o $@

fast_linear_search: fast_linear_search.c ../fast_linear_search.c
	clang $(CFLAGS) $^ -o $@
