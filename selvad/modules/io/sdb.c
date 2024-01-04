/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include "jemalloc.h"
#include "sha3iuf/sha3.h"
#include "libdeflate.h"
#include "endian.h"
#include "util/selva_string.h"
#include "selva_error.h"
#include "selva_log.h"
#include "selva_io.h"
#include "sdb.h"

#define SDB_VERSION 1
#define SAVE_FLAGS_MASK (SELVA_IO_FLAGS_COMPRESSED)
#define ZBLOCK_BUF_SIZE (1024 * 1024)

/**
 * Total bytes used by the header and footer.
 */
#define HDR_FTR_SIZE \
    (sizeof(magic_start) + SELVA_DB_VERSION_SIZE + SELVA_DB_VERSION_SIZE + sizeof(uint32_t) + sizeof(uint32_t) + \
     sizeof(magic_end) + SELVA_IO_HASH_SIZE)

struct selva_io_zbuf {
    size_t block_buf_i; /*!< Index into block_buf. */
    size_t compressed_buf_size; /*!< Size of compressed_buf. */
    char block_buf[ZBLOCK_BUF_SIZE]; /*!< Buffer for current RW block. */
    char compressed_buf[] __counted_by(compressed_buf_size); /*!< Buffer for compressed block_buf. */
};

extern const char * const selva_db_version;
static const char magic_start[] = { 'S', 'E', 'L', 'V', 'A', '\0', '\0', '\0' };
static const char magic_end[]   = { '\0', '\0', '\0', 'A', 'V', 'L', 'E', 'S' };

/**
 * Selva module version tracking.
 * This is used to track the Selva module version used to create and modify the
 * hierarchy that was serialized and later deserialized.
 */
static struct SelvaDbVersionInfo selva_db_version_info;

void selva_io_get_ver(struct SelvaDbVersionInfo *nfo)
{
    memcpy(nfo, &selva_db_version_info, sizeof(*nfo));
}

static void file_raw_write(struct selva_io *io, const void *p, size_t size)
{
    (void)fwrite(p, sizeof(uint8_t), size, io->file_io.file);
}

static void string_raw_write(struct selva_io *io, const void *p, size_t size)
{
    io->string_io.err = selva_string_append(io->string_io.data, p, size);
}

static int file_raw_read(struct selva_io *io, void *buf, size_t rd)
{
    return (fread(buf, sizeof(uint8_t), rd, io->file_io.file) != rd) ? SELVA_EIO : 0;
}

static int string_raw_read(struct selva_io *io, void *buf, size_t rd)
{
    const char *data;
    size_t data_len;
    size_t offset = io->string_io.offset;

    data = selva_string_to_str(io->string_io.data, &data_len);

    if (offset + rd > data_len) {
        return SELVA_EINVAL;
    }

    memcpy(buf, data + offset, rd);
    io->string_io.offset = offset + rd;
    return 0;
}

static int file_sdb_zwriteout(struct selva_io *io)
{
    struct selva_io_zbuf *zbuf = io->zbuf;
    size_t out_nbytes;

    assert(zbuf->block_buf_i == ZBLOCK_BUF_SIZE);

    out_nbytes = libdeflate_deflate_compress(io->compressor, zbuf->block_buf, ZBLOCK_BUF_SIZE, zbuf->compressed_buf, zbuf->compressed_buf_size);
    if (unlikely(out_nbytes == 0)) {
        /*
         * This shouldn't happen as the buffer is (should be) always big enough.
         * Therefore, even if the data expands slightly we can just accept it
         * like that. This simplifies the process slightly as we can expect
         * every block of data to be compressed and avoid adding more metadata
         * and hopefully still actually save some space.
         */
        SELVA_LOG(SELVA_LOGL_CRIT, "Failed to compress an SDB block");
        abort();
    }


    if (fwrite(zbuf->compressed_buf, sizeof(uint8_t), out_nbytes, io->file_io.file) != out_nbytes) {
        return SELVA_EIO;
    }
    zbuf->block_buf_i = 0;

    return 0;
}

static int file_sdb_flush_block_buf(struct selva_io *io)
{
    struct selva_io_zbuf *zbuf = io->zbuf;

    assert(io->flags & _SELVA_IO_FLAGS_EN_COMPRESS);

    if (zbuf->block_buf_i > 0) {
        size_t remain = ZBLOCK_BUF_SIZE - zbuf->block_buf_i;

        /* pad with zeroes */
        memset(zbuf->block_buf + zbuf->block_buf_i, 0, remain);
        zbuf->block_buf_i += remain;

        return file_sdb_zwriteout(io);
    }
    return 0;
}

