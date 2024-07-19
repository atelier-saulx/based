/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

int find(struct SelvaDb *db, struct SelvaNode *node, const char *fields, const uint8_t *filter_expression, struct SelvaTraversalParam *cb);
