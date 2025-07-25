/*
 * Copyright (c) 2024 SAULX
 * Copyright 2016 Eric Biggers
 *
 * SPDX-License-Identifier: MIT
 *
 * Test that the decompressor accepts incomplete Huffman codes in certain
 * specific cases.
 */
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <zlib.h>
#include "libdeflate.h"
#include "util.h"

static char *
verify_decompression_libdeflate(const uint8_t *in, size_t in_nbytes,
				uint8_t *out, size_t out_nbytes_avail,
				const uint8_t *expected_out,
				size_t expected_out_nbytes)
{
	struct libdeflate_decompressor *d;
	enum libdeflate_result res;
	size_t actual_out_nbytes;

	d = libdeflate_alloc_decompressor();
	pu_assert("", d != NULL);

	res = libdeflate_decompress(d, in, in_nbytes,
					    out, out_nbytes_avail,
					    &actual_out_nbytes);
	pu_assert("", res == LIBDEFLATE_SUCCESS);
	pu_assert("", actual_out_nbytes == expected_out_nbytes);
	pu_assert("", memcmp(out, expected_out, actual_out_nbytes) == 0);

	libdeflate_free_decompressor(d);

    return NULL;
}

static char *
verify_decompression_zlib(const uint8_t *in, size_t in_nbytes,
			  uint8_t *out, size_t out_nbytes_avail,
			  const uint8_t *expected_out, size_t expected_out_nbytes)
{
	z_stream z;
	int res;
	size_t actual_out_nbytes;

	memset(&z, 0, sizeof(z));
	res = inflateInit2(&z, -15);
	pu_assert("", res == Z_OK);

	z.next_in = (void *)in;
	z.avail_in = in_nbytes;
	z.next_out = (void *)out;
	z.avail_out = out_nbytes_avail;
	res = inflate(&z, Z_FINISH);
	pu_assert("", res == Z_STREAM_END);
	actual_out_nbytes = out_nbytes_avail - z.avail_out;
	pu_assert("", actual_out_nbytes == expected_out_nbytes);
	pu_assert("", memcmp(out, expected_out, actual_out_nbytes) == 0);

	inflateEnd(&z);

    return NULL;
}

static char *
verify_decompression(const uint8_t *in, size_t in_nbytes,
		     uint8_t *out, size_t out_nbytes_avail,
		     const uint8_t *expected_out, size_t expected_out_nbytes)
{
    char *s;

	s = verify_decompression_libdeflate(in, in_nbytes, out, out_nbytes_avail,
					expected_out, expected_out_nbytes);
    if (s) return s;
	return verify_decompression_zlib(in, in_nbytes, out, out_nbytes_avail,
				  expected_out, expected_out_nbytes);

}

