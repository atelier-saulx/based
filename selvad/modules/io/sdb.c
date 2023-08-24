/*
 * Copyright (c) 2022-2023 SAULX
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

static int sdb_zwriteout(struct selva_io *io)
{
    size_t out_nbytes;

    assert(io->block_buf_i == ZBLOCK_BUF_SIZE);

    out_nbytes = libdeflate_deflate_compress(io->compressor, io->block_buf, ZBLOCK_BUF_SIZE, io->compressed_buf, io->compressed_buf_size);
    if (fwrite(io->compressed_buf, sizeof(uint8_t), out_nbytes, io->file_io.file) != out_nbytes) {
        return SELVA_EIO;
    }

    io->block_buf_i = 0;

    return 0;
}

static int sdb_flush_block_buf(struct selva_io *io)
{
    assert(io->flags & _SELVA_IO_FLAGS_EN_COMPRESS);

    if (io->block_buf_i > 0) {
        size_t remain = ZBLOCK_BUF_SIZE - io->block_buf_i;

        /* pad with zeroes */
        memset(io->block_buf + io->block_buf_i, 0, remain);
        io->block_buf_i += remain;

        return sdb_zwriteout(io);
    }
    return 0;
}

static int sdb_zreadin(struct selva_io *io)
{
    const size_t fread_nbytes = min(io->compressed_buf_size, io->file_io.file_remain);
    size_t in_nbytes, in_nbytes_act;
    enum libdeflate_result res;

    assert(io->block_buf_i == ZBLOCK_BUF_SIZE);

    in_nbytes = fread(io->compressed_buf, sizeof(uint8_t), fread_nbytes, io->file_io.file);
    if (in_nbytes != fread_nbytes && !feof(io->file_io.file)) {
        return SELVA_EIO;
    }

    /* Just to be sure that there is never any garbage left. */
    memset(io->compressed_buf + in_nbytes, 0, io->compressed_buf_size - in_nbytes);

    res = libdeflate_deflate_decompress_ex(io->decompressor, io->compressed_buf, in_nbytes, io->block_buf, ZBLOCK_BUF_SIZE, &in_nbytes_act, NULL);
    if (res) {
        return SELVA_EINVAL;
    }

    io->file_io.file_remain -= in_nbytes_act;
    fseek(io->file_io.file, -(long)(in_nbytes - in_nbytes_act), SEEK_CUR);
    io->block_buf_i = 0;

    return 0;
}

static size_t sdb_write_file(const void * restrict ptr, size_t size, size_t count, struct selva_io *restrict io)
{
    sha3_Update(&io->hash_c, ptr, count * size);

    if (io->flags & _SELVA_IO_FLAGS_EN_COMPRESS) {
        size_t left = size * count;
        const char *p = ptr;

        while (left > 0) {
            size_t bytes_to_copy = min(left, ZBLOCK_BUF_SIZE - io->block_buf_i);

            assert(io->block_buf_i < ZBLOCK_BUF_SIZE && bytes_to_copy > 0);

            memcpy(io->block_buf + io->block_buf_i, p, bytes_to_copy);
            p += bytes_to_copy;
            left -= bytes_to_copy;
            io->block_buf_i += bytes_to_copy;

            if (io->block_buf_i >= ZBLOCK_BUF_SIZE) {
                if (sdb_zwriteout(io)) {
                    return (size * count) - left;
                }
            }
        }

        return count;
    } else {
        return fwrite(ptr, size, count, io->file_io.file);
    }
}

static size_t sdb_read_file(void * restrict ptr, size_t size, size_t count, struct selva_io *restrict io)
{
    size_t r;

    if (io->flags & _SELVA_IO_FLAGS_EN_COMPRESS) {
        const size_t total_size = size * count;
        r = 0;

        while (r < total_size) {
            size_t bytes_to_copy;

            if (io->block_buf_i >= ZBLOCK_BUF_SIZE) {
                int err;

                err = sdb_zreadin(io);
                if (err) {
                    goto out;
                }
            }

            bytes_to_copy = min(total_size - r, ZBLOCK_BUF_SIZE - io->block_buf_i);
            memcpy((uint8_t *)ptr + r, io->block_buf + io->block_buf_i, bytes_to_copy);
            r += bytes_to_copy;
            io->block_buf_i += bytes_to_copy;
        }
out:
        r /= size;
    } else {
        r = fread(ptr, size, count, io->file_io.file);
    }
    sha3_Update(&io->hash_c, ptr, r * size);

    return r;
}

static void sdb_raw_write(struct selva_io *io, const void *p, size_t size)
{
    if (io->flags & SELVA_IO_FLAGS_FILE_IO) {
        (void)fwrite(p, sizeof(uint8_t), size, io->file_io.file);
    } else if (io->flags & SELVA_IO_FLAGS_STRING_IO) {
        /* RFE Should it always overwrite? */
        io->string_io.err = selva_string_append(io->string_io.data, p, size);
    }
}

static size_t sdb_write_string(const void * restrict ptr, size_t size, size_t count, struct selva_io * restrict io)
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

static size_t sdb_read_string(void * restrict ptr, size_t size, size_t count, struct selva_io * restrict io)
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

    return rd;
}

static off_t sdb_tell_file(struct selva_io *io)
{
    return ftello(io->file_io.file);
}

static off_t sdb_tell_string(struct selva_io *io)
{
    return (off_t)io->string_io.offset;
}

static int sdb_seek_file(struct selva_io *io, off_t offset, int whence)
{
    return fseeko(io->file_io.file, offset, whence);
}

