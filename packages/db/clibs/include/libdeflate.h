/*
 * libdeflate.h - public header for libdeflate
 * Copyright (c) 2024 SAULX
 * Copyright 2023 housisong
 * Copyright 2016 Eric Biggers
 *
 * SPDX-License-Identifier: MIT
 */

#ifndef LIBDEFLATE_H
#define LIBDEFLATE_H

#define LIBDEFLATE_VERSION_MAJOR	2
#define LIBDEFLATE_VERSION_MINOR	0
#define LIBDEFLATE_VERSION_STRING	"2.0"

#include <stddef.h>
#include <stdint.h>

#ifndef LIBDEFLATEEXPORT
#ifdef BUILDING_LIBDEFLATE
#define LIBDEFLATEEXPORT __attribute__((visibility("default")))
#else
#define LIBDEFLATEEXPORT
#endif
#endif

/* ========================================================================== */
/*                             Compression                                    */
/* ========================================================================== */

struct libdeflate_compressor;

/**
 * libdeflate_alloc_compressor() allocates a new compressor.
 * 'compression_level' is the compression level on a zlib-like scale but with a
 * higher maximum value (1 = fastest, 6 = medium/default, 9 = slow, 12 = slowest).
 * Level 0 is also supported and means "no compression", specifically "create a
 * valid stream, but only emit uncompressed blocks" (this will expand the data
 * slightly).
 *
 * The return value is a pointer to the new compressor, or NULL if out of memory
 * or if the compression level is invalid (i.e. outside the range [0, 12]).
 *
 * Note: for compression, the sliding window size is defined at compilation time
 * to 32768, the largest size permissible in the DEFLATE format.  It cannot be
 * changed at runtime.
 *
 * A single compressor is not safe to use by multiple threads concurrently.
 * However, different threads may use different compressors concurrently.
 */
LIBDEFLATEEXPORT struct libdeflate_compressor *
libdeflate_alloc_compressor(int compression_level);

LIBDEFLATEEXPORT struct libdeflate_compressor *
libdeflate_alloc_compressor2(int compression_level, const void *shared_dict);

/**
 * libdeflate_compress() performs raw DEFLATE compression on a buffer of
 * data.  The function attempts to compress 'in_nbytes' bytes of data located at
 * 'in' and write the results to 'out', which has space for 'out_nbytes_avail'
 * bytes.  The return value is the compressed size in bytes, or 0 if the data
 * could not be compressed to 'out_nbytes_avail' bytes or fewer.
 */
LIBDEFLATEEXPORT size_t
libdeflate_compress(struct libdeflate_compressor *compressor,
			    const void *in, size_t in_nbytes,
			    void *out, size_t out_nbytes_avail);

/**
 * libdeflate_compress_bound() returns a worst-case upper bound on the
 * number of bytes of compressed data that may be produced by compressing any
 * buffer of length less than or equal to 'in_nbytes' using
 * libdeflate_compress() with the specified compressor.  Mathematically,
 * this bound will necessarily be a number greater than or equal to 'in_nbytes'.
 * It may be an overestimate of the true upper bound.  The return value is
 * guaranteed to be the same for all invocations with the same compressor and
 * same 'in_nbytes'.
 *
 * Note that this function is not necessary in many applications.  With
 * block-based compression, it is usually preferable to separately store the
 * uncompressed size of each block and to store any blocks that did not compress
 * to less than their original size uncompressed.  In that scenario, there is no
 * need to know the worst-case compressed size, since the maximum number of
 * bytes of compressed data that may be used would always be one less than the
 * input length.  You can just pass a buffer of that size to
 * libdeflate_compress() and store the data uncompressed if
 * libdeflate_compress() returns 0, indicating that the compressed data
 * did not fit into the provided output buffer.
 */
LIBDEFLATEEXPORT size_t
libdeflate_compress_bound(size_t in_nbytes);

static inline size_t
libdeflate_compress_bound_block(size_t in_block_nbytes)
{
    return libdeflate_compress_bound(in_block_nbytes) + 5;
}

/**
 * libdeflate_free_compressor() frees a compressor that was allocated with
 * libdeflate_alloc_compressor().
 * If a NULL pointer is passed in, no action is taken.
 */
LIBDEFLATEEXPORT void
libdeflate_free_compressor(struct libdeflate_compressor *compressor);

/* ========================================================================== */
/*                             Decompression                                  */
/* ========================================================================== */

struct libdeflate_decompressor;

