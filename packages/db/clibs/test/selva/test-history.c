/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */

#include <unistd.h>
#include <stdint.h>
#include "selva/history.h"

struct example_history {
    uint32_t x;
    uint16_t y;
    uint16_t z;
    char str[8];
};

struct full_event {
    struct selva_history_event meta;
    struct example_history data;
};

static_assert(sizeof(struct example_history) == 16);
static_assert(sizeof(struct full_event) == 32);

static char filename[] = "test-history.tmp.XXXXXXXXXXXXX";
static struct selva_history *hist;

void setup(void)
{
    mktemp(filename);
}

void teardown(void)
{
    selva_history_destroy(hist);
    unlink(filename);
}

static void print_event(struct full_event *ev)
{
    printf("ts: %lld node_id: %u crc: %u | %llu %u %u %.*s\n",
           ev->meta.ts, ev->meta.node_id, ev->meta.crc,
           ev->data.x, ev->data.y, ev->data.z, sizeof(ev->data.str), ev->data.str);
}

PU_TEST(test_history)
{
    int err;

    err = selva_history_create(filename, sizeof(struct example_history), &hist);
    pu_assert_equal("created hist", err, 0);
    pu_assert_not_nullptr("hist not null", hist);

    selva_history_append(hist, 0, 1, &(struct example_history){ 0, 1, 2, "A" });
    selva_history_append(hist, 1, 1, &(struct example_history){ 1, 2, 3, "B" });
    selva_history_append(hist, 1, 2, &(struct example_history){ 2, 3, 4, "C" });
    selva_history_append(hist, 3, 1, &(struct example_history){ 4, 5, 6, "D" });
    selva_history_append(hist, 3, 2, &(struct example_history){ 4, 5, 6, "E" });
    selva_history_append(hist, 4, 2, &(struct example_history){ 4, 5, 6, "F" });

    size_t range_size, range_len;
    struct full_event *range;

    range = selva_history_find_range(hist, 1, 1, &range_size);
    pu_assert_not_nullptr("", range);
    pu_assert_equal("", range_size, 2 * sizeof(struct full_event));
#if 0
    for (size_t i = 0; i < 2; i++) {
        print_event(&range[i]);
    }
#endif
    selva_history_free_range(range);

    range = selva_history_find_range_node(hist, 0, 3, 2, &range_size);
    pu_assert_not_nullptr("", range);
    pu_assert_equal("", range_size, 2 * sizeof(struct full_event));
#if 0
    for (size_t i = 0; i < 2; i++) {
        print_event(&range[i]);
    }
#endif
    selva_history_free_range(range);

    return nullptr;
}
