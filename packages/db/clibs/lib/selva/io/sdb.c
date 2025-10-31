/*
 * Copyright (c) 2022-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include "jemalloc_selva.h"
#include "libdeflate.h"
#include "selva/endian.h"
#include "selva/fast_memcmp.h"
#include "selva/selva_hash128.h"
#include "selva/selva_string.h"
#include "selva_error.h"
#include "db_panic.h"
#include "io.h"
#include "io_struct.h"
#include "sdb.h"

/*
 *
 * Selva binary dump serialization format (.sdb).
 *
 * ```
 *    | 00 01 02 03 04 05 06 07
 * ===+=========================+
 * 00 | 54 48 53 49 44 45 55 50 | Magic string
 *    |-------------------------|
 * 08 | 00 00 00 00 00 00 00 00 | Created with version hash
 * 10 | 00 00 00 00 00 00 00 00 | 40 bytes
 * 18 | 00 00 00 00 00 00 00 00 | human-readable
 * 20 | 00 00 00 00 00 00 00 00 |
 * 28 | 00 00 00 00 00 00 00 00 |
 *    |-------------------------|
 * 30 | 00 00 00 00 00 00 00 00 | Updated with version hash
 * 38 | 00 00 00 00 00 00 00 00 | 40 bytes
 * 40 | 00 00 00 00 00 00 00 00 | human-readable
 * 48 | 00 00 00 00 00 00 00 00 |
 * 50 | 00 00 00 00 00 00 00 00 |
 *    |-------------------------|
 * 58 | 01 00 00 00|00 00 00 00 | uin32_t version | uint32_t flags
 *    |=========================|
 * 60 |        D  A  T  A       | compressed or raw data
 *    |=========================|
 *    | 44 4e 45 41 56 4c 45 53 | Magic string (not padded)
 *    |-------------------------|
 *    | XX XX XX XX XX XX XX XX | Hash of the file
 *    | XX XX XX XX XX XX XX XX | from 0 to the beginning last magic string but
 *    | XX XX XX XX XX XX XX XX | over uncompressed data.
 *    | XX XX XX XX XX XX XX XX | binary
 * ```
 *
 * Reading the created and updated version with hexdump:
 * ```
 * hexdump -s 8 -n 40 -e '40/1 "%c"' common.sdb
 * hexdump -s 48 -n 40 -e '40/1 "%c"' common.sdb
 * ```
 *
 * SDB Version History
 * -------------------
 *
 * **1**
 * - First stable version
 *
 * **2**
 * - Adds colvec serialization at the end of each range file
 *
 * **3**
 * - ref save logic moved completely to flags given from the schema package
 * - meta/edge fields is now a *type*
 *
 * **4**
 * - Remove weak reference(s)
 *
 * **5**
 * - Remove EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP and always save both sides of refs
 *
 * **6**
 * - Add support for default value in micro buffers
 */

#define SDB_VERSION 6 /*!< Bump this if the serialization format changes. */
#define SDB_COMPRESSION_LEVEL 1
#define SDB_LOG_VERSIONS 0
#define SAVE_FLAGS_MASK (SELVA_IO_FLAGS_COMPRESSED)
#define ZBLOCK_BUF_SIZE (1024 * 1024)

#define SELVA_DB_VERSION_SIZE   40
struct SelvaDbVersionInfo {
    __nonstring char running[SELVA_DB_VERSION_SIZE];
    __nonstring char created_with[SELVA_DB_VERSION_SIZE];
    __nonstring char updated_with[SELVA_DB_VERSION_SIZE];
};

/**
 * Selva module version tracking.
 * This is used to track the Selva module version used to create and modify the
 * hierarchy that was serialized and later deserialized.
 */
static struct SelvaDbVersionInfo selva_db_version_info;

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

static const char magic_start[] = { 'T', 'H', 'S', 'I', 'D', 'E', 'U', 'P' };
static const char magic_end[]   = { 'D', 'N', 'E', 'A', 'V', 'L', 'E', 'S' };

static inline void sdb_hash_init(struct selva_io *io)
{
    io->checksum_state = 0;
}

