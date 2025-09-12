/*
 * Copyright (c) 2022-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#define SELVA_IO_HASH_SIZE 16

enum selva_io_flags {
    SELVA_IO_FLAGS_READ = 0x0001, /*!< This is a read op. */
    SELVA_IO_FLAGS_WRITE = 0x0002, /*!< This is a write op. */
    SELVA_IO_FLAGS_COMPRESSED = 0x0100, /* Compressed data. */
    SELVA_IO_FLAGS_FILE_IO = 0x0010, /*! Save to/Load from a file. Not set by caller. */
    SELVA_IO_FLAGS_STRING_IO = 0x0020, /*!< Save to/Load from a file. Not set by caller. */
    /* Runtime control flags */
    _SELVA_IO_FLAGS_EN_COMPRESS = 0x1000, /*!< Enable deflate block compression. */
};

struct SelvaDb;
struct selva_io;
struct selva_string;

char *selva_io_hash_to_hex(char s[2 * SELVA_IO_HASH_SIZE], const uint8_t hash[SELVA_IO_HASH_SIZE]);

/**
 * @param io must be Initialized before call.
 */
int selva_io_init_file(struct selva_io *io, const char *filename, enum selva_io_flags flags);

/**
 * @param io must be Initialized before call.
 */
struct selva_string *selva_io_init_string_write(struct selva_io *io, enum selva_io_flags flags);

/**
 * @param io must be Initialized before call.
 */
int selva_io_init_string_read(struct selva_io *io, struct selva_string * restrict s, enum selva_io_flags flags);

int selva_io_end(struct selva_io *io, uint8_t hash_out[restrict SELVA_IO_HASH_SIZE]);
int io_dump_save_async(struct SelvaDb *db, const char *filename);
int io_dump_load(const char *filename, struct SelvaDb **db_out);
int selva_io_quick_verify(const char *filename);

/**
 * Log error to the error buffer.
 */
void selva_io_errlog(struct selva_io *io, const char *fmt, ...);