/* Test that an empty offset code is accepted. */
PU_TEST(test_empty_offset_code)
{
	static const uint8_t expected_out[] = { 'A', 'B', 'A', 'A' };
	uint8_t in[128];
	uint8_t out[128];
	struct output_bitstream os = { .next = in, .end = in + sizeof(in) };
	int i;

	/*
	 * Generate a DEFLATE stream containing a "dynamic Huffman" block
	 * containing literals, but no offsets; and having an empty offset code
	 * (all codeword lengths set to 0).
	 *
	 * Litlen code:
	 *	litlensym_A			freq=3 len=1 codeword= 0
	 *	litlensym_B			freq=1 len=2 codeword=01
	 *	litlensym_256 (end-of-block)	freq=1 len=2 codeword=11
	 * Offset code:
	 *	(empty)
	 *
	 * Litlen and offset codeword lengths:
	 *	[0..'A'-1]	= 0	presym_18
	 *	['A']		= 1	presym_1
	 *	['B']		= 2	presym_2
	 *	['B'+1..255]	= 0	presym_18 presym_18
	 *	[256]		= 2	presym_2
	 *	[257]		= 0	presym_0
	 *
	 * Precode:
	 *	presym_0	freq=1 len=3 codeword=011
	 *	presym_1	freq=1 len=3 codeword=111
	 *	presym_2	freq=2 len=2 codeword= 01
	 *	presym_18	freq=3 len=1 codeword=  0
	 */

	pu_assert("", put_bits(&os, 1, 1));	/* BFINAL: 1 */
	pu_assert("", put_bits(&os, 2, 2));	/* BTYPE: DYNAMIC_HUFFMAN */
	pu_assert("", put_bits(&os, 0, 5));	/* num_litlen_syms: 0 + 257 */
	pu_assert("", put_bits(&os, 0, 5));	/* num_offset_syms: 0 + 1 */
	pu_assert("", put_bits(&os, 14, 4));	/* num_explicit_precode_lens: 14 + 4 */

	/*
	 * Precode codeword lengths: order is
	 * [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
	 */
	for (i = 0; i < 2; i++)		/* presym_{16,17}: len=0 */
		pu_assert("", put_bits(&os, 0, 3));
	pu_assert("", put_bits(&os, 1, 3));	/* presym_18: len=1 */
	pu_assert("", put_bits(&os, 3, 3));	/* presym_0: len=3 */
	for (i = 0; i < 11; i++)	/* presym_{8,...,13}: len=0 */
		pu_assert("", put_bits(&os, 0, 3));
	pu_assert("", put_bits(&os, 2, 3));	/* presym_2: len=2 */
	pu_assert("", put_bits(&os, 0, 3));	/* presym_14: len=0 */
	pu_assert("", put_bits(&os, 3, 3));	/* presym_1: len=3 */

	/* Litlen and offset codeword lengths */
	pu_assert("", put_bits(&os, 0x0, 1) &&
	       put_bits(&os, 54, 7));	/* presym_18, 65 zeroes */
	pu_assert("", put_bits(&os, 0x7, 3));	/* presym_1 */
	pu_assert("", put_bits(&os, 0x1, 2));	/* presym_2 */
	pu_assert("", put_bits(&os, 0x0, 1) &&
	       put_bits(&os, 89, 7));	/* presym_18, 100 zeroes */
	pu_assert("", put_bits(&os, 0x0, 1) &&
	       put_bits(&os, 78, 7));	/* presym_18, 89 zeroes */
	pu_assert("", put_bits(&os, 0x1, 2));	/* presym_2 */
	pu_assert("", put_bits(&os, 0x3, 3));	/* presym_0 */

	/* Litlen symbols */
	pu_assert("", put_bits(&os, 0x0, 1));	/* litlensym_A */
	pu_assert("", put_bits(&os, 0x1, 2));	/* litlensym_B */
	pu_assert("", put_bits(&os, 0x0, 1));	/* litlensym_A */
	pu_assert("", put_bits(&os, 0x0, 1));	/* litlensym_A */
	pu_assert("", put_bits(&os, 0x3, 2));	/* litlensym_256 (end-of-block) */

	pu_assert("", flush_bits(&os));

	return verify_decompression(in, os.next - in, out, sizeof(out),
			     expected_out, sizeof(expected_out));
}

/* Test that a litrunlen code containing only one symbol is accepted. */
PU_TEST(test_singleton_litrunlen_code)
{
	uint8_t in[128];
	uint8_t out[128];
	struct output_bitstream os = { .next = in, .end = in + sizeof(in) };
	int i;

	/*
	 * Litlen code:
	 *	litlensym_256 (end-of-block)	freq=1 len=1 codeword=0
	 * Offset code:
	 *	(empty)
	 *
	 * Litlen and offset codeword lengths:
	 *	[0..256]	= 0	presym_18 presym_18
	 *	[256]		= 1	presym_1
	 *	[257]		= 0	presym_0
	 *
	 * Precode:
	 *	presym_0	freq=1 len=2 codeword=01
	 *	presym_1	freq=1 len=2 codeword=11
	 *	presym_18	freq=2 len=1 codeword= 0
	 */

	pu_assert("", put_bits(&os, 1, 1));	/* BFINAL: 1 */
	pu_assert("", put_bits(&os, 2, 2));	/* BTYPE: DYNAMIC_HUFFMAN */
	pu_assert("", put_bits(&os, 0, 5));	/* num_litlen_syms: 0 + 257 */
	pu_assert("", put_bits(&os, 0, 5));	/* num_offset_syms: 0 + 1 */
	pu_assert("", put_bits(&os, 14, 4));	/* num_explicit_precode_lens: 14 + 4 */

	/*
	 * Precode codeword lengths: order is
	 * [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
	 */
	for (i = 0; i < 2; i++)		/* presym_{16,17}: len=0 */
		pu_assert("", put_bits(&os, 0, 3));
	pu_assert("", put_bits(&os, 1, 3));	/* presym_18: len=1 */
	pu_assert("", put_bits(&os, 2, 3));	/* presym_0: len=2 */
	for (i = 0; i < 13; i++)	/* presym_{8,...,14}: len=0 */
		pu_assert("", put_bits(&os, 0, 3));
	pu_assert("", put_bits(&os, 2, 3));	/* presym_1: len=2 */

	/* Litlen and offset codeword lengths */
	for (i = 0; i < 2; i++) {
		pu_assert("", put_bits(&os, 0, 1) &&	/* presym_18, 128 zeroes */
		       put_bits(&os, 117, 7));
	}
	pu_assert("", put_bits(&os, 0x3, 2));	/* presym_1 */
	pu_assert("", put_bits(&os, 0x1, 2));	/* presym_0 */

	/* Litlen symbols */
	pu_assert("", put_bits(&os, 0x0, 1));	/* litlensym_256 (end-of-block) */

	pu_assert("", flush_bits(&os));

	return verify_decompression(in, os.next - in, out, sizeof(out), in, 0);
}

