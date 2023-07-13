/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct SelvaObject;
struct finalizer;
struct selva_string;

struct parsers_enum {
    char *name;
    int id;
};

/**
 * Parse a nul-byte separated list.
 */
struct selva_string **parse_string_list(
        struct finalizer *fin,
        const char *in_str,
        size_t in_len);

/**
 * Parse a set of lists containing strings.
 * Exclusion prefix: '!'
 * Set separator: '\n'
 * List separator: '|'
 * Enf of sets: '\0'
 * The list_out object will be built as follows:
 * {
 *   '0': ['field1', 'field2'],
 *   '1': ['field3', 'field4'],
 * }
 */
int parse_string_set(
        struct finalizer *finalizer,
        const struct selva_string *raw_in,
        struct SelvaObject **list_out,
        struct selva_string **excluded_out);

int parse_enum(
        const struct parsers_enum types[],
        const struct selva_string *arg);
