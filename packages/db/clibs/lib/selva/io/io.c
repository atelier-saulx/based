/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#define SELVA_IO_TYPE
#include <ctype.h>
#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include "selva_error.h"
#include "util/selva_string.h"
#include "../db_panic.h"
#include "sdb.h"
#include "../io.h"
#include "io_struct.h"

__attribute__((pure))
static int valid_flags(enum selva_io_flags flags)
{
    return (!(flags & SELVA_IO_FLAGS_READ) ^ !(flags & SELVA_IO_FLAGS_WRITE)) ||
           (!(flags & SELVA_IO_FLAGS_FILE_IO) ^ !(flags & SELVA_IO_FLAGS_STRING_IO)) ||
           !(flags & _SELVA_IO_FLAGS_EN_COMPRESS);
}

/**
 * Init an io structure for a file.
 * Note that flags must be valid and validated before calling this function.
 */
static void init_io_file(struct selva_io *io, FILE *file, const char *filename, enum selva_io_flags flags)
{
    memset(io, 0, sizeof(*io));
    io->flags = flags;
    io->file_io.filename = selva_string_createf("%s", filename);
    io->file_io.file = file;
    sdb_init(io);

    if (flags & SELVA_IO_FLAGS_WRITE) {
        sdb_write_header(io);
    } else {
        sdb_read_header(io);
    }
}

/**
 * Init an io structure for a selva_string.
 * Note that flags must be valid and validated before calling this function.
 */
static void init_io_string(struct selva_io *io, struct selva_string *s, enum selva_io_flags flags)
{
    memset(io, 0, sizeof(*io));
    io->flags = flags;
    io->string_io.data = s;
    sdb_init(io);

    if (flags & SELVA_IO_FLAGS_WRITE) {
        sdb_write_header(io);
    } else {
        sdb_read_header(io);
    }
}

int selva_io_init_file(struct selva_io *io, const char *filename, enum selva_io_flags flags)
{
    const char *mode = (flags & SELVA_IO_FLAGS_WRITE) ? "wb" : "rb";
    struct stat stats;
    FILE *file;

    flags |= SELVA_IO_FLAGS_FILE_IO;
    if (!(valid_flags(flags))) {
        return SELVA_EINVAL;
    }

    file = fopen(filename, mode);
    if (!file) {
        if (errno == ENOENT) {
            return SELVA_ENOENT;
        } else {
            /*
             * fopen() can fail due to a number of other reasons,
             * the (almost) best we can do is to tell the caller
             * that we failed to open the file.
             */
            return SELVA_EGENERAL;
        }
    }

    if (fstat(fileno(file), &stats) == -1) {
        return SELVA_EGENERAL;
    }

    if (setvbuf(file, nullptr, _IOFBF, stats.st_blksize) != 0) {
        return SELVA_ENOBUFS;
    }

    if (flags & SELVA_IO_FLAGS_WRITE) {
        /* We always compress files. */
        flags |= SELVA_IO_FLAGS_COMPRESSED;
    }

    init_io_file(io, file, filename, flags);

    return 0;
}

struct selva_string *selva_io_init_string_write(struct selva_io *io, enum selva_io_flags flags)
{
    struct selva_string *s = selva_string_create(nullptr, 0, SELVA_STRING_MUTABLE);

    flags |= SELVA_IO_FLAGS_STRING_IO | SELVA_IO_FLAGS_WRITE;
    if (!valid_flags(flags)) {
        return nullptr;
    }

    init_io_string(io, s, flags);

    return s;
}

int selva_io_init_string_read(struct selva_io * restrict io, struct selva_string * restrict s, enum selva_io_flags flags)
{
    flags |= SELVA_IO_FLAGS_STRING_IO | SELVA_IO_FLAGS_READ;
    if (!valid_flags(flags)) {
        return SELVA_EINVAL;
    }

    init_io_string(io, s, flags);

    return 0;
}

static void selva_io_close(struct selva_io *io)
{
    if (io->flags & SELVA_IO_FLAGS_FILE_IO) {
        fclose(io->file_io.file);
        selva_string_free(io->file_io.filename);
        io->file_io.filename = nullptr;
    }
}

void selva_io_end(struct selva_io *io, uint8_t hash_out[restrict SELVA_IO_HASH_SIZE])
{
    if (io->flags & SELVA_IO_FLAGS_WRITE) {
        sdb_write_footer(io);
        io->sdb_flush(io);
    } else { /* SELVA_IO_FLAGS_READ */
        int err;

        err = sdb_read_footer(io);
        if (!err && memcmp(io->computed_hash, io->stored_hash, SELVA_IO_HASH_SIZE)) {
#if 0
            char act[64];
            char expected[64];

            SELVA_LOG(SELVA_LOGL_ERR, "Hash mismatch. act: %.*s. expected: %.*s",
                      64, sha3_to_hex(act, io->computed_hash),
                      64, sha3_to_hex(expected, io->stored_hash));
#endif
            err = SELVA_EINVAL;
        }
        if (err) {
            /*
             * TODO It wouldn't be necessary to crash here as hierarchy loading is
             * sort of safe to fail.
             */
            db_panic("SDB deserialization failed: %s", selva_strerror(err));
        }

    }

    selva_io_close(io);

    if (hash_out) {
        memcpy(hash_out, io->computed_hash, SELVA_IO_HASH_SIZE);
    }

    sdb_deinit(io);
}

int selva_io_quick_verify(const char *filename)
{
    int err;
    struct selva_io io;

    err = selva_io_init_file(&io, filename, SELVA_IO_FLAGS_READ | SELVA_IO_FLAGS_COMPRESSED);
    if (err) {
        return err;
    }

    err = sdb_read_hash(&io);
    if (err) {
        return err;
    }

    selva_io_close(&io);
    sdb_deinit(&io);

    return 0;
}