/* Test that an offset code containing only one symbol is accepted. */
PU_TEST(test_singleton_offset_code)
{
	static const uint8_t expected_out[] = { 255, 255, 255, 255 };
	uint8_t in[128];
	uint8_t out[128];
	struct output_bitstream os = { .next = in, .end = in + sizeof(in) };
	int i;

	pu_assert("", put_bits(&os, 1, 1));	/* BFINAL: 1 */
	pu_assert("", put_bits(&os, 2, 2));	/* BTYPE: DYNAMIC_HUFFMAN */

	/*
	 * Litlen code:
	 *	litlensym_255			freq=1 len=1 codeword= 0
	 *	litlensym_256 (end-of-block)	freq=1 len=2 codeword=01
	 *	litlensym_257 (len 3)		freq=1 len=2 codeword=11
	 * Offset code:
	 *	offsetsym_0 (offset 0)		freq=1 len=1 codeword=0
	 *
	 * Litlen and offset codeword lengths:
	 *	[0..254] = 0	presym_{18,18}
	 *	[255]	 = 1	presym_1
	 *	[256]	 = 1	presym_2
	 *	[257]	 = 1	presym_2
	 *	[258]	 = 1	presym_1
	 *
	 * Precode:
	 *	presym_1	freq=2 len=2 codeword=01
	 *	presym_2	freq=2 len=2 codeword=11
	 *	presym_18	freq=2 len=1 codeword= 0
	 */

	pu_assert("", put_bits(&os, 1, 5));	/* num_litlen_syms: 1 + 257 */
	pu_assert("", put_bits(&os, 0, 5));	/* num_offset_syms: 0 + 1 */
	pu_assert("", put_bits(&os, 14, 4));	/* num_explicit_precode_lens: 14 + 4 */
	/*
	 * Precode codeword lengths: order is
	 * [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
	 */
	for (i = 0; i < 2; i++)		/* presym_{16,17}: len=0 */
		pu_assert("", put_bits(&os, 0, 3));
	pu_assert("", put_bits(&os, 1, 3));	/* presym_18: len=1 */
	for (i = 0; i < 12; i++)	/* presym_{0,...,13}: len=0 */
		pu_assert("", put_bits(&os, 0, 3));
	pu_assert("", put_bits(&os, 2, 3));	/* presym_2: len=2 */
	pu_assert("", put_bits(&os, 0, 3));	/* presym_14: len=0 */
	pu_assert("", put_bits(&os, 2, 3));	/* presym_1: len=2 */

	/* Litlen and offset codeword lengths */
	pu_assert("", put_bits(&os, 0x0, 1) &&	/* presym_18, 128 zeroes */
	       put_bits(&os, 117, 7));
	pu_assert("", put_bits(&os, 0x0, 1) &&	/* presym_18, 127 zeroes */
	       put_bits(&os, 116, 7));
	pu_assert("", put_bits(&os, 0x1, 2));	/* presym_1 */
	pu_assert("", put_bits(&os, 0x3, 2));	/* presym_2 */
	pu_assert("", put_bits(&os, 0x3, 2));	/* presym_2 */
	pu_assert("", put_bits(&os, 0x1, 2));	/* presym_1 */

	/* Literal */
	pu_assert("", put_bits(&os, 0x0, 1));	/* litlensym_255 */

	/* Match */
	pu_assert("", put_bits(&os, 0x3, 2));	/* litlensym_257 */
	pu_assert("", put_bits(&os, 0x0, 1));	/* offsetsym_0 */

	/* End of block */
	pu_assert("", put_bits(&os, 0x1, 2));	/* litlensym_256 */

	pu_assert("", flush_bits(&os));

	return verify_decompression(in, os.next - in, out, sizeof(out),
			     expected_out, sizeof(expected_out));
}

