/*
 * Copyright (c) 2024-2026 SAULX
 * SPDX-License-Identifier: MIT
 */

#include "selva/types.h"

bool selva_is_valid_field_type(enum SelvaFieldType ftype)
{
    switch (ftype) {
    case SELVA_FIELD_TYPE_NULL:
    case SELVA_FIELD_TYPE_STRING:
    case SELVA_FIELD_TYPE_TEXT:
    case SELVA_FIELD_TYPE_REFERENCE:
    case SELVA_FIELD_TYPE_REFERENCES:
    case SELVA_FIELD_TYPE_MICRO_BUFFER:
    case SELVA_FIELD_TYPE_ALIAS:
    case SELVA_FIELD_TYPE_COLVEC:
        return true;
    }
    return false;
}

const char *selva_str_field_type(enum SelvaFieldType ftype)
{

    switch (ftype) {
    case SELVA_FIELD_TYPE_NULL:
        return (const char *)"null";
    case SELVA_FIELD_TYPE_STRING:
        return (const char *)"string";
    case SELVA_FIELD_TYPE_TEXT:
        return (const char *)"text";
    case SELVA_FIELD_TYPE_REFERENCE:
        return (const char *)"reference";
    case SELVA_FIELD_TYPE_REFERENCES:
        return (const char *)"references";
    case SELVA_FIELD_TYPE_MICRO_BUFFER:
        return (const char *)"micro buffer";
    case SELVA_FIELD_TYPE_ALIAS:
        return (const char *)"alias";
    case SELVA_FIELD_TYPE_COLVEC:
        return (const char *)"columnar vector";
    }

    return (const char *)"invalid";
}
