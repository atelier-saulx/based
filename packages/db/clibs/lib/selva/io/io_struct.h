/*
 * Copyright (c) 2022-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct libdeflate_compressor;
struct libdeflate_decompressor;
struct selva_io_zbuf;

struct selva_io {
    enum selva_io_flags flags;
    union {
        struct {
            struct selva_string *filename;
            FILE *file;
            size_t file_remain; /* Remaining payload bytes in the file. */
        } file_io;
        struct {
            int err;
            size_t offset;
            struct selva_string *data;
        } string_io;
    };

    /**
     * Serialization format version used by this io.
     */
    uint32_t sdb_version;

    /*
     * Compressed SDB.
     */
    struct selva_io_zbuf *zbuf;
    struct libdeflate_compressor *compressor;
    struct libdeflate_decompressor *decompressor;

    unsigned _BitInt(128) checksum_state;
    uint8_t computed_hash[SELVA_IO_HASH_SIZE]; /*!< Updated at the end of load/save. */
    uint8_t stored_hash[SELVA_IO_HASH_SIZE]; /*!< The hash found in the footer. */

    void (*raw_write)(struct selva_io *io, const void *p, size_t size);
    /**
     * Raw read from string sdb.
     * Doesn't update sha. Also no decompression will happen. This function can be
     * reused internally to read compressed and uncompressed SDB strings.
     */
    int (*raw_read)(struct selva_io *io, void *buf, size_t size);
    void (*sdb_write)(const void * restrict ptr, size_t size, size_t count, struct selva_io * restrict io);
    size_t (*sdb_read)(void * restrict ptr, size_t size, size_t count, struct selva_io *restrict io);
    off_t (*sdb_tell)(struct selva_io *io);
    int (*sdb_seek)(struct selva_io *io, off_t offset, int whence);
    int (*sdb_flush)(struct selva_io *io);

    /**
     * Return the last IO error.
     */
    int (*sdb_error)(struct selva_io *restrict io);
    void (*sdb_clearerr)(struct selva_io *restrict io);

    /*
     * Error log.
     * Use with selva_io_errlog().
     */
    char *errlog_buf; /*!< Error log buffer. */
    size_t errlog_left; /*!< Bytes left in errlog_buf. */
};
