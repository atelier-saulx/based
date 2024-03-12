/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

/**
 * Exclude.
 */
#define STRING_SET_EXCL_PREFIX      '!'

/**
 * Alias.
 */
#define STRING_SET_ALIAS            '@'

#define STRING_SET_SEPARATOR_SET    '\n'
#define STRING_SET_SEPARATOR_LIST   '|'
#define STRING_SET_EOS              '\0'

struct SelvaObject;
struct finalizer;
struct selva_string;

struct parsers_enum {
    char *name;
    int id;
};

/**
 * Parse a separated list.
 */
struct selva_string **parse_string_list(
        struct finalizer *fin,
        const char *in_str,
        size_t in_len,
        int separator);

/**
 * Add to a string list.
 * @param sl must be a mutable selva_string.
 * @param opt_ignore a single str to be ignored. Can be NULL.
 * @param el_str the new element.
 */
int string_set_list_add(struct selva_string *sl,
                        const char *opt_ignore_str, size_t opt_ignore_len,
                        const char *el_str, size_t el_len)
    __attribute__((access(read_only, 2, 3), access(read_only, 4, 5)));

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
        const char *side_list_prefixes,
        struct selva_string **side_list_out[])
    __attribute__((access(read_only, 2), access(write_only, 3), access(read_only, 4)));

int parse_enum(
        const struct parsers_enum types[],
        const struct selva_string *arg);

/**
 * Parse index hints.
 * List separator: '\0'
 */
[[nodiscard]]
struct selva_string **parse_index_hints(
        struct finalizer *fin,
        const char *index_hints_str,
        size_t index_hints_len,
        int *nr_index_hints_out)
    __attribute__((access(read_only, 2, 3), access(write_only, 4)));
