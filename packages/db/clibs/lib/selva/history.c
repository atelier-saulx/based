/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _FILE_OFFSET_BITS 64
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include "selva/crc32c.h"
#include "selva/types.h"
#include "jemalloc_selva.h"
#include "selva_error.h"
#include "selva/history.h"

/*
 * LE format
 *   B |0       |4       |8       |16      | DEC
 * bit |0       |20      |40      |60    7F| HEX
 *     +========+========+========+========+
 *   0 | "^SELVA_HISTORY^"                 |
 *  80 | VER    | spare  | bsize  | CRC-32 |
 * 100 | TS              | nodeId | CRC-32 |
 * 180 | data
 *     ...
 *     | TS              | nodeId | CRC-32 |
 *     | data
 *
 * VER = 1
 * CRC-32 = CRC-32 of the file
 * bsize = sizeof(data)
 */

#define HIST_PREAMBLE "^SELVA_HISTORY^"
#define HIST_LINE_SIZE 16
#define HIST_VER 1
#define HIST_OFF_CRC 16

static_assert(sizeof(HIST_PREAMBLE) == HIST_LINE_SIZE);

struct selva_history {
    size_t bsize;
    FILE *file;
    int fd;
    uint32_t crc;
};

struct selva_history_hdr {
    char preamble[HIST_LINE_SIZE];
    uint32_t ver;
    uint32_t spare;
    uint32_t bsize; /*!< Size of event data block. */
    uint32_t crc; /*!< CRC of the header, initial CRC for the first entry. */
} __packed;

static_assert(sizeof(struct selva_history_hdr) == 2 * HIST_LINE_SIZE);
static_assert(sizeof(struct selva_history_event) == HIST_LINE_SIZE);

static const struct selva_history_hdr hdr_template = {
    .preamble = HIST_PREAMBLE,
    .ver = HIST_VER,
};

int selva_history_create(const char *pathname, size_t bsize, struct selva_history **hist_out)
{
    struct selva_history *hist;

    if (bsize % HIST_LINE_SIZE != 0) {
        return SELVA_EINVAL;
    }

    hist = selva_malloc(sizeof(*hist));
    hist->file = fopen(pathname, "a+");
    hist->fd = fileno(hist->file);
    hist->bsize = bsize;

    /*
     * Read pos can be initially either at SEEK_SET or SEEK_END depending on
     * the system/libc. Writing pos is always at the end of the file in append
     * mode.
     */
    (void)fseeko(hist->file, 0, SEEK_SET);

    struct selva_history_hdr hdr;
    ssize_t rd = pread(hist->fd, &hdr, sizeof(hdr), 0);
    if (rd == 0) {
        memcpy(&hdr, &hdr_template, sizeof(hdr));
        hdr.bsize = bsize;
        hdr.crc = crc32c(0, &hdr, sizeof(hdr));
        fwrite(&hdr, sizeof(hdr), 1, hist->file);
    } else if (rd != sizeof(hdr)) {
        selva_free(hist);
        return SELVA_EIO;
    } else {
        if (memcmp(hdr.preamble, hdr_template.preamble, sizeof(HIST_PREAMBLE)) ||
            hdr.ver != HIST_VER ||
            hdr.bsize != bsize) {
            selva_free(hist);
            return SELVA_EINVAL;
        }
    }

    hist->crc = hdr.crc;

    *hist_out = hist;
    return 0;
}

void selva_history_destroy(struct selva_history *hist)
{
    selva_history_fsync(hist);
    fclose(hist->file);
    selva_free(hist);
}

void selva_history_append(struct selva_history *hist, int64_t ts, node_id_t node_id, void *buf)
{
    struct selva_history_event event = {
        .ts = ts,
        .node_id = node_id,
        .crc = crc32c(hist->crc, buf, hist->bsize),
    };

    (void)fwrite(&event, sizeof(event), 1, hist->file);
    (void)fwrite(buf, sizeof(uint8_t), hist->bsize, hist->file);
    hist->crc = event.crc;
}