static inline void sdb_hash_deinit(struct selva_io *io)
{
    io->checksum_state = 0;
}

static inline void sdb_hash_update(struct selva_io *io, void const *, size_t len)
{
    io->checksum_state += len;
}

static inline void sdb_hash_finalize(struct selva_io *io)
{
    static_assert(sizeof(io->computed_hash) == sizeof(io->checksum_state));
    memcpy(io->computed_hash, &io->checksum_state, sizeof(io->computed_hash));
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

static int zsdb_writeout(struct selva_io *io)
{
    struct selva_io_zbuf *zbuf = io->zbuf;
    size_t out_nbytes;

    assert(zbuf->block_buf_i == ZBLOCK_BUF_SIZE);

    out_nbytes = libdeflate_compress(io->compressor, zbuf->block_buf, ZBLOCK_BUF_SIZE, zbuf->compressed_buf, zbuf->compressed_buf_size);
    if (unlikely(out_nbytes == 0)) {
        /*
         * This shouldn't happen as the buffer is (should be) always big enough.
         * Therefore, even if the data expands slightly we can just accept it
         * like that. This simplifies the process slightly as we can expect
         * every block of data to be compressed and avoid adding more metadata
         * and hopefully still actually save some space.
         */
        db_panic("Failed to compress an SDB block");
    }


    io->raw_write(io, zbuf->compressed_buf, out_nbytes);
    zbuf->block_buf_i = 0;

    return 0;
}

static int zsdb_flush_block_buf(struct selva_io *io)
{
    struct selva_io_zbuf *zbuf = io->zbuf;

    assert(io->flags & _SELVA_IO_FLAGS_EN_COMPRESS);

    if (zbuf->block_buf_i > 0) {
        size_t remain = ZBLOCK_BUF_SIZE - zbuf->block_buf_i;

        /* pad with zeroes */
        memset(zbuf->block_buf + zbuf->block_buf_i, 0, remain);
        zbuf->block_buf_i += remain;

        return zsdb_writeout(io);
    }
    return 0;
}

static void zsdb_write(struct selva_io *restrict io, const void *restrict ptr, size_t size)
{
    struct selva_io_zbuf *zbuf = io->zbuf;
    size_t left = size;
    const char *p = ptr;

    while (left > 0) {
        size_t bytes_to_copy = min(left, ZBLOCK_BUF_SIZE - zbuf->block_buf_i);

        assert(zbuf->block_buf_i < ZBLOCK_BUF_SIZE && bytes_to_copy > 0);

        memcpy(zbuf->block_buf + zbuf->block_buf_i, p, bytes_to_copy);
        p += bytes_to_copy;
        left -= bytes_to_copy;
        zbuf->block_buf_i += bytes_to_copy;

        if (zbuf->block_buf_i >= ZBLOCK_BUF_SIZE) {
            (void)zsdb_writeout(io);
        }
    }
}

static int file_zsdb_readin(struct selva_io *io)
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

    res = libdeflate_decompress_ex(io->decompressor, zbuf->compressed_buf, in_nbytes, zbuf->block_buf, ZBLOCK_BUF_SIZE, &in_nbytes_act, nullptr);
    if (res) {
        return SELVA_EINVAL;
    }

    io->file_io.file_remain -= in_nbytes_act;
    fseek(io->file_io.file, -(long)(in_nbytes - in_nbytes_act), SEEK_CUR);
    zbuf->block_buf_i = 0;

    return 0;
}

static int string_zsdb_readin(struct selva_io *io)
{
    struct selva_io_zbuf *zbuf = io->zbuf;
    const size_t remain = selva_string_get_len(io->string_io.data) - io->string_io.offset - (sizeof(magic_end) + SELVA_IO_HASH_SIZE);
    const size_t in_nbytes = min(zbuf->compressed_buf_size, remain);
    size_t in_nbytes_act;
    enum libdeflate_result res;
    int err;

    assert(zbuf->block_buf_i == ZBLOCK_BUF_SIZE);

    err = string_raw_read(io, zbuf->compressed_buf, in_nbytes);
    if (err) {
        return err;
    }

    /* Just to be sure that there is never any garbage left. */
    memset(zbuf->compressed_buf + in_nbytes, 0, zbuf->compressed_buf_size - in_nbytes);

    res = libdeflate_decompress_ex(io->decompressor, zbuf->compressed_buf, in_nbytes, zbuf->block_buf, ZBLOCK_BUF_SIZE, &in_nbytes_act, nullptr);
    if (res) {
        return SELVA_EINVAL;
    }

    io->string_io.offset -= in_nbytes - in_nbytes_act;
    zbuf->block_buf_i = 0;

    return 0;
}

