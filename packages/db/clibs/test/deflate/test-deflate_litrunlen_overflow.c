/*
 * test_litrunlen_overflow.c
 *
 * Regression test for commit f2f0df727444 ("deflate_compress: fix corruption
 * with long literal run").  Try to compress a file longer than 65535 bytes
 * where no 2-byte sequence (3 would be sufficient) is repeated <= 32768 bytes
 * apart, and the distribution of bytes remains constant throughout, and yet not
 * all bytes are used so the data is still slightly compressible.  There will be
 * no matches in this data, but the compressor should still output a compressed
 * block, and this block should contain more than 65535 consecutive literals,
 * which triggered the bug.
 *
 * Note: on random data, this situation is extremely unlikely if the compressor
 * uses all matches it finds, since random data will on average have a 3-byte
 * match every (256**3)/32768 = 512 bytes.
 */

#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <zlib.h>
#include "libdeflate.h"
#include "util.h"

PU_TEST(litrunlen_overflow)
{
	const int data_size = 2 * 250 * 251;
	uint8_t *orig_data, *compressed_data, *decompressed_data;
	int i, stride, multiple, j = 0;
	struct libdeflate_decompressor *d;
	static const int levels[] = { 3, 6, 12 };

	orig_data = malloc(data_size);
	compressed_data = malloc(data_size);
	decompressed_data = malloc(data_size);

	for (i = 0; i < 2; i++) {
		for (stride = 1; stride < 251; stride++) {
			for (multiple = 0; multiple < 251; multiple++)
				orig_data[j++] = (stride * multiple) % 251;
		}
	}
	pu_assert("", j == data_size);

	d = libdeflate_alloc_decompressor();
	pu_assert("", d != NULL);

	for (i = 0; i < num_elem(levels); i++) {
		struct libdeflate_compressor *c;
		size_t csize;
		enum libdeflate_result res;

		c = libdeflate_alloc_compressor(levels[i]);
		pu_assert("", c != NULL);

		csize = libdeflate_compress(c, orig_data, data_size,
						    compressed_data, data_size);
		pu_assert("", csize > 0 && csize < data_size);

		res = libdeflate_decompress(d, compressed_data, csize,
						    decompressed_data,
						    data_size, NULL);
		pu_assert("", res == LIBDEFLATE_SUCCESS);
		pu_assert("", memcmp(orig_data, decompressed_data, data_size) == 0);

		libdeflate_free_compressor(c);
	}

	libdeflate_free_decompressor(d);
	free(orig_data);
	free(compressed_data);
	free(decompressed_data);
	return NULL;
}
