/*
 * Selva IO Module.
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "_evl_export.h"
#include "_selva_io.h"

#if SELVA_IO_MAIN
#define SELVA_IO_EXPORT(_ret_, _fun_name_, ...) _ret_ _fun_name_(__VA_ARGS__) EVL_EXTERN
#else
#define SELVA_IO_EXPORT(_ret_, _fun_name_, ...) _ret_ (*_fun_name_)(__VA_ARGS__) EVL_COMMON
#endif

struct selva_io;
struct selva_string;

#define SELVA_DB_VERSION_SIZE   40
struct SelvaDbVersionInfo {
    __nonstring char running[SELVA_DB_VERSION_SIZE];
    __nonstring char created_with[SELVA_DB_VERSION_SIZE];
    __nonstring char updated_with[SELVA_DB_VERSION_SIZE];
};

/**
 * Replication mode.
 */
enum replication_mode {
    SELVA_REPLICATION_MODE_NONE = 0,
    SELVA_REPLICATION_MODE_ORIGIN,
    SELVA_REPLICATION_MODE_REPLICA,
};

/**
 * Marks an EID used for SDB.
 * Used to distinguish between an SDB and command, which is useful
 * with data structures that can contain both using the same pointers.
 */
#define EID_MSB_MASK (~(~(typeof(uint64_t))0 >> 1))

/**
 * Absolute save/load order for the dump files.
 * The data is not annotated in any way in the file/stream, i.e. there is no
 * automatic metadata of any sort. Compare reading an SDB dump to loading from
 * a tape. Every piece of code must know exactly what's being loaded next and
 * when its own data ends.
 */
enum selva_io_load_order {
    SELVA_IO_ORD_HIERARCHY = 0,
    SELVA_IO_ORD_MQ,
    NR_SELVA_IO_ORD,
};

struct selva_io_serializer {
    bool (*is_ready)(); /*!< Is ready to be serialized. */
    int (*deserialize)(struct selva_io *io);
    void (*serialize)(struct selva_io *io);
    void (*flush)(void);
};

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

    struct sha3_context hash_c; /*!< Currently computed hash of the data. */
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

enum selva_io_dump_state {
    SELVA_DB_DUMP_NONE = 0x00, /*!< No dump operation running. */
    SELVA_DB_DUMP_ACTIVE_CHILD = 0x01, /*!< There is an active child. */
    SELVA_DB_DUMP_IS_CHILD = 0x02, /*!< This is the child process. */
};

#define SELVA_IO_FLAGS_MODE_MASK (SELVA_IO_FLAGS_READ | SELVA_IO_FLAGS_WRITE)

/**
 * Get the version info.
 */
SELVA_IO_EXPORT(void, selva_io_get_ver, struct SelvaDbVersionInfo *nfo);

/**
 * Register an SDB serializer.
 * @param serializer A pointer to the struct is not held.
 */
SELVA_IO_EXPORT(void, selva_io_register_serializer, enum selva_io_load_order ord, const struct selva_io_serializer *serializer);

SELVA_IO_EXPORT(void, selva_io_set_dirty, void);

SELVA_IO_EXPORT (enum selva_io_dump_state, selva_io_get_dump_state, void);

/**
 * Open the last good SDB for reading.
 */
SELVA_IO_EXPORT(int, selva_io_open_last_good, struct selva_io *io);

/**
 * Find the last good dump.
 */
SELVA_IO_EXPORT(int, selva_io_last_good_info, uint8_t hash[SELVA_IO_HASH_SIZE], struct selva_string **filename_out);

/**
 * Read selva_io_hash from a file.
 */
SELVA_IO_EXPORT(int, selva_io_read_hash, const char *filename, uint8_t hash[SELVA_IO_HASH_SIZE]);

/**
 * Start a new IO operation.
 * @param io is a pointer to the io state. Can be allocated from the stack.
 */
