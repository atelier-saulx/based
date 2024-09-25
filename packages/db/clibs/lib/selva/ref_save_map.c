/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <string.h>
#include "jemalloc.h"
#include "selva/types.h"
#include "ref_save_map.h"

/**
 * ref_save_map is used to determine which end of Bidirectional references
 * should be marked for save while parsing the schema.
 */
struct ref_save_map_item {
    node_type_t types[2];
    RB_ENTRY(ref_save_map_item) entry;
};

static int ref_save_map_item_cmp(struct ref_save_map_item *a, struct ref_save_map_item *b)
{
    return memcmp(a->types, b->types, sizeof_field(struct ref_save_map_item, types));
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
        selva_free(item);
    }
}

bool ref_save_map_insert(struct ref_save_map *map, node_type_t src_type, node_type_t dst_type)
{
    struct ref_save_map_item *item = selva_malloc(sizeof(*item));

    if (src_type < dst_type) {
        item->types[0] = src_type;
        item->types[1] = dst_type;
    } else {
        item->types[0] = dst_type;
        item->types[1] = src_type;
    }

    if (RB_INSERT(ref_save_map, map, item)) {
#if 0
        fprintf(stderr, "%p skippedy %d:%d\n", map, src_type, dst_type);
#endif
        selva_free(item);
        return false;
    }
#if 0
    fprintf(stderr, "%p noskippedy %d:%d\n", map, src_type, dst_type);
#endif
    return true;
}
