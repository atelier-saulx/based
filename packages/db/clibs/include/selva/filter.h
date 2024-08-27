/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "selva/_export.h"

/**
 * conjunction = or | and | necess | break
 * comparison_operator = switch_type | gt | lt | ge | le | eq | ne
 * comparison_expression = { conjunction | comparison_operator, field, constant }
 */
enum selva_filter_op_code {
    SELVA_FILTER_CONJ_OR = 0,
    SELVA_FILTER_CONJ_AND,
    SELVA_FILTER_CONJ_NECESS,
    SELVA_FILTER_CONJ_POSS,
    SELVA_FILTER_CONJ_OP_BREAK,
    SELVA_FILTER_OP_SWITCH_TYPE,
    SELVA_FILTER_OP_EQ_TYPE, /* == */
    SELVA_FILTER_OP_EQ_INTEGER, /* == */
    SELVA_FILTER_OP_NE_INTEGER, /* != */
    SELVA_FILTER_OP_GT_INTEGER, /* > */
    SELVA_FILTER_OP_LT_INTEGER, /* < */
    SELVA_FILTER_OP_GE_INTEGER, /* >= */
    SELVA_FILTER_OP_LE_INTEGER, /* <= */
    SELVA_FILTER_OP_LAST
} __attribute__((packed));

SELVA_EXPORT
int selva_filter_eval(struct SelvaNode *node, const uint8_t *expr_buf, size_t expr_len, bool *res_out);