SELVA_IO_EXPORT(int, selva_io_init, struct selva_io *io, const char *filename, enum selva_io_flags flags);

/**
 * Start a new IO operation writing to a selva_string.
 * @param io is a pointer to the io state. Can be allocated from the stack.
 * @returns the selva string that will be appended.
 */
SELVA_IO_EXPORT(struct selva_string *, selva_io_init_string_write, struct selva_io *io, enum selva_io_flags flags);


/**
 * Start a new IO operation reading from a selva_string.
 * @param io is a pointer to the io state. Can be allocated from the stack.
 */
SELVA_IO_EXPORT(int, selva_io_init_string_read, struct selva_io * restrict io, struct selva_string * restrict s, enum selva_io_flags flags);

/**
 * End the IO operation.
 * 1. Verifies the hash on read mode; Writes the hash in write mode.
 * 2. Closes the file.
 */
SELVA_IO_EXPORT(void, selva_io_end, struct selva_io *io);

SELVA_IO_EXPORT(void, selva_io_save_unsigned, struct selva_io *io, uint64_t value);
SELVA_IO_EXPORT(void, selva_io_save_signed, struct selva_io *io, int64_t value);
SELVA_IO_EXPORT(void, selva_io_save_double, struct selva_io *io, double value);
SELVA_IO_EXPORT(void, selva_io_save_str, struct selva_io *io, const char *str, size_t len);
SELVA_IO_EXPORT(void, selva_io_save_string, struct selva_io *io, const struct selva_string *s);

SELVA_IO_EXPORT(uint64_t, selva_io_load_unsigned, struct selva_io *io);
SELVA_IO_EXPORT(int64_t, selva_io_load_signed, struct selva_io *io);
SELVA_IO_EXPORT(double, selva_io_load_double, struct selva_io *io);
SELVA_IO_EXPORT(const char*, selva_io_load_str, struct selva_io *io, size_t *len);
SELVA_IO_EXPORT(struct selva_string *, selva_io_load_string, struct selva_io *io);

/**
 * Get the replication mode.
 */
SELVA_IO_EXPORT(enum replication_mode, selva_replication_get_mode, void);

/**
 * Replicate a command buffer to replicas.
 * This is a NOP for replication modes other than ORIGIN.
 */
SELVA_IO_EXPORT(void, selva_replication_replicate, int64_t ts, int8_t cmd, const void *buf, size_t buf_size);

/**
 * Replicate a command to replicas.
 * Pass the ownership of buf to the replication module. Avoids one malloc.
 * buf must be allocated with `selva_malloc` or `selva_realloc`.
 */
SELVA_IO_EXPORT(void, selva_replication_replicate_pass, int64_t ts, int8_t cmd, void *buf, size_t buf_size);

#define _import_selva_io(apply) \
    apply(selva_io_get_ver) \
    apply(selva_io_register_serializer) \
    apply(selva_io_set_dirty) \
    apply(selva_io_get_dump_state) \
    apply(selva_io_open_last_good) \
    apply(selva_io_last_good_info) \
    apply(selva_io_read_hash) \
    apply(selva_io_init) \
    apply(selva_io_init_string_write) \
    apply(selva_io_init_string_read) \
    apply(selva_io_end) \
    apply(selva_io_save_unsigned) \
    apply(selva_io_save_signed) \
    apply(selva_io_save_double) \
    apply(selva_io_save_str) \
    apply(selva_io_save_string) \
    apply(selva_io_load_unsigned) \
    apply(selva_io_load_signed) \
    apply(selva_io_load_double) \
    apply(selva_io_load_str) \
    apply(selva_io_load_string) \
    apply(selva_replication_get_mode) \
    apply(selva_replication_replicate) \
    apply(selva_replication_replicate_pass)

#define _import_selva_io1(f) \
    evl_import(f, "mod_io.so");

/**
 * Import all symbols from selva_io.h.
 */
#define import_selva_io() \
    _import_selva_io(_import_selva_io1)