static size_t zsdb_read(struct selva_io *restrict io, void * restrict ptr, size_t total_size, int (*zreadin)(struct selva_io *io))
{
    struct selva_io_zbuf *zbuf = io->zbuf;
    size_t r = 0;

    while (r < total_size) {
        size_t bytes_to_copy;

        if (zbuf->block_buf_i >= ZBLOCK_BUF_SIZE) {
            int err;

            err = zreadin(io);
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
    return r;
}

static void file_sdb_write(const void * restrict ptr, size_t size, size_t count, struct selva_io *restrict io)
{
    const size_t wr = count * size;

    sdb_hash_update(io, ptr, wr);

    if (io->flags & _SELVA_IO_FLAGS_EN_COMPRESS) {
        zsdb_write(io, ptr, wr);
    } else {
        (void)fwrite(ptr, size, count, io->file_io.file);
    }
}

static size_t file_sdb_read(void * restrict ptr, size_t size, size_t count, struct selva_io *restrict io)
{
    size_t r;

    if (io->flags & _SELVA_IO_FLAGS_EN_COMPRESS) {
        r = zsdb_read(io, ptr, size * count, file_zsdb_readin);
        sdb_hash_update(io, ptr, r);
        return r / size;
    } else {
        r = fread(ptr, size, count, io->file_io.file);
        sdb_hash_update(io, ptr, r * size);
        return r;
    }
}

static void string_sdb_write(const void * restrict ptr, size_t size, size_t count, struct selva_io * restrict io)
{
    const size_t wr = count * size;
    int err;

    sdb_hash_update(io, ptr, wr);

    if (io->flags & _SELVA_IO_FLAGS_EN_COMPRESS) {
        zsdb_write(io, ptr, wr);
    } else {
        err = selva_string_append(io->string_io.data, ptr, wr);
        if (err) {
            io->string_io.err = err;
        }
    }
}

static size_t string_sdb_read(void * restrict ptr, size_t size, size_t count, struct selva_io * restrict io)
{
    const size_t rd = size * count;

    if (io->flags & _SELVA_IO_FLAGS_EN_COMPRESS) {
        if (zsdb_read(io, ptr, rd, string_zsdb_readin) != rd) {
            return 0;
        }
    } else {
        int err;

        err = string_raw_read(io, ptr, rd);
        if (err) {
            return 0;
        }
    }

    sdb_hash_update(io, ptr, rd);
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
    sdb_hash_init(io);

    io->sdb_version = SDB_VERSION; /* this might change later in sdb_read_header(). */

    /*
     * Initialize compressor if requested or if reading because we don't know
     * whether the SDB will be compressed.
     */
    if (io->flags & (SELVA_IO_FLAGS_READ | SELVA_IO_FLAGS_COMPRESSED)) {
        /* NOTE decomp needs the compressor to determine the worst case buf size. */
        io->compressor = libdeflate_alloc_compressor(SDB_COMPRESSION_LEVEL);
        io->decompressor = libdeflate_alloc_decompressor();

        const size_t compressed_buf_size = libdeflate_compress_bound(ZBLOCK_BUF_SIZE);
        struct selva_io_zbuf *zbuf = selva_malloc(sizeof(*zbuf) + compressed_buf_size);
        zbuf->compressed_buf_size = compressed_buf_size;
        zbuf->block_buf_i = (io->flags & SELVA_IO_FLAGS_WRITE) ? 0 : ZBLOCK_BUF_SIZE;
        io->zbuf = zbuf;
    }

    if (io->flags & SELVA_IO_FLAGS_FILE_IO) {
        struct stat st;

        /*
         * Find the size of the compressed segment in the SDB file.
         */
        fstat(fileno(io->file_io.file), &st);
        io->file_io.file_remain = (st.st_size >= SELVA_IO_HASH_SIZE) ? st.st_size - HDR_FTR_SIZE : 0;

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
    }
}

void sdb_deinit(struct selva_io *io)
{
    libdeflate_free_compressor(io->compressor);
    libdeflate_free_decompressor(io->decompressor);
    selva_free(io->zbuf);
    sdb_hash_deinit(io);
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
    io->sdb_write(&io->sdb_version, sizeof(io->sdb_version), 1, io);
    static_assert(sizeof(io->sdb_version) == sizeof(uint32_t));
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
    uint32_t flags;
    size_t res;

    res = io->sdb_read(magic, sizeof(char), sizeof(magic), io);
    if (res != sizeof(magic) || !fast_memcmp(magic, magic_start, sizeof(magic))) {
        return SELVA_EINVAL;
    }

    res = io->sdb_read(selva_db_version_info.created_with, SELVA_DB_VERSION_SIZE, 1, io);
    res += io->sdb_read(selva_db_version_info.updated_with, SELVA_DB_VERSION_SIZE, 1, io);
    res += io->sdb_read(&io->sdb_version, sizeof(io->sdb_version), 1, io);
    res += io->sdb_read(&flags, sizeof(flags), 1, io);
    if (res != 4) {
        return SELVA_EINVAL;
    }

    io->sdb_version = letoh(io->sdb_version);
    if (io->sdb_version < 3 || io->sdb_version > SDB_VERSION) {
        return SELVA_ENOTSUP;
    }

    io->flags |= letoh(flags) & SAVE_FLAGS_MASK;

    if (io->flags & SELVA_IO_FLAGS_COMPRESSED) {
        io->flags |= _SELVA_IO_FLAGS_EN_COMPRESS;
    }

#if SDB_LOG_VERSIONS
    fprintf(stderr, "running: %.*s created_with: %.*s updated_with: %.*s\n",
            SELVA_DB_VERSION_SIZE, selva_db_version_info.running,
            SELVA_DB_VERSION_SIZE, selva_db_version_info.created_with,
            SELVA_DB_VERSION_SIZE, selva_db_version_info.updated_with);
#endif

    return 0;
}

int sdb_write_footer(struct selva_io *io)
{
    typeof(io->flags) prevz = io->flags & _SELVA_IO_FLAGS_EN_COMPRESS;
    int err = SELVA_EINTYPE;

    if (prevz) {
        err = zsdb_flush_block_buf(io);
        if (err) {
            return err;
        }
    }

    sdb_hash_update(io, magic_end, sizeof(magic_end));
    io->raw_write(io, magic_end, sizeof(magic_end));
    sdb_hash_finalize(io);
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
    if (res != sizeof(magic) || !fast_memcmp(magic, magic_end, sizeof(magic))) {
#if 0
        fprintf(stderr, "Bad magic: %.2x %.2x %.2x %.2x %.2x %.2x %.2x %.2x\n",
                (uint8_t)magic[0], (uint8_t)magic[1],
                (uint8_t)magic[2], (uint8_t)magic[3],
                (uint8_t)magic[4], (uint8_t)magic[5],
                (uint8_t)magic[6], (uint8_t)magic[7]);
#endif
        return SELVA_EINVAL;
    }

    sdb_hash_finalize(io);
    err = io->raw_read(io, io->stored_hash, sizeof(io->stored_hash));
    if (err) {
        return err;
    }

    io->flags |= prevz;

    return 0;
}

int sdb_read_hash(struct selva_io *io)
{
    off_t pos;
    int err;

    pos = io->sdb_tell(io);
    io->sdb_seek(io, -(SELVA_IO_HASH_SIZE + 8), SEEK_END);
    err = sdb_read_footer(io);
    io->sdb_seek(io, pos, SEEK_SET);
    if (err) {
        return err;
    }

    return 0;
}

__attribute__((constructor(101)))
static void init(void)
{
    extern const char * const selva_version;
    strncpy(selva_db_version_info.running, selva_version, sizeof(selva_db_version_info.running));
}
