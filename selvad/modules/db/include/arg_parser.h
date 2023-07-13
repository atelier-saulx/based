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

#endif /* SELVA_ARG_PARSER */
