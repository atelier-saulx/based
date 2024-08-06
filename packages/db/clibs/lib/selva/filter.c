/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "selva.h"
#include "selva_error.h"
#include "fields.h"
#include "filter.h"

#if 0
.filter((filter) => {
  // (id === 'bl1234' && body === 'success' || name = 'framma') && bla includes floop
  // note: follow call order (similar to Promise.then/catch)
  return filter('id', '=', 'bl1234')
    .and(['title', 'body'], 'includes', ['youzi', 'olli'])
    .and('body', 'search', 'success')
    .or((filter) => {
      return filter('a', '=', 'b')
    })
    .and('bla', 'includes', 'flloop')
})
.and('bla', 'includes', 'flloop')
---
(op_id_eq('bl1234') && op_field_eq(body, 'success') || op_field_eq(name, 'framma')) && op_includes('bla', 'flloop')
#endif

/**
 * Operation result.
 */
struct op_result {
    int len; /*!< Bytes read from the input buffer. */
    bool res; /*!< Result of the operation. */
};

#define OP_RESULT_ERROR(errcode) \
    (struct op_result){ \
        .len = (errcode), \
    }

/**
 * Type for operation function.
 */
typedef struct op_result (*op_fn_t)(struct SelvaNode *node, const uint8_t *in, size_t max_len);

/**
 * Jump by offset by node type.
 */
static struct op_result op_switch_type(struct SelvaNode *node, const uint8_t *in, size_t max_len)
{
    const struct {
        uint8_t switch_len;
        struct {
            node_type_t type;
            uint16_t offset;
        } __packed scase[];
    } __packed *sc = (typeof(sc))in;

    if (max_len <= sizeof_field(typeof(*sc), switch_len)) {
        return OP_RESULT_ERROR(SELVA_EINVAL);
    }

    const size_t switch_len = sc->switch_len;
    for (size_t i = 0; i < switch_len; i++) {
        if (sc->scase[i].type == node->type && max_len < sc->scase[i].offset) {
            return (struct op_result){
                .len = sc->scase[i].offset,
                .res = true,
            };
        }
    }

    return OP_RESULT_ERROR(SELVA_ENOENT);
}

static struct op_result op_eq_type(struct SelvaNode *node, const uint8_t *in, size_t max_len)
{
    const struct {
        node_type_t type;
    } __packed *args = (typeof(args))in;

    if (max_len < sizeof(*args)) {
        return OP_RESULT_ERROR(SELVA_EINVAL);
    }

    return (struct op_result){
        .len = sizeof(*args),
        .res = node->type == args->type,
    };
}

#define OP_TEMPLATE_INTEGER(op) \
    const struct { \
        field_t field; \
        int32_t value; \
    } __packed *args = (typeof(args))in; \
    struct SelvaFieldsAny any; \
    if (max_len < sizeof(*args)) return OP_RESULT_ERROR(SELVA_EINVAL); \
    int err = selva_fields_get(&node->fields, args->field, &any); \
    if (err) return OP_RESULT_ERROR(err); \
    if (any.type != SELVA_FIELD_TYPE_INTEGER) return OP_RESULT_ERROR(SELVA_EINTYPE); \
    return (struct op_result){ \
        .len = sizeof(*args), \
        .res = any.integer op args->value, \
    }

static struct op_result op_eq_integer(struct SelvaNode *node, const uint8_t *in, size_t max_len)
{
    OP_TEMPLATE_INTEGER(==);
}

static struct op_result op_ne_integer(struct SelvaNode *node, const uint8_t *in, size_t max_len)
{
    OP_TEMPLATE_INTEGER(!=);
}

static struct op_result op_gt_integer(struct SelvaNode *node, const uint8_t *in, size_t max_len)
{
    OP_TEMPLATE_INTEGER(>);
}

static struct op_result op_lt_integer(struct SelvaNode *node, const uint8_t *in, size_t max_len)
{
    OP_TEMPLATE_INTEGER(<);
}

static struct op_result op_ge_integer(struct SelvaNode *node, const uint8_t *in, size_t max_len)
{
    OP_TEMPLATE_INTEGER(>=);
}

static struct op_result op_le_integer(struct SelvaNode *node, const uint8_t *in, size_t max_len)
{
    OP_TEMPLATE_INTEGER(<=);
}

static const op_fn_t op_fn[] = {
    [FILTER_OP_SWITCH_TYPE] = op_switch_type,
    [FILTER_OP_EQ_TYPE] = op_eq_type,
    [FILTER_OP_EQ_INTEGER] = op_eq_integer,
    [FILTER_OP_NE_INTEGER] = op_ne_integer,
    [FILTER_OP_GT_INTEGER] = op_gt_integer,
    [FILTER_OP_LT_INTEGER] = op_lt_integer,
    [FILTER_OP_GE_INTEGER] = op_ge_integer,
    [FILTER_OP_LE_INTEGER] = op_le_integer,
};

int filter_eval(struct SelvaNode *node, const uint8_t *expr_buf, size_t expr_len, bool *res_out)
{
    enum filter_op_code conjunction = FILTER_CONJ_OR;
    bool res = false;

    /*
     * 1. conjunction || op_code
     * 2. [args] if op_code
     * 3. conjunction || op_code
     * 4. [args] if op_code
     * ...
     */
    for (size_t i = 0; i < expr_len;) {
        uint8_t byte = expr_buf[i++];

        if (byte < FILTER_CONJ_OP_BREAK) {
            conjunction = byte;
        } else if (byte > FILTER_CONJ_OP_BREAK && byte < FILTER_OP_LAST) {
            struct op_result op_res;

            if (unlikely(i >= expr_len)) {
                return SELVA_EINVAL;
            }

            op_res = op_fn[byte](node, expr_buf + i, expr_len - i);
            if (unlikely(op_res.len < 0)) {
                return op_res.len;
            }
            i += op_res.len;

            switch (conjunction) {
            case FILTER_CONJ_OR:
                res |= !!op_res.res;
                break;
            case FILTER_CONJ_AND:
                res &= !!op_res.res;
                break;
            case FILTER_CONJ_NECESS:
                res = !!op_res.res;
                if (!res) {
                    goto out;
                }
                break;
            case FILTER_CONJ_POSS:
                res = !!op_res.res;
                if (res) {
                    goto out;
                }
                break;
            default:
                abort();
            }
        } else {
            return SELVA_EINTYPE;
        }
    }

out:
    *res_out = res;
    return 0;
}
