/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stdint.h>

enum SelvaFieldType {
    SELVA_FIELD_TYPE_EDGE = 0,
};

enum EdgeFieldConstraintFlag {
    /**
     * Single reference edge.
     */
    EDGE_FIELD_CONSTRAINT_FLAG_SINGLE_REF       = 0x01,
    /**
     * Bidirectional reference.
     */
    EDGE_FIELD_CONSTRAINT_FLAG_BIDIRECTIONAL    = 0x02,
    /**
     * Edge field array mode.
     * By default an edge field acts like a set. This flag makes the field work like an array.
     */
    EDGE_FIELD_CONSTRAINT_FLAG_ARRAY            = 0x40,
} __packed;

typedef int8_t field_t;
typedef uint64_t node_id_t;

struct SelvaNodeSchema {
    uint16_t nr_emb_fields;
    uint16_t nr_dyn_fields;
    field_t created_field;
    field_t updated_field;
    struct SelvaFieldSchema {
        field_t field_index;
        enum SelvaFieldType type;
        struct EdgeFieldConstraint {
            enum EdgeFieldConstraintFlag flags;
            struct SelvaNodeSchema *src_node;
            struct SelvaNodeSchema *dst_node;
            field_t inverse_field;
        };
    } field_schemas[] __counted_by(nr_fields);
};

struct SelvaNode {
    node_id_t node_id;
    uint32_t expire;
    uint16_t ns_index; /*!< Index to NodeSchema. */
    struct trx_label trx_label;
    char *dyn_fields;
    char emb_fields[];
};

struct SelvaDb {
    /**
     * Global transaction state.
     */
    struct trx_state trx_state;

    size_t nr_types;
    struct {
        struct selva_node_schema *ns;
        struct selva_node_index_tree index_head;
        struct {
            STATIC_SELVA_OBJECT(_obj_data);
        } aliases;
        struct mempool nodepool;
    } *type __counted_by(nr_types);
};

__attribute__((visibility("default"))) struct SelvaDb *selva_create_db(void);
__attribute__((visibility("default"))) void selva_delete_db(struct SelvaDb *db);
__attribute__((visibility("default"))) int selva_update_schema(struct SelvaDb *db, char *schema_buf, size_t schema_len);