static int sdb_seek_string(struct selva_io *io, off_t offset, int whence)
{
    const size_t data_len = selva_string_get_len(io->string_io.data);

    if (whence == SEEK_SET) {
        /* NOP */
    } else if (whence == SEEK_CUR) {
        offset += io->string_io.offset;
    } else if (whence == SEEK_END) {
        offset = data_len + io->string_io.offset;
    } else {
        return SELVA_EINVAL;
    }

    if ((size_t)offset > data_len) {
        return SELVA_EIO;
    }

    io->string_io.offset = (size_t)offset;
    return 0;
}

static int sdb_flush_file(struct selva_io *io)
{
    return fflush(io->file_io.file);
}

static int sdb_flush_string(struct selva_io *)
{
    return 0;
}

static int sdb_error_file(struct selva_io *restrict io)
{
    if (ferror(io->file_io.file)) {
        return SELVA_EIO;
    }

    return 0;
}

static int sdb_error_string(struct selva_io *restrict io)
{
    return io->string_io.err;
}

static void sdb_clearerr_file(struct selva_io *restrict io)
{
    clearerr(io->file_io.file);
}

static void sdb_clearerr_string(struct selva_io *restrict io)
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
        const size_t hdr_ftr_size = 0x60 + sizeof(magic_end) + SELVA_IO_HASH_SIZE; /* FIXME Some macros? */

        /* NOTE decomp needs the compressor to determine the worst case buf size. */
        /* TODO Coming in the upcoming version */
#if 0
        io->compressor = libdeflate_alloc_compressor_ex(6, &deflate_opts);
        io->decompressor = libdeflate_alloc_decompressor(&deflate_opts);
#endif
        io->compressor = libdeflate_alloc_compressor(6);
        io->decompressor = libdeflate_alloc_decompressor();

        io->compressed_buf_size = libdeflate_deflate_compress_bound(io->compressor, ZBLOCK_BUF_SIZE);
        io->compressed_buf = selva_malloc(io->compressed_buf_size + ZBLOCK_BUF_SIZE);
        io->block_buf = (char *)io->compressed_buf + ZBLOCK_BUF_SIZE;
        io->block_buf_i = (io->flags & SELVA_IO_FLAGS_WRITE) ? 0 : ZBLOCK_BUF_SIZE;

        /*
         * Find the size of the compressed segment in the SDB file.
         */
        fstat(fileno(io->file_io.file), &st);
        io->file_io.file_remain = (st.st_size >= SELVA_IO_HASH_SIZE) ? st.st_size - hdr_ftr_size : 0;
    }

    if (io->flags & SELVA_IO_FLAGS_FILE_IO) {
        io->sdb_write = sdb_write_file;
        io->sdb_read = sdb_read_file;
        io->sdb_tell = sdb_tell_file;
        io->sdb_seek = sdb_seek_file;
        io->sdb_flush = sdb_flush_file;
        io->sdb_error = sdb_error_file;
        io->sdb_clearerr = sdb_clearerr_file;
    } else if (io->flags & SELVA_IO_FLAGS_STRING_IO) {
        io->sdb_write = sdb_write_string;
        io->sdb_read = sdb_read_string;
        io->sdb_tell = sdb_tell_string;
        io->sdb_seek = sdb_seek_string;
        io->sdb_flush = sdb_flush_string;
        io->sdb_error = sdb_error_string;
        io->sdb_clearerr = sdb_clearerr_string;

        assert(!(io->flags & SELVA_IO_FLAGS_COMPRESSED));
    }
}

void sdb_deinit(struct selva_io *io)
{
    libdeflate_free_compressor(io->compressor);
    libdeflate_free_decompressor(io->decompressor);

    /* Note that block_buf follows compressed_buf in the same alloc. */
    selva_free(io->compressed_buf);
}

int sdb_write_header(struct selva_io *io)
{
    const char *created_with;
    const uint32_t save_flags = io->flags & SAVE_FLAGS_MASK;
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

    io->flags |= letoh(flags) & SELVA_IO_FLAGS_COMPRESSED;

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
        err = sdb_flush_block_buf(io);
        if (err) {
            return err;
        }
    }

    sha3_Update(&io->hash_c, magic_end, sizeof(magic_end));
    sdb_raw_write(io, magic_end, sizeof(magic_end));
    io->computed_hash = sha3_Finalize(&io->hash_c);
    sdb_raw_write(io, (void *)io->computed_hash, SELVA_IO_HASH_SIZE);
    err = io->sdb_error(io);

    return err;
}

int sdb_read_footer(struct selva_io *io)
{
    char magic[sizeof(magic_end)];
    size_t res;
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
    if (io->flags & SELVA_IO_FLAGS_FILE_IO) {
        res = fread(io->stored_hash, sizeof(uint8_t), sizeof(io->stored_hash), io->file_io.file);
        if (res != SELVA_IO_HASH_SIZE) {
            SELVA_LOG(SELVA_LOGL_ERR, "Hash size invalid. act: %zu expected: %zu", res, (size_t)SELVA_IO_HASH_SIZE);
            return SELVA_EINVAL;
        }
    } else if (io->flags & SELVA_IO_FLAGS_STRING_IO) {
        const char *data;
        size_t data_len;
        const size_t rd = (size_t)SELVA_IO_HASH_SIZE;

        data = selva_string_to_str(io->string_io.data, &data_len);

        if (io->string_io.offset + rd > data_len) {
            return SELVA_EINVAL;
        }

        memcpy(io->stored_hash, data + io->string_io.offset, rd);
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