/* Test that an offset code containing only one symbol is accepted, even if that
 * symbol is not symbol 0.  The codeword should be '0' in either case. */
PU_TEST(test_singleton_offset_code_notsymzero)
{
	static const uint8_t expected_out[] = { 254, 255, 254, 255, 254 };
	uint8_t in[128];
	uint8_t out[128];
	struct output_bitstream os = { .next = in, .end = in + sizeof(in) };
	int i;

	pu_assert("", put_bits(&os, 1, 1));	/* BFINAL: 1 */
	pu_assert("", put_bits(&os, 2, 2));	/* BTYPE: DYNAMIC_HUFFMAN */

	/*
	 * Litlen code:
	 *	litlensym_254			len=2 codeword=00
	 *	litlensym_255			len=2 codeword=10
	 *	litlensym_256 (end-of-block)	len=2 codeword=01
	 *	litlensym_257 (len 3)		len=2 codeword=11
	 * Offset code:
	 *	offsetsym_1 (offset 2)		len=1 codeword=0
	 *
	 * Litlen and offset codeword lengths:
	 *	[0..253] = 0	presym_{18,18}
	 *	[254]	 = 2	presym_2
	 *	[255]	 = 2	presym_2
	 *	[256]	 = 2	presym_2
	 *	[257]	 = 2	presym_2
	 *	[258]	 = 0	presym_0
	 *	[259]	 = 1	presym_1
	 *
	 * Precode:
	 *	presym_0	len=2 codeword=00
	 *	presym_1	len=2 codeword=10
	 *	presym_2	len=2 codeword=01
	 *	presym_18	len=2 codeword=11
	 */

	pu_assert("", put_bits(&os, 1, 5));	/* num_litlen_syms: 1 + 257 */
	pu_assert("", put_bits(&os, 1, 5));	/* num_offset_syms: 1 + 1 */
	pu_assert("", put_bits(&os, 14, 4));	/* num_explicit_precode_lens: 14 + 4 */
	/*
	 * Precode codeword lengths: order is
	 * [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
	 */
	for (i = 0; i < 2; i++)		/* presym_{16,17}: len=0 */
		pu_assert("", put_bits(&os, 0, 3));
	pu_assert("", put_bits(&os, 2, 3));	/* presym_18: len=2 */
	pu_assert("", put_bits(&os, 2, 3));	/* presym_0: len=2 */
	for (i = 0; i < 11; i++)	/* presym_{8,...,13}: len=0 */
		pu_assert("", put_bits(&os, 0, 3));
	pu_assert("", put_bits(&os, 2, 3));	/* presym_2: len=2 */
	pu_assert("", put_bits(&os, 0, 3));	/* presym_14: len=0 */
	pu_assert("", put_bits(&os, 2, 3));	/* presym_1: len=2 */

	/* Litlen and offset codeword lengths */
	pu_assert("", put_bits(&os, 0x3, 2) &&	/* presym_18, 128 zeroes */
	       put_bits(&os, 117, 7));
	pu_assert("", put_bits(&os, 0x3, 2) &&	/* presym_18, 126 zeroes */
	       put_bits(&os, 115, 7));
	pu_assert("", put_bits(&os, 0x1, 2));	/* presym_2 */
	pu_assert("", put_bits(&os, 0x1, 2));	/* presym_2 */
	pu_assert("", put_bits(&os, 0x1, 2));	/* presym_2 */
	pu_assert("", put_bits(&os, 0x1, 2));	/* presym_2 */
	pu_assert("", put_bits(&os, 0x0, 2));	/* presym_0 */
	pu_assert("", put_bits(&os, 0x2, 2));	/* presym_1 */

	/* Literals */
	pu_assert("", put_bits(&os, 0x0, 2));	/* litlensym_254 */
	pu_assert("", put_bits(&os, 0x2, 2));	/* litlensym_255 */

	/* Match */
	pu_assert("", put_bits(&os, 0x3, 2));	/* litlensym_257 */
	pu_assert("", put_bits(&os, 0x0, 1));	/* offsetsym_1 */

	/* End of block */
	pu_assert("", put_bits(&os, 0x1, 2));	/* litlensym_256 */

	pu_assert("", flush_bits(&os));

	return verify_decompression(in, os.next - in, out, sizeof(out),
			     expected_out, sizeof(expected_out));
}
