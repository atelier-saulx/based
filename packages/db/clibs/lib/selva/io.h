#pragma once

#define SELVA_DB_VERSION_SIZE   40
struct SelvaDbVersionInfo {
    __nonstring char running[SELVA_DB_VERSION_SIZE];
    __nonstring char created_with[SELVA_DB_VERSION_SIZE];
    __nonstring char updated_with[SELVA_DB_VERSION_SIZE];
};

#define SELVA_IO_HASH_SIZE 32

enum selva_io_flags {
    SELVA_IO_FLAGS_READ = 0x0001, /*!< This is a read op. */
    SELVA_IO_FLAGS_WRITE = 0x0002, /*!< This is a write op. */
    SELVA_IO_FLAGS_COMPRESSED = 0x0100, /* Compressed data. */
    SELVA_IO_FLAGS_FILE_IO = 0x0010, /*! Save to/Load from a file. Not set by caller. */
    SELVA_IO_FLAGS_STRING_IO = 0x0020, /*!< Save to/Load from a file. Not set by caller. */
    /* Runtime control flags */
    _SELVA_IO_FLAGS_EN_COMPRESS = 0x1000, /*!< Enable deflate block compression. */
};

#ifdef SELVA_IO_TYPE
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

    /*
     * Compressed SDB.
     */
    struct selva_io_zbuf *zbuf;
    struct libdeflate_compressor *compressor;
    struct libdeflate_decompressor *decompressor;

#if 0
    struct sha3_context hash_c; /*!< Currently computed hash of the data. */
#endif
    const uint8_t *computed_hash; /*!< Updated at the end of load/save. */
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
};
#endif

int io_dump_save_async(struct SelvaDb *db, const char *filename);