static int file_sdb_zreadin(struct selva_io *io)
{
    struct selva_io_zbuf *zbuf = io->zbuf;
    const size_t fread_nbytes = min(zbuf->compressed_buf_size, io->file_io.file_remain);
    size_t in_nbytes, in_nbytes_act;
    enum libdeflate_result res;

    assert(zbuf->block_buf_i == ZBLOCK_BUF_SIZE);

    in_nbytes = fread(zbuf->compressed_buf, sizeof(uint8_t), fread_nbytes, io->file_io.file);
    if (in_nbytes != fread_nbytes && !feof(io->file_io.file)) {
        return SELVA_EIO;
    }

    /* Just to be sure that there is never any garbage left. */
    memset(zbuf->compressed_buf + in_nbytes, 0, zbuf->compressed_buf_size - in_nbytes);

    res = libdeflate_deflate_decompress_ex(io->decompressor, zbuf->compressed_buf, in_nbytes, zbuf->block_buf, ZBLOCK_BUF_SIZE, &in_nbytes_act, NULL);
    if (res) {
        return SELVA_EINVAL;
    }

    io->file_io.file_remain -= in_nbytes_act;
    fseek(io->file_io.file, -(long)(in_nbytes - in_nbytes_act), SEEK_CUR);
    zbuf->block_buf_i = 0;

    return 0;
}

static size_t file_sdb_write(const void * restrict ptr, size_t size, size_t count, struct selva_io *restrict io)
{
    struct selva_io_zbuf *zbuf = io->zbuf;

    sha3_Update(&io->hash_c, ptr, count * size);

    if (io->flags & _SELVA_IO_FLAGS_EN_COMPRESS) {
        size_t left = size * count;
        const char *p = ptr;

        while (left > 0) {
            size_t bytes_to_copy = min(left, ZBLOCK_BUF_SIZE - zbuf->block_buf_i);

            assert(zbuf->block_buf_i < ZBLOCK_BUF_SIZE && bytes_to_copy > 0);

            memcpy(zbuf->block_buf + zbuf->block_buf_i, p, bytes_to_copy);
            p += bytes_to_copy;
            left -= bytes_to_copy;
            zbuf->block_buf_i += bytes_to_copy;

            if (zbuf->block_buf_i >= ZBLOCK_BUF_SIZE) {
                if (file_sdb_zwriteout(io)) {
                    return (size * count) - left;
                }
            }
        }

        return count;
    } else {
        return fwrite(ptr, size, count, io->file_io.file);
    }
}

static size_t file_sdb_read(void * restrict ptr, size_t size, size_t count, struct selva_io *restrict io)
{
    struct selva_io_zbuf *zbuf = io->zbuf;
    size_t r;

    if (io->flags & _SELVA_IO_FLAGS_EN_COMPRESS) {
        const size_t total_size = size * count;
        r = 0;

        while (r < total_size) {
            size_t bytes_to_copy;

            if (zbuf->block_buf_i >= ZBLOCK_BUF_SIZE) {
                int err;

                err = file_sdb_zreadin(io);
                if (err) {
                    goto out;
                }
            }

            bytes_to_copy = min(total_size - r, ZBLOCK_BUF_SIZE - zbuf->block_buf_i);
            memcpy((uint8_t *)ptr + r, zbuf->block_buf + zbuf->block_buf_i, bytes_to_copy);
            r += bytes_to_copy;
            zbuf->block_buf_i += bytes_to_copy;
        }
out:
        r /= size;
    } else {
        r = fread(ptr, size, count, io->file_io.file);
    }
    sha3_Update(&io->hash_c, ptr, r * size);

    return r;
}

static size_t string_sdb_write(const void * restrict ptr, size_t size, size_t count, struct selva_io * restrict io)
{
    int err;

    sha3_Update(&io->hash_c, ptr, count * size);
    err = selva_string_append(io->string_io.data, ptr, size * count);

    if (err) {
        io->string_io.err = err;
        return 0;
    } else {
        return count;
    }
}

static size_t string_sdb_read(void * restrict ptr, size_t size, size_t count, struct selva_io * restrict io)
{
    const char *data;
    size_t data_len;
    const size_t rd = size * count;

    data = selva_string_to_str(io->string_io.data, &data_len);

    if (io->string_io.offset + rd > data_len) {
        return 0;
    }

    memcpy(ptr, data + io->string_io.offset, rd);
    io->string_io.offset += rd;

    sha3_Update(&io->hash_c, ptr, rd);

    return count;
}

static off_t file_sdb_tell(struct selva_io *io)
{
    return ftello(io->file_io.file);
}

static off_t string_sdb_tell(struct selva_io *io)
{
    return (off_t)io->string_io.offset;
}

