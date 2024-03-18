/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <string.h>
#include "selva_error.h"
#include "util/data-record.h"
#include "selva_object.h"
#include "selva_db_types.h"
#include "schema.h"
#include "edge.h"

static int cpy_offset(void *dst, void *src, size_t src_size, size_t offset, size_t cpy_len)
{
    const ptrdiff_t src_start = (ptrdiff_t)src;
    const ptrdiff_t src_end = src_start + src_size - 1;
    const ptrdiff_t off = (ptrdiff_t)offset;

    if (!(src_start + off >= src_start && src_start + off <= src_end &&
          src_start + off + (ptrdiff_t)cpy_len >= src_start && src_start + (ptrdiff_t)cpy_len <= src_end)) {
        return SELVA_EINVAL;
    }

    memcpy(dst, (uint8_t *)src + offset, cpy_len);

    return 0;
}

static int set_field_value_double(enum data_record_type type)
{
    switch (type) {
    case DATA_RECORD_float_be:
    case DATA_RECORD_float_le:
    case DATA_RECORD_double_be:
    case DATA_RECORD_double_le:
    default:
        return SELVA_EINTYPE;
    }
}

static int set_field_value_longlong(enum data_record_type type)
{
    switch (type) {
    case DATA_RECORD_int8:
    case DATA_RECORD_uint8:
        break;
    case DATA_RECORD_int16_be:
    case DATA_RECORD_uint16_be:
        break;
    case DATA_RECORD_int16_le:
    case DATA_RECORD_uint16_le:
        break;
    case DATA_RECORD_int32_be:
    case DATA_RECORD_uint32_be:
        break;
    case DATA_RECORD_int32_le:
    case DATA_RECORD_uint32_le:
        break;
    case DATA_RECORD_int64_be:
    case DATA_RECORD_uint64_be:
        break;
    case DATA_RECORD_int64_le:
    case DATA_RECORD_uint64_le:
        break;
    default:
        return SELVA_EINTYPE;
    }
}

static int set_field_value_string(enum data_record_type type)
{
    switch (type) {
    case DATA_RECORD_cstring:
    case DATA_RECORD_cstring_p:
        break;
    default:
        return SELVA_EINTYPE;
    }
}

static int set_field_value_hll(enum data_record_type type)
{
    /* TODO What will this type look like? */
}

static void *get_set_value_fn(enum data_record_type type)
{
    /* TODO We want to call SelvaObject directly here */
    switch (type) {
    case DATA_RECORD_int8:
    case DATA_RECORD_uint8:
        break;
    case DATA_RECORD_int16_be:
    case DATA_RECORD_uint16_be:
        break;
    case DATA_RECORD_int16_le:
    case DATA_RECORD_uint16_le:
        break;
    case DATA_RECORD_int32_be:
    case DATA_RECORD_uint32_be:
        break;
    case DATA_RECORD_int32_le:
    case DATA_RECORD_uint32_le:
        break;
    case DATA_RECORD_int64_be:
    case DATA_RECORD_uint64_be:
        break;
    case DATA_RECORD_int64_le:
    case DATA_RECORD_uint64_le:
        break;
    case DATA_RECORD_float_be:
    case DATA_RECORD_float_le:
        break;
    case DATA_RECORD_double_be:
    case DATA_RECORD_double_le:
        break;
    /* Variable size */
    case DATA_RECORD_int_be:
        break;
    case DATA_RECORD_int_le:
        break;
    case DATA_RECORD_uint_be:
        break;
    case DATA_RECORD_uint_le:
        break;
    case DATA_RECORD_cstring:
    /* Virtual */
    case DATA_RECORD_record:
    /* Pointer types */
    case DATA_RECORD_int8_p:
    case DATA_RECORD_int16_be_p:
    case DATA_RECORD_int16_le_p:
    case DATA_RECORD_int32_be_p:
    case DATA_RECORD_int32_le_p:
    case DATA_RECORD_int64_be_p:
    case DATA_RECORD_int64_le_p:
    case DATA_RECORD_uint8_p:
    case DATA_RECORD_uint16_be_p:
    case DATA_RECORD_uint16_le_p:
    case DATA_RECORD_uint32_be_p:
    case DATA_RECORD_uint32_le_p:
    case DATA_RECORD_uint64_be_p:
    case DATA_RECORD_uint64_le_p:
    case DATA_RECORD_float_be_p:
    case DATA_RECORD_float_le_p:
    case DATA_RECORD_double_be_p:
    case DATA_RECORD_double_le_p:
    /* Variable size pointer types */
    case DATA_RECORD_cstring_p:
    case DATA_RECORD_record_p:
        break;
    }

    return NULL;
}

