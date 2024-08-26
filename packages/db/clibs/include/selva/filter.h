/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

/**
 * conjunction = or | and | necess | break
 * comparison_operator = switch_type | gt | lt | ge | le | eq | ne
 * comparison_expression = { conjunction | comparison_operator, field, constant }
 */
enum filter_op_code {
    FILTER_CONJ_OR = 0,
    FILTER_CONJ_AND,
    FILTER_CONJ_NECESS,
    FILTER_CONJ_POSS,
    FILTER_CONJ_OP_BREAK,
    FILTER_OP_SWITCH_TYPE,
    FILTER_OP_EQ_TYPE, /* == */
    FILTER_OP_EQ_INTEGER, /* == */
    FILTER_OP_NE_INTEGER, /* != */
    FILTER_OP_GT_INTEGER, /* > */
    FILTER_OP_LT_INTEGER, /* < */
    FILTER_OP_GE_INTEGER, /* >= */
    FILTER_OP_LE_INTEGER, /* <= */
    FILTER_OP_LAST
} __attribute__((packed));

int filter_eval(struct SelvaNode *node, const uint8_t *expr_buf, size_t expr_len, bool *res_out);
