/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
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
    uint32_t bsize; /*!< Size of event + its data. */
    uint32_t crc;
} __packed;
static_assert(sizeof(struct selva_history_hdr) == 2 * HIST_LINE_SIZE);

struct selva_history_event {
    int64_t ts;
    node_id_t node_id;
    uint32_t crc;
} __packed;
static_assert(sizeof(struct selva_history_event) == HIST_LINE_SIZE);

static struct selva_history_hdr hdr_template = {
    .preamble = HIST_PREAMBLE,
    .ver = HIST_VER,
};

int selva_history_init(const char *pathname, size_t bsize, struct selva_history **hist_out)
{
    struct selva_history *hist = selva_malloc(sizeof(*hist));

    if (bsize % HIST_LINE_SIZE != 0) {
        return SELVA_EINVAL;
    }

    hist->file = fopen(pathname, "a+");
    hist->fd = fileno(hist->file);
    hist->bsize = bsize;

    /*
     * Read pos can be initially either at SEEK_SET or SEEK_END depending on
     * the system/libc. Writing pos is always at the end of the file in append
     * mode.
     */
    (void)fseek(hist->file, 0, SEEK_SET);

    struct selva_history_hdr hdr;
    ssize_t rd = pread(hist->fd, &hdr, sizeof(hdr), 0);
    if (rd == 0) {
        memcpy(&hdr, &hdr_template, sizeof(hdr));
        hdr.bsize = bsize;
        hdr.crc = crc32c(0, &hdr, sizeof(hdr));
        fwrite(&hdr, sizeof(hdr), 1, hist->file);
    } else if (rd != sizeof(hdr)) {
        return SELVA_EIO;
    } else {
        if (memcmp(hdr.preamble, hdr_template.preamble, sizeof(HIST_PREAMBLE)) ||
            hdr.ver != HIST_VER ||
            hdr.bsize != bsize) {
            return SELVA_EINVAL;
        }

    }

    hist->crc = hdr.crc;

    *hist_out = hist;
    return 0;
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

void selva_history_sync(struct selva_history *hist)
{
    fflush(hist->file);
}
