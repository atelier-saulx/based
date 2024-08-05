/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include "selva_error.h"
#include "selva.h"
#include "../db.h"
#include "../io.h"
#include "io_struct.h"

/*
 * Pick 32-bit primes for these.
 */
#define DUMP_MAGIC_SCHEMA   3360690301
#define DUMP_MAGIC_TYPES    3550908863
#define DUMP_MAGIC_NS       4166476183
#define DUMP_MAGIC_FS       3490384141
#define DUMP_MAGIC_NODES    2460238717
#define DUMP_MAGIC_NODE     3323984057
#define DUMP_MAGIC_ALIASES  4019181209

/**
 * Write one of the magic numbers to the dump.
 */
static void save_dump_magic(struct selva_io *io, uint32_t magic)
{
    io->sdb_write(&magic, sizeof(uint32_t), 1, io);
}

/**
 * Read a magic number from the dump and compare it to the expected numer.
 */
static bool read_dump_magic(struct selva_io *io, uint32_t magic_exp)
{
    uint32_t magic_act;
    size_t res = io->sdb_read(&magic_act, sizeof(magic_act), 1, io);

    return res == 1 && magic_act == magic_exp;
}

static void save_fs(struct selva_io *io, struct SelvaFieldSchema *fs)
{
    save_dump_magic(io, DUMP_MAGIC_FS);

    io->sdb_write(fs, sizeof(*fs), 1, io);

    if (fs->type == SELVA_FIELD_TYPE_REFERENCE || fs->type == SELVA_FIELD_TYPE_REFERENCES) {
        /*
         * Need to save the edge meta schema.
         * Note that in this case we also saved the field_schemas pointer that's
         * just rubbish.
         */
        io->sdb_write(fs->edge_constraint.field_schemas, sizeof(struct SelvaFieldSchema), fs->edge_constraint.nr_fields, io);
    }
}

static void save_ns(struct selva_io *io, struct SelvaNodeSchema *ns)
{
    save_dump_magic(io, DUMP_MAGIC_NS);

    /* Write the top part of ns. */
    io->sdb_write(ns, sizeof(*ns), 1, io);

    /* Write field_schemas[] */
    for (field_t i = 0; i < ns->nr_fields; i++) {
        save_fs(io, &ns->field_schemas[i]);
    }
}

static void save_fields(struct selva_io *io, struct SelvaFields *fields)
{
    /* TODO */
}

static void save_node(struct selva_io *io, struct SelvaNode *node)
{
    save_dump_magic(io, DUMP_MAGIC_NODE);
    io->sdb_write(&node->node_id, sizeof(node_type_t), 1, io);
    io->sdb_write(&node->type, sizeof(node_type_t), 1, io);
    io->sdb_write(&node->expire, sizeof(uint32_t), 1, io);
    save_fields(io, &node->fields);
}

static void save_nodes(struct selva_io *io, struct SelvaNodeIndex *nodes)
{
    struct SelvaNode *node;

    save_dump_magic(io, DUMP_MAGIC_NODES);

    RB_FOREACH(node, SelvaNodeIndex, nodes) {
        save_node(io, node);
    }
}

static void save_aliases(struct selva_io *io, struct SelvaAliases *aliases)
{
    struct SelvaAlias *alias;

    save_dump_magic(io, DUMP_MAGIC_ALIASES);

    RB_FOREACH(alias, SelvaAliasesByName, &aliases->alias_by_name) {
        size_t alias_len = strlen(alias->name);

        io->sdb_write(&alias->dest, sizeof(alias->dest), 1, io);
        io->sdb_write(&alias_len, sizeof(alias_len), 1, io);
        io->sdb_write(alias->name, sizeof(char), alias_len, io);
    }
}

static void save_schema(struct selva_io *io, struct SelvaDb *db)
{
    SVector *types = &db->type_list;
    struct SVectorIterator it;
    struct SelvaTypeEntry *type;

    save_dump_magic(io, DUMP_MAGIC_SCHEMA);

    SVector_ForeachBegin(&it, types);
    while ((type = vecptr2SelvaTypeEntry(SVector_Foreach(&it)))) {
        save_ns(io, &type->ns);
    }
}

static void save_types(struct selva_io *io, SVector *types)
{
    struct SVectorIterator it;
    struct SelvaTypeEntry *te;

    save_dump_magic(io, DUMP_MAGIC_TYPES);

    SVector_ForeachBegin(&it, types);
    while ((te = vecptr2SelvaTypeEntry(SVector_Foreach(&it)))) {
        io->sdb_write(&te->type, sizeof(te->type), 1, io);
        save_nodes(io, &te->nodes);
        save_aliases(io, &te->aliases);
    }
}

static void save_db(struct selva_io *io, struct SelvaDb *db)
{
    save_schema(io, db);
    save_types(io, &db->type_list);
}

int io_dump_save_async(struct SelvaDb *db, const char *filename)
{
    pid_t pid;

    pid = fork();
    if (pid == 0) {
        struct selva_io io;
        uint8_t hash[SELVA_IO_HASH_SIZE];
        int err;

        printf("hello world\n");

        err = selva_io_init_file(&io, "", SELVA_IO_FLAGS_WRITE | SELVA_IO_FLAGS_COMPRESSED);
        if (err) {
            return err;
        }

        save_db(&io, db);
        selva_io_end(&io, NULL, hash);

        quick_exit(EXIT_SUCCESS);
    } else if (pid < 0) {
        return SELVA_EGENERAL;
    }

    return 0;
}
