/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <string.h>
#include "jemalloc_selva.h"
#include "selva/types.h"
#include "ref_save_map.h"

typedef signed _BitInt(64)  tuple_t;

/**
 * ref_save_map is used to determine which end of Bidirectional references
 * should be marked for save while parsing the schema.
 */
struct ref_save_map_item {
    tuple_t tuple;
    RB_ENTRY(ref_save_map_item) entry;
};

static int ref_save_map_item_cmp(struct ref_save_map_item *a, struct ref_save_map_item *b)
{
    tuple_t diff = a->tuple - b->tuple;

    if (diff < 0) {
        return -1;
    } else if (diff > 0) {
        return 1;
    } else {
        return 0;
    }
}

RB_GENERATE_STATIC(ref_save_map, ref_save_map_item, entry, ref_save_map_item_cmp)

void ref_save_map_init(struct ref_save_map *map)
{
    RB_INIT(map);
}

void ref_save_map_destroy(struct ref_save_map *map)
{
    struct ref_save_map_item *item;
    struct ref_save_map_item *tmp;

    RB_FOREACH_SAFE(item, ref_save_map, map, tmp) {
        RB_REMOVE(ref_save_map, map, item);
        selva_free(item);
    }
}

static tuple_t make_tuple(node_type_t a_type, node_type_t b_type, field_t a_field, field_t b_field)
{
    static_assert(sizeof(a_type) == 2);
    static_assert(sizeof(a_field) == 1);
    const uint32_t a = (uint32_t)a_type << 8 | (uint32_t)a_field;
    const uint32_t b = (uint32_t)b_type << 8 | (uint32_t)b_field;

    return (a < b) ? (tuple_t)a << 24 | (tuple_t)b : (tuple_t)b << 24 | (tuple_t)a;
}

bool ref_save_map_insert(struct ref_save_map *map, node_type_t src_type, node_type_t dst_type, field_t src_field, field_t dst_field)
{
    struct ref_save_map_item *item = selva_malloc(sizeof(*item));

    item->tuple = make_tuple(src_type, dst_type, src_field, dst_field);

    if (RB_INSERT(ref_save_map, map, item)) {
#if 0
        fprintf(stderr, "%p skippedy %d.%d -> %d.%d\n", map, src_type, src_field, dst_type, dst_field);
#endif
        selva_free(item);
        return false;
    }
#if 0
    fprintf(stderr, "%p noskippedy %d.%d -> %d.%d\n", map, src_type, src_field, dst_type, dst_field);
#endif
    return true;
}
