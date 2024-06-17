/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct SelvaFieldsAny {
    enum SelvaFieldType type; /*!< Type of the value. */
    union {
        bool boolean;
        double number;
        int64_t timestamp;
        long long integer;
        struct selva_string *string;
        uint32_t uint32;
        uint64_t uint64;
        uint8_t uint8;
        uint8_t enu;
        void *p;
    };
};
extern const size_t selva_field_data_size[15];

int selva_fields_set(struct SelvaNode *node, field_t field, enum SelvaFieldType type, const void *value, size_t len);
int selva_fields_set_timestamp(struct SelvaNode *node, field_t field, int64_t value);
int selva_fields_set_number(struct SelvaNode *node, field_t field, double value);
int selva_fields_set_integer(struct SelvaNode *node, field_t field, int32_t value);
int selva_fields_get(struct SelvaNode *node, field_t field, struct SelvaFieldsAny *any);
int selva_field_del(struct SelvaNode *node, field_t field);