/* TODO Move to schema? */

struct client_field_schema {
    char field_name[SELVA_SHORT_FIELD_NAME_LEN];
    enum SelvaObjectType type;
    SelvaObjectMeta_t meta;
    struct data_record_def def;
};

static int parse_data_record_def_to_field_schema(struct SelvaFieldSchema *fs, const struct data_record_def *def, size_t def_size)
{
    const size_t nr_fields = def_size / sizeof(struct data_record_def_field_type);

    if ((nr_fields % sizeof(struct data_record_def_field_type)) != 0) {
        return SELVA_EINVAL;
    }

#if 0
    for (size_t i = 0; i < nr_fields; i++) {
        const struct data_record_def_field_type *ft = &def->field_list[i];

        if (!strncmp(ft->name, "name", 4)) { /* Field name. */
            fs->modify.name = *ft;
            data_record_def_fixup(&fs->modify.name);
        } else if (!strncmp(ft->name, "op", 2)) {
            fs->modify.op = *ft;
            data_record_def_fixup(&fs->modify.op);
        } else if (!strncmp(ft->name, "value", 5)) {
            fs->modify.value = *ft;
            data_record_def_fixup(&fs->modify.value);
        }
    }
#endif

    return 0;
}

struct SelvaModifyOpRecord {
    enum SelvaModifyOp {
        SELVA_MODIFY_OP_DEL = 0, /*!< Delete field. */
        SELVA_MODIFY_OP_STRING = 1,
        SELVA_MODIFY_OP_STRING_DEFAULT = 2,
        SELVA_MODIFY_OP_LONGLONG = 3,
        SELVA_MODIFY_OP_LONGLONG_DEFAULT = 4,
        SELVA_MODIFY_OP_LONGLONG_INCREMENT = 5,
        SELVA_MODIFY_OP_DOUBLE = 6,
        SELVA_MODIFY_OP_DOUBLE_DEFAULT = 7,
        SELVA_MODIFY_OP_DOUBLE_INCREMENT = 8,
        SELVA_MODIFY_OP_SET_VALUE = 9,
        SELVA_MODIFY_OP_SET_INSERT = 10,
        SELVA_MODIFY_OP_SET_REMOVE = 11,
        SELVA_MODIFY_OP_SET_ASSIGN = 12,
        SELVA_MODIFY_OP_SET_MOVE = 13,
        SELVA_MODIFY_OP_EDGE_META = 14, /*!< Value is `struct SelvaModifyOpEdgeMeta`. */
    } __packed op;
    enum {
        SELVA_MODIFY_OP_FLAGS_VALUE_IS_DEFLATED = 0x01,
    } __packed flags;
    char lang[2];
    uint32_t index;
    char field_name[SELVA_SHORT_FIELD_NAME_LEN];
    char *value_str;
    size_t value_len;
};

struct SelvaModifyOpEdgeMeta {
    enum SelvaModifyOp op;
    int8_t delete_all; /*!< Delete all metadata from this edge field. */

    char dst_node_id[SELVA_NODE_ID_SIZE];

    const char *meta_field_name_str;
    size_t meta_field_name_len;

    const char *meta_field_value_str;
    size_t meta_field_value_len;
};

static int (*modify_op_fn[256])(void *buf, size_t buf_size, size_t offset, enum data_record_type type, size_t type_size, size_t arr_size);