/**
 * libdeflate_alloc_decompressor() allocates a new decompressor.
 * The return value is a pointer to
 * the new decompressor, or NULL if out of memory.
 *
 * This function takes no parameters, and the returned decompressor is valid for
 * decompressing data that was compressed at any compression level and with any
 * sliding window size.
 *
 * A single decompressor is not safe to use by multiple threads concurrently.
 * However, different threads may use different decompressors concurrently.
 */
LIBDEFLATEEXPORT struct libdeflate_decompressor *
libdeflate_alloc_decompressor(void);

/**
 * Result of a call to libdeflate_decompress().
 */
enum libdeflate_result {
    /**
     * Decompression was successful.
     */
    LIBDEFLATE_SUCCESS = 0,

    /**
     * Decompressed failed because the compressed data was invalid, corrupt,
     * or otherwise unsupported.
     */
    LIBDEFLATE_BAD_DATA = 1,

    /**
     * A NULL 'actual_out_nbytes_ret' was provided, but the data would have
     * decompressed to fewer than 'out_nbytes_avail' bytes.
     */
    LIBDEFLATE_SHORT_OUTPUT = 2,

    /**
     * The data would have decompressed to more than 'out_nbytes_avail'
     * bytes.
     */
    LIBDEFLATE_INSUFFICIENT_SPACE = 3,

    /**
     * More blocks availbled for decompression.
     * Only returned by libdeflate_decompress_block().
     */
    LIBDEFLATE_MORE = 4,
};

/**
 * libdeflate_decompress() decompresses the DEFLATE-compressed stream
 * from the buffer 'in' with compressed size up to 'in_nbytes' bytes.
 * The uncompressed data is written to 'out', a buffer with size 'out_nbytes_avail'
 * bytes.  If decompression succeeds, then 0 (LIBDEFLATE_SUCCESS) is returned.
 * Otherwise, a nonzero result code such as LIBDEFLATE_BAD_DATA is returned.  If
 * a nonzero result code is returned, then the contents of the output buffer are
 * undefined.
 *
 * Decompression stops at the end of the DEFLATE stream (as indicated by the
 * BFINAL flag), even if it is actually shorter than 'in_nbytes' bytes.
 *
 * libdeflate_decompress() can be used in cases where the actual
 * uncompressed size is known (recommended) or unknown (not recommended):
 *
 *   - If the actual uncompressed size is known, then pass the actual
 *     uncompressed size as 'out_nbytes_avail' and pass NULL for
 *     'actual_out_nbytes_ret'.  This makes libdeflate_decompress() fail
 *     with LIBDEFLATE_SHORT_OUTPUT if the data decompressed to fewer than the
 *     specified number of bytes.
 *
 *   - If the actual uncompressed size is unknown, then provide a non-NULL
 *     'actual_out_nbytes_ret' and provide a buffer with some size
 *     'out_nbytes_avail' that you think is large enough to hold all the
 *     uncompressed data.  In this case, if the data decompresses to less than
 *     or equal to 'out_nbytes_avail' bytes, then
 *     libdeflate_decompress() will write the actual uncompressed size
 *     to *actual_out_nbytes_ret and return 0 (LIBDEFLATE_SUCCESS).  Otherwise,
 *     it will return LIBDEFLATE_INSUFFICIENT_SPACE if the provided buffer was
 *     not large enough but no other problems were encountered, or another
 *     nonzero result code if decompression failed for another reason.
 */
LIBDEFLATEEXPORT enum libdeflate_result
libdeflate_decompress(struct libdeflate_decompressor *decompressor,
			      const void *in, size_t in_nbytes,
			      void *out, size_t out_nbytes_avail,
			      size_t *actual_out_nbytes_ret);

/**
 * Like libdeflate_decompress(), but adds the 'actual_in_nbytes_ret'
 * argument.
 * If decompression succeeds and 'actual_in_nbytes_ret' is not NULL,
 * then the actual compressed size of the DEFLATE stream (aligned to the next
 * byte boundary) is written to *actual_in_nbytes_ret.
 */
LIBDEFLATEEXPORT enum libdeflate_result
libdeflate_decompress_ex(struct libdeflate_decompressor *decompressor,
				 const void *in, size_t in_nbytes,
				 void *out, size_t out_nbytes_avail,
				 size_t *actual_in_nbytes_ret,
				 size_t *actual_out_nbytes_ret);

/**
 * ctrl libdeflate_decompress_block() stop condition
 */