static int file_sdb_seek(struct selva_io *io, off_t offset, int whence)
{
    return fseeko(io->file_io.file, offset, whence);
}

static int string_sdb_seek(struct selva_io *io, off_t offset, int whence)
{
    const size_t data_len = selva_string_get_len(io->string_io.data);

    switch (whence) {
    case SEEK_SET:
        /* NOP */
        break;
    case SEEK_CUR:
        offset += io->string_io.offset;
        break;
    case SEEK_END:
        offset = data_len + io->string_io.offset;
        break;
    default:
        return SELVA_EINVAL;
    }

    if ((size_t)offset > data_len) {
        return SELVA_EIO;
    }

    io->string_io.offset = (size_t)offset;
    return 0;
}

static int file_sdb_flush(struct selva_io *io)
{
    return fflush(io->file_io.file);
}

static int string_sdb_flush(struct selva_io *)
{
    return 0;
}

static int file_sdb_error(struct selva_io *restrict io)
{
    if (ferror(io->file_io.file)) {
        return SELVA_EIO;
    }

    return 0;
}

static int string_sdb_error(struct selva_io *restrict io)
{
    return io->string_io.err;
}

static void file_sdb_clearerr(struct selva_io *restrict io)
{
    clearerr(io->file_io.file);
}

static void string_sdb_clearerr(struct selva_io *restrict io)
{
    io->string_io.err = 0;
}

void sdb_init(struct selva_io *io)
{
    sha3_Init256KitTen(&io->hash_c);

    if ((io->flags & SELVA_IO_FLAGS_FILE_IO) &&
        (io->flags & (SELVA_IO_FLAGS_READ | SELVA_IO_FLAGS_COMPRESSED))) {
#if 0
        struct libdeflate_options deflate_opts = {
            .sizeof_options = sizeof(deflate_opts),
            .malloc_func = selva_malloc,
            .free_func = selva_free,
        };
#endif
        struct stat st;

        /* NOTE decomp needs the compressor to determine the worst case buf size. */
        /* TODO Coming in the upcoming version */
#if 0
        io->compressor = libdeflate_alloc_compressor_ex(6, &deflate_opts);
        io->decompressor = libdeflate_alloc_decompressor(&deflate_opts);
#endif
        io->compressor = libdeflate_alloc_compressor(6);
        io->decompressor = libdeflate_alloc_decompressor();

        const size_t compressed_buf_size = libdeflate_deflate_compress_bound(io->compressor, ZBLOCK_BUF_SIZE);
        struct selva_io_zbuf *zbuf = selva_malloc(sizeof(*zbuf) + compressed_buf_size);
        zbuf->compressed_buf_size = compressed_buf_size;
        zbuf->block_buf_i = (io->flags & SELVA_IO_FLAGS_WRITE) ? 0 : ZBLOCK_BUF_SIZE;
        io->zbuf = zbuf;

        /*
         * Find the size of the compressed segment in the SDB file.
         */
        fstat(fileno(io->file_io.file), &st);
        io->file_io.file_remain = (st.st_size >= SELVA_IO_HASH_SIZE) ? st.st_size - HDR_FTR_SIZE : 0;
    }

    if (io->flags & SELVA_IO_FLAGS_FILE_IO) {
        io->raw_write = file_raw_write;
        io->raw_read = file_raw_read;
        io->sdb_write = file_sdb_write;
        io->sdb_read = file_sdb_read;
        io->sdb_tell = file_sdb_tell;
        io->sdb_seek = file_sdb_seek;
        io->sdb_flush = file_sdb_flush;
        io->sdb_error = file_sdb_error;
        io->sdb_clearerr = file_sdb_clearerr;
    } else if (io->flags & SELVA_IO_FLAGS_STRING_IO) {
        io->raw_write = string_raw_write;
        io->raw_read = string_raw_read;
        io->sdb_write = string_sdb_write;
        io->sdb_read = string_sdb_read;
        io->sdb_tell = string_sdb_tell;
        io->sdb_seek = string_sdb_seek;
        io->sdb_flush = string_sdb_flush;
        io->sdb_error = string_sdb_error;
        io->sdb_clearerr = string_sdb_clearerr;

        assert(!(io->flags & SELVA_IO_FLAGS_COMPRESSED));
    }
}

void sdb_deinit(struct selva_io *io)
{
    libdeflate_free_compressor(io->compressor);
    libdeflate_free_decompressor(io->decompressor);
    selva_free(io->zbuf);
}