void selva_history_fsync(struct selva_history *hist)
{
    fflush(hist->file);
    fsync(hist->fd);
}

static inline size_t get_event_bsize(const struct selva_history *hist)
{
    return sizeof(struct selva_history_event) + hist->bsize;
}

static off_t get_hist_len(struct selva_history *hist)
{
    fseeko(hist->file, 0L, SEEK_END);
    return (ftello(hist->file) - sizeof(struct selva_history_hdr)) / get_event_bsize(hist);
}

static void hist_seek(const struct selva_history *hist, off_t index)
{
    fseeko(hist->file, sizeof(struct selva_history_hdr) + index * get_event_bsize(hist), SEEK_SET);
}

static bool read_event_hdr(struct selva_history_event *event, const struct selva_history *hist, off_t index)
{
    size_t rd;

    hist_seek(hist, index);
    rd = fread(event, sizeof(*event), 1, hist->file);
    return (rd != sizeof(*event));
}

static uint32_t *read_event_range(struct selva_history *hist, off_t begin_i, off_t end_i, size_t *size_out)
{
    uint32_t *buf;
    size_t buf_size, rd;

    buf_size = (end_i - begin_i + 1) * get_event_bsize(hist);
    buf = selva_malloc(buf_size);
    hist_seek(hist, begin_i);
    rd = fread(buf, sizeof(uint8_t), buf_size, hist->file);
    if (rd != buf_size) {
        selva_free(buf);
        return nullptr;
    }

    *size_out = buf_size;
    return buf;
}

static off_t find_leftmost(struct selva_history *hist, off_t n, int64_t ts)
{
    off_t left = 0;
    off_t right = n;

    while (left < right) {
        struct selva_history_event event;
        off_t m;

        m = (left + right) / 2;
        if (!read_event_hdr(&event, hist, m)) return -1;
        if (event.ts < ts) {
            left = m + 1;
        } else {
            right = m;
        }
    }

    return left;
}

static off_t find_rightmost(struct selva_history *hist, off_t n, int64_t ts)
{
    off_t left = 0;
    off_t right = n;

    while (left < right) {
        struct selva_history_event event;
        off_t m;

        m = (left + right) / 2;
        if (!read_event_hdr(&event, hist, m)) return -1;
        if (event.ts > ts) {
            right = m;
        } else {
            left = m + 1;
        }
    }

    return right - 1;
}

uint32_t *selva_history_find_range(struct selva_history *hist, int64_t from, int64_t to, size_t *size_out)
{
    off_t len = get_hist_len(hist);
    off_t begin = find_leftmost(hist, len, from);
    off_t end = find_rightmost(hist, len, to);

    if (begin == -1 || end == -1) {
        return nullptr;
    }

    return read_event_range(hist, begin, end, size_out);
}

uint32_t *selva_history_find_range_node(struct selva_history *hist, int64_t from, int64_t to, node_id_t node_id, size_t *size_out)
{
    off_t len = get_hist_len(hist);
    off_t begin = find_leftmost(hist, len, from);
    off_t end = find_rightmost(hist, len, to);
    size_t entry_len = get_event_bsize(hist);
    uint32_t *buf;
    size_t n = 0;

    if (begin == -1 || end == -1) {
        return nullptr;
    }

    buf = selva_malloc((end - begin + 1) * entry_len);

    hist_seek(hist, begin);
    for (off_t i = begin; i <= end; i++) {
        uint8_t *cur = (uint8_t *)buf + n * entry_len;
        size_t rd;

        rd = fread(cur, sizeof(uint8_t), entry_len, hist->file);
        if (rd != (size_t)entry_len) {
            selva_free(buf);
            return nullptr;
        }
        if (((struct selva_history_event *)cur)->node_id == node_id) {
            n++;
        }
    }

    selva_xallocx(buf, n * entry_len, 0, 0);
    *size_out = n * entry_len;

    return buf;
}

void selva_history_free_range(uint32_t *range)
{
    selva_free(range);
}
