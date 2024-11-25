#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../../../include/libdeflate.h"

#define             kDictSize    (1 << 15)  //MATCHFINDER_WINDOW_SIZE
static const size_t kMaxDeflateBlockSize_min = 1024 * 4;
static const size_t kMaxDeflateBlockSize_max = ((~(size_t)0) - kDictSize) / 4;
static const size_t kMaxDeflateBlockSize = (size_t)1024 * 1024 * 8;

static size_t _dictSize_avail(uint64_t uncompressed_pos)
{
    return (uncompressed_pos < kDictSize) ? (size_t)uncompressed_pos : kDictSize;
}

static size_t _limitMaxDefBSize(size_t maxDeflateBlockSize)
{
    if (maxDeflateBlockSize < kMaxDeflateBlockSize_min) return kMaxDeflateBlockSize_min;
    if (maxDeflateBlockSize > kMaxDeflateBlockSize_max) return kMaxDeflateBlockSize_max;
    return maxDeflateBlockSize;
}

static void fn(struct libdeflate_decompressor *d, const char *in_buf, size_t in_len)
{
	uint8_t *data_buf;
	uint64_t out_cur = 0;
	const size_t curBlockSize = _limitMaxDefBSize(kMaxDeflateBlockSize);
	const size_t data_buf_size = 2 * curBlockSize + kDictSize;
	size_t data_cur = kDictSize;
    size_t code_buf_size = 2 * curBlockSize;
	size_t in_cur = 0;
	size_t actual_in_nbytes_ret;
    bool final_block = false;
	int ret;

    data_buf = malloc(data_buf_size + code_buf_size);

	do {
		size_t actual_out_nbytes_ret;
		size_t dict_size = _dictSize_avail(out_cur + (data_cur - kDictSize));

		ret = libdeflate_decompress_block(d, in_buf + in_cur, in_len - in_cur,
				data_buf + data_cur - dict_size, dict_size, data_buf_size - data_cur,
				&actual_in_nbytes_ret, &actual_out_nbytes_ret,
				LIBDEFLATE_STOP_BY_ANY_BLOCK);
        if (ret == LIBDEFLATE_MORE) {
            final_block = false;
        } else if (ret != LIBDEFLATE_SUCCESS) {
            fprintf(stderr, "Failed: %d\n", ret);
            exit(1);
        } else {
            final_block = true;
        }

		in_cur += actual_in_nbytes_ret;
		data_cur += actual_out_nbytes_ret;

		if (final_block || (data_cur > curBlockSize + kDictSize)) {
            printf("%.*s", (int)(data_cur - kDictSize), data_buf + kDictSize);

			out_cur += data_cur - kDictSize;
			dict_size = _dictSize_avail(out_cur);
			memmove(data_buf + kDictSize - dict_size, data_buf + data_cur - dict_size, dict_size); /* dict data for next block */
			data_cur = kDictSize;
		}
	} while (!final_block);

    free(data_buf);
}

static char *read_input(size_t *len)
{
#define BUF_SIZE 1024
    char buffer[BUF_SIZE];
    size_t content_len = 0;
    char *content = malloc(BUF_SIZE);

    do {
        size_t bytes_read = fread(buffer, 1, BUF_SIZE, stdin);
        if (bytes_read) {
            size_t new_len = content_len + bytes_read;

            content = realloc(content, new_len);
            memcpy(content + content_len, buffer, bytes_read);
            content_len = new_len;
        }

        if (ferror(stdin)) {
            free(content);
            perror("Error reading from stdin.");
            exit(2);
        }
    } while (!feof(stdin));

    *len = content_len;
    return content;
}

int main(void)
{
    size_t len;
    char *input = read_input(&len);
    struct libdeflate_decompressor *d = libdeflate_alloc_decompressor();

    fn(d, input, len);
}
