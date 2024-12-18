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
    case SELVA_FIELD_TYPE_INT8:
    case SELVA_FIELD_TYPE_UINT8:
    case SELVA_FIELD_TYPE_INT16:
    case SELVA_FIELD_TYPE_UINT16:
    case SELVA_FIELD_TYPE_INT32:
    case SELVA_FIELD_TYPE_UINT32:
    case SELVA_FIELD_TYPE_INT64:
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
    case SELVA_FIELD_TYPE_ALIAS:
    case SELVA_FIELD_TYPE_ALIASES:
        return true;
    case SELVA_FIELD_TYPE_HLL:
    }
    return false;
}

const char *selva_str_field_type(enum SelvaFieldType ftype)
{

    switch (ftype) {
    case SELVA_FIELD_TYPE_NULL:
        return (const char *)"null";
    case SELVA_FIELD_TYPE_TIMESTAMP:
        return (const char *)"timestamp";
    case SELVA_FIELD_TYPE_CREATED:
        return (const char *)"created";
    case SELVA_FIELD_TYPE_UPDATED:
        return (const char *)"updated";
    case SELVA_FIELD_TYPE_NUMBER:
        return (const char *)"number";
    case SELVA_FIELD_TYPE_INT8:
        return (const char *)"int8";
    case SELVA_FIELD_TYPE_UINT8:
        return (const char *)"uint8";
    case SELVA_FIELD_TYPE_INT16:
        return (const char *)"int16";
    case SELVA_FIELD_TYPE_UINT16:
        return (const char *)"uint16";
    case SELVA_FIELD_TYPE_INT32:
        return (const char *)"int32";
    case SELVA_FIELD_TYPE_UINT32:
        return (const char *)"uint32";
    case SELVA_FIELD_TYPE_INT64:
        return (const char *)"int64";
    case SELVA_FIELD_TYPE_UINT64:
        return (const char *)"uint64";
    case SELVA_FIELD_TYPE_BOOLEAN:
        return (const char *)"boolean";
    case SELVA_FIELD_TYPE_ENUM:
        return (const char *)"enum";
    case SELVA_FIELD_TYPE_STRING:
        return (const char *)"string";
    case SELVA_FIELD_TYPE_TEXT:
        return (const char *)"text";
    case SELVA_FIELD_TYPE_REFERENCE:
        return (const char *)"reference";
    case SELVA_FIELD_TYPE_REFERENCES:
        return (const char *)"references";
    case SELVA_FIELD_TYPE_WEAK_REFERENCE:
        return (const char *)"weak reference";
    case SELVA_FIELD_TYPE_WEAK_REFERENCES:
        return (const char *)"weak references";
    case SELVA_FIELD_TYPE_MICRO_BUFFER:
        return (const char *)"micro buffer";
    case SELVA_FIELD_TYPE_ALIAS:
        return (const char *)"alias";
    case SELVA_FIELD_TYPE_ALIASES:
        return (const char *)"aliases";
    case SELVA_FIELD_TYPE_HLL:
    }

    return (const char *)"invalid";
}
