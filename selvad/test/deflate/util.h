/*
 * test_util.h - utility functions for test programs
 *
 * Copyright 2016 Eric Biggers
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

#pragma once

#include <stdint.h>

typedef size_t machine_word_t;

void alloc_guarded_buffer(size_t size, uint8_t **start_ret, uint8_t **end_ret);
void free_guarded_buffer(uint8_t *start, uint8_t *end);

uint64_t timer_ticks(void);
uint64_t timer_ticks_to_ms(uint64_t ticks);
uint64_t timer_MB_per_s(uint64_t bytes, uint64_t ticks);
uint64_t timer_KB_per_s(uint64_t bytes, uint64_t ticks);

struct output_bitstream {
	machine_word_t bitbuf;
	int bitcount;
	uint8_t *next;
	uint8_t *end;
};

bool put_bits(struct output_bitstream *os, machine_word_t bits, int num_bits);
bool flush_bits(struct output_bitstream *os);
