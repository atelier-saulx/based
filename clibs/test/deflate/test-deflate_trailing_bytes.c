/*
 * test_trailing_bytes.c
 *
 * Test that decompression correctly stops at the end of the first DEFLATE,
 * zlib, or gzip stream, and doesn't process any additional trailing bytes.
 */

#include <inttypes.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <zlib.h>
#include "libdeflate.h"
#include "util.h"

static const struct {
	size_t (*compress)(struct libdeflate_compressor *compressor,
			   const void *in, size_t in_nbytes,
			   void *out, size_t out_nbytes_avail);
	enum libdeflate_result (*decompress)(
			struct libdeflate_decompressor *decompressor,
			const void *in, size_t in_nbytes,
			void *out, size_t out_nbytes_avail,
			size_t *actual_out_nbytes_ret);
	enum libdeflate_result (*decompress_ex)(
			struct libdeflate_decompressor *decompressor,
			const void *in, size_t in_nbytes,
			void *out, size_t out_nbytes_avail,
			size_t *actual_in_nbytes_ret,
			size_t *actual_out_nbytes_ret);
} codecs[] = {
	{
		.compress = libdeflate_compress,
		.decompress = libdeflate_decompress,
		.decompress_ex = libdeflate_decompress_ex,
	}
};

PU_TEST(trailing_bytes)
{
	const size_t original_nbytes = 32768;
	const size_t compressed_nbytes_total = 32768;
	/*
	 * Don't use the full buffer for compressed data, because we want to
	 * test whether decompression can deal with additional trailing bytes.
	 *
	 * Note: we can't use a guarded buffer (i.e. a buffer where the byte
	 * after compressed_nbytes is unmapped) because the decompressor may
	 * read a few bytes beyond the end of the stream (but ultimately not
	 * actually use those bytes) as long as they are within the buffer.
	 */
	const size_t compressed_nbytes_avail = 30000;
	size_t i;
	uint8_t *original;
	uint8_t *compressed;
	uint8_t *decompressed;
	struct libdeflate_compressor *c;
	struct libdeflate_decompressor *d;
	size_t compressed_nbytes;
	enum libdeflate_result res;
	size_t actual_compressed_nbytes;
	size_t actual_decompressed_nbytes;

	pu_assert("", compressed_nbytes_avail < compressed_nbytes_total);

	/* Prepare some dummy data to compress */
	original = malloc(original_nbytes);
	pu_assert("", original != NULL);
	for (i = 0; i < original_nbytes; i++)
		original[i] = (i % 123) + (i % 1023);

	compressed = malloc(compressed_nbytes_total);
	pu_assert("", compressed != NULL);
	memset(compressed, 0, compressed_nbytes_total);

	decompressed = malloc(original_nbytes);
	pu_assert("", decompressed != NULL);

	c = libdeflate_alloc_compressor(6);
	pu_assert("", c != NULL);

	d = libdeflate_alloc_decompressor();
	pu_assert("", d != NULL);

	for (i = 0; i < num_elem(codecs); i++) {
		compressed_nbytes = codecs[i].compress(c, original,
						       original_nbytes,
						       compressed,
						       compressed_nbytes_avail);
		pu_assert("", compressed_nbytes > 0);
		pu_assert("", compressed_nbytes <= compressed_nbytes_avail);

		/* Test decompress() of stream that fills the whole buffer */
		actual_decompressed_nbytes = 0;
		memset(decompressed, 0, original_nbytes);
		res = codecs[i].decompress(d, compressed, compressed_nbytes,
					   decompressed, original_nbytes,
					   &actual_decompressed_nbytes);
		pu_assert("", res == LIBDEFLATE_SUCCESS);
		pu_assert("", actual_decompressed_nbytes == original_nbytes);
		pu_assert("", memcmp(decompressed, original, original_nbytes) == 0);

		/* Test decompress_ex() of stream that fills the whole buffer */
		actual_compressed_nbytes = actual_decompressed_nbytes = 0;
		memset(decompressed, 0, original_nbytes);
		res = codecs[i].decompress_ex(d, compressed, compressed_nbytes,
					      decompressed, original_nbytes,
					      &actual_compressed_nbytes,
					      &actual_decompressed_nbytes);
		pu_assert("", res == LIBDEFLATE_SUCCESS);
		pu_assert("", actual_compressed_nbytes == compressed_nbytes);
		pu_assert("", actual_decompressed_nbytes == original_nbytes);
		pu_assert("", memcmp(decompressed, original, original_nbytes) == 0);

		/* Test decompress() of stream with trailing bytes */
		actual_decompressed_nbytes = 0;
		memset(decompressed, 0, original_nbytes);
		res = codecs[i].decompress(d, compressed,
					   compressed_nbytes_total,
					   decompressed, original_nbytes,
					   &actual_decompressed_nbytes);
		pu_assert("", res == LIBDEFLATE_SUCCESS);
		pu_assert("", actual_decompressed_nbytes == original_nbytes);
		pu_assert("", memcmp(decompressed, original, original_nbytes) == 0);

		/* Test decompress_ex() of stream with trailing bytes */
		actual_compressed_nbytes = actual_decompressed_nbytes = 0;
		memset(decompressed, 0, original_nbytes);
		res = codecs[i].decompress_ex(d, compressed,
					      compressed_nbytes_total,
					      decompressed, original_nbytes,
					      &actual_compressed_nbytes,
					      &actual_decompressed_nbytes);
		pu_assert("", res == LIBDEFLATE_SUCCESS);
		pu_assert("", actual_compressed_nbytes == compressed_nbytes);
		pu_assert("", actual_decompressed_nbytes == original_nbytes);
		pu_assert("", memcmp(decompressed, original, original_nbytes) == 0);
	}

	free(original);
	free(compressed);
	free(decompressed);
	libdeflate_free_compressor(c);
	libdeflate_free_decompressor(d);

	return NULL;
}
