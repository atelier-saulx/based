/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "util/data-record.h"
#include "selva_db_types.h"
#include "selva_object.h"

struct EdgeField;
struct SelvaHierarchy;
struct SelvaSchema;
struct selva_io;

/**
 * EdgeFieldConstraint Flags.
 *
 * **Bidirectional references**
 * If one edge is removed the other edge is removed too. This flag requires
 * that fwd_field, and bck_field are set.
 */
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

/**
 * Edge constraint.
 * Edge constraints controls how an edge field behaves on different operations
 * like arc insertion and deletion or hierarchy node deletion.
 */
struct EdgeFieldConstraint {
    /**
     * Constraint flags controlling the behaviour.
     */
    enum EdgeFieldConstraintFlag flags;

    /**
     * Source node type this constraint applies to.
     */
    Selva_NodeType src_node_type;

    /**
     * Forward traversing field of this constraint.
     */
    char *field_name_str;
    size_t field_name_len;

    /**
     * Constraint of the backwards traversing field.
     * Used if the EDGE_FIELD_CONSTRAINT_FLAG_BIDIRECTIONAL flag is set.
     */
    char *bck_field_name_str;
    size_t bck_field_name_len;
};

struct EdgeFieldConstraints {
    STATIC_SELVA_OBJECT(dyn_constraints);
    char edge_constraint_emb_fields[SELVA_OBJECT_EMB_SIZE(2)];
};

struct SelvaSchema {
    size_t count;
    struct SelvaNodeSchema {
        struct {
            uint32_t nr_emb_fields: 16;
            uint32_t created_en: 1;
            uint32_t updated_en: 1;
            uint32_t _spare: 14;
        };
        size_t nr_fields;
        struct SelvaFieldSchema {
            char field_name[SELVA_SHORT_FIELD_NAME_LEN];
            enum SelvaFieldSchemaType {
                SELVA_FIELD_SCHEMA_TYPE_DATA = 0,
                SELVA_FIELD_SCHEMA_TYPE_EDGE = 1,
            } __packed type1;
            enum SelvaObjectType type2;
            SelvaObjectMeta_t meta;
        } *field_schemas __counted_by(nr_fields);
        struct EdgeFieldConstraints efc;
    } node[] __counted_by(count);
};

void SelvaSchema_Destroy(struct SelvaSchema *schema);
void SelvaSchema_SetDefaultSchema(struct SelvaHierarchy *hierarchy);
struct SelvaNodeSchema *SelvaSchema_FindNodeSchema(struct SelvaHierarchy *hierarchy, const Selva_NodeType type);
struct SelvaFieldSchema *SelvaSchema_FindFieldSchema(struct SelvaNodeSchema *ns, char field_name[SELVA_SHORT_FIELD_NAME_LEN]);
int SelvaSchema_Load(struct selva_io *io, int encver, struct SelvaHierarchy *hierarchy);
void SelvaSchema_Save(struct selva_io *io, struct SelvaHierarchy *hierarchy);

/*
 * Edge constraints.
 * TODO Some of these functions are only supposed to be used by schema.c and could be hidden.
 */

const struct EdgeFieldConstraint *Edge_GetConstraint(
        const struct EdgeFieldConstraints *efc,
        const Selva_NodeType node_type,
        const char *field_name_str,
        size_t field_name_len)
    __attribute__((access(read_only, 1), access(read_only, 4, 5)));

void Edge_InitEdgeFieldConstraints(struct EdgeFieldConstraints *efc)
    __attribute__((access(write_only, 1)));

void Edge_DeinitEdgeFieldConstraints(struct EdgeFieldConstraints *efc)
    __attribute__((access(read_write, 1)));

struct EdgeFieldDynConstraintParams {
    Selva_NodeType src_node_type;
    enum EdgeFieldConstraintFlag flags;
    char fwd_field_name[SELVA_SHORT_FIELD_NAME_LEN];
    char bck_field_name[SELVA_SHORT_FIELD_NAME_LEN];
};

int Edge_NewDynConstraint(struct EdgeFieldConstraints *efc, const struct EdgeFieldDynConstraintParams *params)
    __attribute__((access(read_write, 1), access(read_only, 2)));

int EdgeConstraint_Load(struct selva_io *io, int encver, struct EdgeFieldConstraints *data);
void EdgeConstraint_Save(struct selva_io *io, const struct EdgeFieldConstraints *data);
