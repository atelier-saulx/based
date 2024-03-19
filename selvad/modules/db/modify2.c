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

struct SelvaModifyOp {
    enum SelvaModifyOpCode {
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
    enum SelvaModifyOpCode op;
    int8_t delete_all; /*!< Delete all metadata from this edge field. */

    char dst_node_id[SELVA_NODE_ID_SIZE];

    const char *meta_field_name_str;
    size_t meta_field_name_len;

    const char *meta_field_value_str;
    size_t meta_field_value_len;
};

static int (*modify_op_fn[256])(void *buf, size_t buf_size, size_t offset, enum data_record_type type, size_t type_size, size_t arr_size);
