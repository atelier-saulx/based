/*
 * Copyright (c) 2022-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#define SELVA_IO_TYPE
#include <ctype.h>
#include <errno.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include "selva/fast_memcmp.h"
#include "selva/selva_string.h"
#include "selva_error.h"
#include "db_panic.h"
#include "sdb.h"
#include "io.h"
#include "io_struct.h"

__attribute__((pure))
static int valid_flags(enum selva_io_flags flags)
{
    return (!(flags & SELVA_IO_FLAGS_READ) ^ !(flags & SELVA_IO_FLAGS_WRITE)) ||
           (!(flags & SELVA_IO_FLAGS_FILE_IO) ^ !(flags & SELVA_IO_FLAGS_STRING_IO)) ||
           !(flags & _SELVA_IO_FLAGS_EN_COMPRESS);
}

char *selva_io_hash_to_hex(char s[2 * SELVA_IO_HASH_SIZE], const uint8_t hash[SELVA_IO_HASH_SIZE])
{
    static const char map[] = "0123456789abcdef";
    char *p = s;

    for (size_t i = 0; i < SELVA_IO_HASH_SIZE; i++) {
        *p++ = map[(hash[i] >> 4) % sizeof(map)];
        *p++ = map[(hash[i] & 0x0f) % sizeof(map)];
    }

    return s;
}

/**
 * Init an io structure for a file.
 * Note that flags must be valid and validated before calling this function.
 */
static int init_io_file(struct selva_io *io, FILE *file, const char *filename, enum selva_io_flags flags)
{
    io->flags = flags;
    io->file_io.filename = selva_string_createf("%s", filename);
    io->file_io.file = file;
    sdb_init(io);

    int err = (flags & SELVA_IO_FLAGS_WRITE) ? sdb_write_header(io) : sdb_read_header(io);
    if (err) {
        selva_io_errlog(io, "%s: Failed: %s", __func__, selva_strerror(err));
    }

    return err;
}

/**
 * Init an io structure for a selva_string.
 * Note that flags must be valid and validated before calling this function.
 */
static int init_io_string(struct selva_io *io, struct selva_string *s, enum selva_io_flags flags)
{
    io->flags = flags;
    io->string_io.data = s;
    sdb_init(io);

    int err = (flags & SELVA_IO_FLAGS_WRITE) ? sdb_write_header(io) : sdb_read_header(io);
    if (err) {
        selva_io_errlog(io, "%s: Failed: %s", __func__, selva_strerror(err));
    }

    return err;
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
        fclose(file);
        return SELVA_EGENERAL;
    }

    if (setvbuf(file, nullptr, _IOFBF, stats.st_blksize) != 0) {
        fclose(file);
        return SELVA_ENOBUFS;
    }

    if (flags & SELVA_IO_FLAGS_WRITE) {
        /* We always compress files. */
        flags |= SELVA_IO_FLAGS_COMPRESSED;
    }

    return init_io_file(io, file, filename, flags);
}

struct selva_string *selva_io_init_string_write(struct selva_io *io, enum selva_io_flags flags)
{
    struct selva_string *s = selva_string_create(nullptr, 0, SELVA_STRING_MUTABLE);

    flags |= SELVA_IO_FLAGS_STRING_IO | SELVA_IO_FLAGS_WRITE;
    if (!valid_flags(flags)) {
        return nullptr;
    }

    if (init_io_string(io, s, flags)) {
        return nullptr;
    }

    return s;
}

int selva_io_init_string_read(struct selva_io *io, struct selva_string * restrict s, enum selva_io_flags flags)
{
    flags |= SELVA_IO_FLAGS_STRING_IO | SELVA_IO_FLAGS_READ;
    if (!valid_flags(flags)) {
        return SELVA_EINVAL;
    }

    return init_io_string(io, s, flags);
}

static void selva_io_close(struct selva_io *io)
{
    if (io->flags & SELVA_IO_FLAGS_FILE_IO) {
        fclose(io->file_io.file);
        selva_string_free(io->file_io.filename);
        io->file_io.filename = nullptr;
    }
}

int selva_io_end(struct selva_io *io, uint8_t hash_out[restrict SELVA_IO_HASH_SIZE])
{
    int err = 0;

    if (io->flags & SELVA_IO_FLAGS_WRITE) {
        sdb_write_footer(io);
        io->sdb_flush(io);
    } else { /* SELVA_IO_FLAGS_READ */
        err = sdb_read_footer(io);
        if (!err && !fast_memcmp(io->computed_hash, io->stored_hash, SELVA_IO_HASH_SIZE)) {
            char act[64];
            char expected[64];

            selva_io_errlog(io, "Hash mismatch. act: %.*s. expected: %.*s",
                            2 * SELVA_IO_HASH_SIZE, selva_io_hash_to_hex(act, io->computed_hash),
                            2 * SELVA_IO_HASH_SIZE, selva_io_hash_to_hex(expected, io->stored_hash));
            err = SELVA_EINVAL;
        }
        if (err) {
            selva_io_errlog(io, "SDB deserialization failed: %s", selva_strerror(err));
        }

    }

    selva_io_close(io);

    if (hash_out) {
        memcpy(hash_out, io->computed_hash, SELVA_IO_HASH_SIZE);
    }

    sdb_deinit(io);

    return err;
}

int selva_io_quick_verify(const char *filename)
{
    int err;
    struct selva_io io = {};

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

void selva_io_errlog(struct selva_io *io, const char *fmt, ...)
{
    int res;
    va_list args;

    if (!io->errlog_buf || io->errlog_left == 0) {
        /* No space left in buffer. */
        return;
    }

    va_start(args, fmt);

    if (io->errlog_left >= 2) {
        *io->errlog_buf++ = '>';
        *io->errlog_buf++ = ' ';
        io->errlog_left -= 2;
    }

    if (io->errlog_left > 0) {
      res = vsnprintf(io->errlog_buf, io->errlog_left, fmt, args);
      if (res > 0 && (size_t)res <= io->errlog_left) {
          io->errlog_buf += res;
          io->errlog_left -= res;
      }
    }

    if (io->errlog_left >= 1) {
        *io->errlog_buf++ = '\n';
        io->errlog_left--;
    }

    va_end(args);
}
