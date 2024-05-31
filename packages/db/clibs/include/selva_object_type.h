/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef SELVA_OBJECT_TYPE
#define SELVA_OBJECT_TYPE

/*
 * Object key types.
 * DO NOT REORDER the numbers as they are used for in the serialization format.
 */
enum SelvaObjectType {
    SELVA_OBJECT_NULL = 0,
    SELVA_OBJECT_DOUBLE = 1,
    SELVA_OBJECT_LONGLONG = 2,
    SELVA_OBJECT_STRING = 3,
    SELVA_OBJECT_OBJECT = 4,
    SELVA_OBJECT_SET = 5,
    SELVA_OBJECT_ARRAY = 6,
    SELVA_OBJECT_POINTER = 7,
    SELVA_OBJECT_HLL = 8,
} __packed;

#endif /* SELVA_OBJECT_TYPE */
