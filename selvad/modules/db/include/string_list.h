/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct finalizer;
struct selva_string;

/**
 * Parse a nul-byte separated list.
 */
struct selva_string **string_list_parse(
        struct finalizer *fin,
        const char *in_str,
        size_t in_len);
