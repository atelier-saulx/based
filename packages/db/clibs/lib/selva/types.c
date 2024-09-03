/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */

#include "selva/types.h"

bool selva_is_valid_field_type(enum SelvaFieldType ftype)
{
    switch (ftype) {
    case SELVA_FIELD_TYPE_NULL:
    case SELVA_FIELD_TYPE_TIMESTAMP:
    case SELVA_FIELD_TYPE_CREATED:
    case SELVA_FIELD_TYPE_UPDATED:
    case SELVA_FIELD_TYPE_NUMBER:
    case SELVA_FIELD_TYPE_INTEGER:
    case SELVA_FIELD_TYPE_UINT8:
    case SELVA_FIELD_TYPE_UINT32:
    case SELVA_FIELD_TYPE_UINT64:
    case SELVA_FIELD_TYPE_BOOLEAN:
    case SELVA_FIELD_TYPE_ENUM:
    case SELVA_FIELD_TYPE_STRING:
    case SELVA_FIELD_TYPE_TEXT:
    case SELVA_FIELD_TYPE_REFERENCE:
    case SELVA_FIELD_TYPE_REFERENCES:
    case SELVA_FIELD_TYPE_WEAK_REFERENCE:
    case SELVA_FIELD_TYPE_WEAK_REFERENCES:
    case SELVA_FIELD_TYPE_MICRO_BUFFER:
        return true;
    }
    return false;
}

const char *selva_str_field_type(enum SelvaFieldType ftype)
{
    const char *str = (const char *)"invalid";

    switch (ftype) {
    case SELVA_FIELD_TYPE_NULL:
        str = (const char *)"null";
    case SELVA_FIELD_TYPE_TIMESTAMP:
        str = (const char *)"timestamp";
    case SELVA_FIELD_TYPE_CREATED:
        str = (const char *)"created";
    case SELVA_FIELD_TYPE_UPDATED:
        str = (const char *)"updated";
    case SELVA_FIELD_TYPE_NUMBER:
        str = (const char *)"number";
    case SELVA_FIELD_TYPE_INTEGER:
        str = (const char *)"integer";
    case SELVA_FIELD_TYPE_UINT8:
        str = (const char *)"uint8";
    case SELVA_FIELD_TYPE_UINT32:
        str = (const char *)"uint32";
    case SELVA_FIELD_TYPE_UINT64:
        str = (const char *)"uint64";
    case SELVA_FIELD_TYPE_BOOLEAN:
        str = (const char *)"boolean";
    case SELVA_FIELD_TYPE_ENUM:
        str = (const char *)"enum";
    case SELVA_FIELD_TYPE_STRING:
        str = (const char *)"string";
    case SELVA_FIELD_TYPE_TEXT:
        str = (const char *)"text";
    case SELVA_FIELD_TYPE_REFERENCE:
        str = (const char *)"reference";
    case SELVA_FIELD_TYPE_REFERENCES:
        str = (const char *)"references";
    case SELVA_FIELD_TYPE_WEAK_REFERENCE:
        str = (const char *)"weak reference";
    case SELVA_FIELD_TYPE_WEAK_REFERENCES:
        str = (const char *)"weak references";
    case SELVA_FIELD_TYPE_MICRO_BUFFER:
        str = (const char *)"micro buffer";
    }

    return str;
}