enum libdeflate_decompress_stop_by {
    LIBDEFLATE_STOP_BY_FINAL_BLOCK                = 0,
    LIBDEFLATE_STOP_BY_ANY_BLOCK                  = 1,
    LIBDEFLATE_STOP_BY_ANY_BLOCK_AND_FULL_INPUT   = 2,
    LIBDEFLATE_STOP_BY_ANY_BLOCK_AND_FULL_OUTPUT  = 3,
    LIBDEFLATE_STOP_BY_ANY_BLOCK_AND_FULL_OUTPUT_AND_IN_BYTE_ALIGN = 4,
};

/**
 * Decompress a DEFLATE block.
 * Large stream data can be decompress by calling libdeflate_decompress_block()
 * multiple times.  Each time call this function, 'out_block_with_in_dict' have
 * 'in_dict_nbytes' repeat of the last called's tail outputted uncompressed data
 * as dictionary data, and 'out_block_nbytes' new uncompressed data want be
 * decompressed;
 * The dictionary data size in_dict_nbytes<=32k, if it is greater than 32k, the extra
 * part of the previous part of the dictionary data is invalid.
 * libdeflate_compress_bound_block(out_block_nbytes) can get the upper limit
 * of 'in_part' required space 'in_part_nbytes_bound'.
 * 'is_final_block_ret' can be NULL.
 *
 * WARNING: This function must decompressed one full DEFLATE block before stop;
 * so 'in_part_nbytes_bound' must possess a block end flag, and "out_block_nbytes"
 * must be able to store uncompressed data of this block decompressed;
 * This feature is not compatible with the DEFLATE stream decoding standard,
 * this function can't support a single DEFLATE block that may have any length.
 */
LIBDEFLATEEXPORT enum libdeflate_result
libdeflate_decompress_block(struct libdeflate_decompressor *decompressor,
                 const void *in_part, size_t in_part_nbytes_bound,
                 void *out_block_with_in_dict, size_t in_dict_nbytes, size_t out_block_nbytes,
                 size_t *actual_in_nbytes_ret, size_t *actual_out_nbytes_ret,
                 enum libdeflate_decompress_stop_by stop_type);

/**
 * Clear the block decompressor save state.
 * Clear the state saved between calls libdeflate_decompress_block();
 * if you know the next block does not depend on the inputted data of the previous
 * block, you can call this function reset 'decompressor';
 * Note: if next block depend on the inputted data of the previous block, reset will
 * cause libdeflate_decompress_block() to fail.
 */
LIBDEFLATEEXPORT void
libdeflate_decompress_block_reset(struct libdeflate_decompressor *decompressor);

struct libdeflate_block_state {
    size_t cur_block_size;
    size_t data_cur;
    size_t out_cur;
    size_t data_buf_size;
    uint8_t *data_buf;
};

/**
 * Initialize a block state struct.
 * struct libdeflate_block_state is used with libdeflate_decompress_stream().
 */
LIBDEFLATEEXPORT struct libdeflate_block_state
libdeflate_block_state_init(size_t max_block_size);

/**
 * Increase the buffer size in a struct libdeflate_block_state.
 * This function should be called if libdeflate_decompress_stream() returns with
 * LIBDEFLATE_INSUFFICIENT_SPACE. Decompression should be retried only if this
 * function returns `true`.
 * @return value `true` if a larger buffer was allocated;
 *               `false` if the buffer wasn't changed.
 */
LIBDEFLATEEXPORT bool
libdeflate_block_state_growbuf(struct libdeflate_block_state *state);

/**
 * Deinitialize struct libdeflate_block_state.
 * This frees data_buf.
 */
LIBDEFLATEEXPORT void
libdeflate_block_state_deinit(struct libdeflate_block_state *state);

typedef int (*libdeflate_decompress_stream_cb_t)(void * ctx, const uint8_t * buf, size_t dict_len, size_t data_len);

/**
 * Decompress deflated string in_buf block by block.
 * Call libdeflate_block_state_init() before and libdeflate_block_state_deinit() after.
 * @param cb is a callback that will be called for each decompressed block.
 *           Decompression is interrupted if the callback returns a non-zero value.
 * @param result returns the non-zero return value of cb.
 */
LIBDEFLATEEXPORT enum libdeflate_result
libdeflate_decompress_stream(
        struct libdeflate_decompressor *decompressor,
        struct libdeflate_block_state *state,
        const char *in_buf, size_t in_len,
        libdeflate_decompress_stream_cb_t cb, void *ctx,
        int *result);

/**
 * Free a decompressor.
 * libdeflate_free_decompressor() frees a decompressor that was allocated with
 * libdeflate_alloc_decompressor().  If a NULL pointer is passed in, no action
 * is taken.
 */
LIBDEFLATEEXPORT void
libdeflate_free_decompressor(struct libdeflate_decompressor *decompressor);

#endif /* LIBDEFLATE_H */
