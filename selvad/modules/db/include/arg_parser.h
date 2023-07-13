/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef SELVA_ARG_PARSER
#define SELVA_ARG_PARSER

#include "selva_db.h"

struct SelvaObject;
struct finalizer;
struct selva_string;

typedef struct selva_string ** selva_stringList;

struct SelvaArgParser_EnumType {
    char *name;
    int id;
};

int SelvaArgParser_Enum(
        const struct SelvaArgParser_EnumType types[],
        const struct selva_string *arg);
int SelvaArgParser_NodeType(
        Selva_NodeType node_type,
        const struct selva_string *arg);

/**
 * Parse index hints from Redis command args.
 * Parses index hints from argv until the first keyword mismatch.
 * @returns The number of index hints found.
 */
int SelvaArgParser_IndexHints(
        selva_stringList *out,
        struct selva_string **argv,
        int argc);

#endif /* SELVA_ARG_PARSER */