int sdb_write_header(struct selva_io *io)
{
    const char *created_with;
    const uint32_t save_flags = htole32(io->flags & SAVE_FLAGS_MASK);
    int err;

    if (selva_db_version_info.created_with[0] != '\0') {
        created_with = selva_db_version_info.created_with;
    } else {
        created_with = selva_db_version_info.running;
    }

    io->sdb_write(magic_start, sizeof(char), sizeof(magic_start), io);
    io->sdb_write(created_with, sizeof(char), SELVA_DB_VERSION_SIZE, io);
    io->sdb_write(selva_db_version_info.running, sizeof(char), SELVA_DB_VERSION_SIZE, io); /* updated_with */
    io->sdb_write(&(uint32_t){SDB_VERSION}, sizeof(uint32_t), 1, io);
    io->sdb_write(&save_flags, sizeof(uint32_t), 1, io);
    err = io->sdb_error(io);

    if (io->flags & SELVA_IO_FLAGS_COMPRESSED) {
        io->flags |= _SELVA_IO_FLAGS_EN_COMPRESS;
    }

    return err;
}

int sdb_read_header(struct selva_io *io)
{
    char magic[sizeof(magic_start)];
    uint32_t version;
    uint32_t flags;
    size_t res;

    res = io->sdb_read(magic, sizeof(char), sizeof(magic), io);
    if (res != sizeof(magic) || memcmp(magic, magic_start, sizeof(magic))) {
        return SELVA_EINVAL;
    }

    res = io->sdb_read(selva_db_version_info.created_with, SELVA_DB_VERSION_SIZE, 1, io);
    res += io->sdb_read(selva_db_version_info.updated_with, SELVA_DB_VERSION_SIZE, 1, io);
    res += io->sdb_read(&version, sizeof(version), 1, io);
    res += io->sdb_read(&flags, sizeof(flags), 1, io);
    if (res != 4) {
        return SELVA_EINVAL;
    }

    version = letoh(version);
    if (version != SDB_VERSION) {
        return SELVA_ENOTSUP;
    }

    io->flags |= letoh(flags) & SAVE_FLAGS_MASK;

    if (io->flags & SELVA_IO_FLAGS_COMPRESSED) {
        io->flags |= _SELVA_IO_FLAGS_EN_COMPRESS;
    }

    SELVA_LOG(SELVA_LOGL_INFO,
              "created_with: %.*s updated_with: %.*s",
              SELVA_DB_VERSION_SIZE, selva_db_version_info.created_with,
              SELVA_DB_VERSION_SIZE, selva_db_version_info.updated_with);

    return 0;
}

int sdb_write_footer(struct selva_io *io)
{
    typeof(io->flags) prevz = io->flags & _SELVA_IO_FLAGS_EN_COMPRESS;
    int err = SELVA_EINTYPE;

    if (prevz) {
        err = file_sdb_flush_block_buf(io);
        if (err) {
            return err;
        }
    }

    sha3_Update(&io->hash_c, magic_end, sizeof(magic_end));
    io->raw_write(io, magic_end, sizeof(magic_end));
    io->computed_hash = sha3_Finalize(&io->hash_c);
    io->raw_write(io, (void *)io->computed_hash, SELVA_IO_HASH_SIZE);
    err = io->sdb_error(io);

    return err;
}

int sdb_read_footer(struct selva_io *io)
{
    char magic[sizeof(magic_end)];
    size_t res;
    int err;
    typeof(io->flags) prevz = io->flags & _SELVA_IO_FLAGS_EN_COMPRESS;

    io->flags &= ~_SELVA_IO_FLAGS_EN_COMPRESS;

    res = io->sdb_read(magic, sizeof(char), sizeof(magic), io);
    if (res != sizeof(magic) || memcmp(magic, magic_end, sizeof(magic))) {
        SELVA_LOG(SELVA_LOGL_ERR, "Bad magic: %.2x %.2x %.2x %.2x %.2x %.2x %.2x %.2x",
                  (uint8_t)magic[0], (uint8_t)magic[1],
                  (uint8_t)magic[2], (uint8_t)magic[3],
                  (uint8_t)magic[4], (uint8_t)magic[5],
                  (uint8_t)magic[6], (uint8_t)magic[7]);
        return SELVA_EINVAL;
    }

    io->computed_hash = sha3_Finalize(&io->hash_c);
    err = io->raw_read(io, io->stored_hash, sizeof(io->stored_hash));
    if (err) {
        return err;
    }

    io->flags |= prevz;

    return 0;
}

__constructor static void init(void)
{
    strncpy(selva_db_version_info.running, selva_db_version, sizeof(selva_db_version_info.running));

    SELVA_LOG(SELVA_LOGL_INFO, "Selva db version running: %.*s",
              (int)sizeof(selva_db_version_info.running), selva_db_version_info.running);
}
