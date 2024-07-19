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
    CONJ_OR = 0,
    CONJ_AND,
    CONJ_NECESS,
    CONJ_OP_BREAK,
    OP_SWITCH_TYPE,
    OP_EQ_TYPE, /* == */
    OP_EQ_INTEGER, /* == */
    OP_NE_INTEGER, /* != */
    OP_GT_INTEGER, /* > */
    OP_LT_INTEGER, /* < */
    OP_GE_INTEGER, /* >= */
    OP_LE_INTEGER, /* <= */
    OP_LAST
} __attribute__((packed));

int filter_eval(struct SelvaNode *node, uint8_t *expr_buf, size_t expr_len, bool *res_out);
