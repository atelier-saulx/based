/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include "jemalloc.h"
#include "util/ctime.h"
#include "util/selva_string.h"
#include "util/timestamp.h"
#include "selva_error.h"
#include "selva.h"
#include "../db.h"
#include "../db_panic.h"
#include "../fields.h"
#include "../io.h"
#include "io_struct.h"

/*
 * Pick 32-bit primes for these.
 */
#define DUMP_MAGIC_SCHEMA   3360690301
#define DUMP_MAGIC_TYPES    3550908863
#define DUMP_MAGIC_NODES    2460238717
#define DUMP_MAGIC_NODE     3323984057
#define DUMP_MAGIC_FIELDS   3126175483
#define DUMP_MAGIC_ALIASES  4019181209

/*
 * Helper types for portable serialization.
 * Picking the right type:
 * 1. Use one of these types
 * 2. Use one of the specified-width types in selva.h
 * 3. Use a specified-width type from stdint.h
 * 4. Use a BitInt type
 * 5. Use the original type
 */
typedef uint32_t sdb_nr_types_t;
typedef uint32_t sdb_nr_nodes_t;
typedef uint32_t sdb_nr_fields_t;
typedef uint32_t sdb_expire_t;
typedef uint64_t sdb_nr_aliases_t;
typedef uint32_t sdb_arr_len_t; /*!< Used for most arrays, string or object. */

static void save_fields(struct selva_io *io, struct SelvaFields *fields);

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

static void save_fields_string(struct selva_io *io, struct selva_string *string)
{
    size_t len;
    const char *str = selva_string_to_str(string, &len);

    io->sdb_write(&len, sizeof(size_t), 1, io);
    io->sdb_write(str, sizeof(char), len, io);
}

static void save_fields_text(struct selva_io *io)
{
    /* TODO Save text field. */
}

static void save_fields_reference(struct selva_io *io, struct SelvaNodeReference *ref)
{
    const uint8_t meta_present = !!ref->meta;

    io->sdb_write(&ref->dst->node_id, sizeof(node_id_t), 1, io);
    io->sdb_write(&meta_present, sizeof(meta_present), 1, io);
    if (meta_present) {
        save_fields(io, ref->meta);
    }
}

/**
 * Save references.
 * The caller must save nr_refs.
 */
static void save_fields_references(struct selva_io *io, struct SelvaNodeReferences *refs)
{
    for (size_t i = 0; i < refs->nr_refs; i++) {
        struct SelvaNodeReference *ref = &refs->refs[i];

        if (ref && ref->dst) {
            save_fields_reference(io, ref);
        } else {
            /* TODO Handle NULL */
            db_panic("ref in refs shouldn't be NULL");
        }
    }
}

static void save_fields(struct selva_io *io, struct SelvaFields *fields)
{
    save_dump_magic(io, DUMP_MAGIC_FIELDS);
    io->sdb_write(&((sdb_nr_fields_t){ fields->nr_fields }), sizeof(sdb_nr_fields_t), 1, io);

    for (field_t field = 0; field < fields->nr_fields; field++) {
        struct SelvaFieldsAny any;
        int err;

        err = selva_fields_get(fields, field, &any);
        if (err) {
            /* TODO Handle error? */
            continue;
        }

        io->sdb_write(&field, sizeof(field), 1, io);
        switch (any.type) {
        case SELVA_FIELD_TYPE_NULL:
            break;
        case SELVA_FIELD_TYPE_TIMESTAMP:
        case SELVA_FIELD_TYPE_CREATED:
        case SELVA_FIELD_TYPE_UPDATED:
            io->sdb_write(&any.timestamp, sizeof(any.timestamp), 1, io);
            break;
        case SELVA_FIELD_TYPE_NUMBER:
            io->sdb_write(&any.number, sizeof(any.number), 1, io);
            break;
        case SELVA_FIELD_TYPE_INTEGER:
            io->sdb_write(&any.integer, sizeof(any.integer), 1, io);
            break;
        case SELVA_FIELD_TYPE_UINT8:
            io->sdb_write(&any.uint8, sizeof(any.uint8), 1, io);
            break;
        case SELVA_FIELD_TYPE_UINT32:
            io->sdb_write(&any.uint32, sizeof(any.uint32), 1, io);
            break;
        case SELVA_FIELD_TYPE_UINT64:
            io->sdb_write(&any.uint64, sizeof(any.uint64), 1, io);
            break;
        case SELVA_FIELD_TYPE_BOOLEAN:
            io->sdb_write(&any.boolean, sizeof(any.boolean), 1, io);
            break;
        case SELVA_FIELD_TYPE_ENUM:
            io->sdb_write(&any.enu, sizeof(any.enu), 1, io);
            break;
        case SELVA_FIELD_TYPE_STRING:
            save_fields_string(io, any.string);
            break;
        case SELVA_FIELD_TYPE_TEXT:
            save_fields_text(io);
            break;
        case SELVA_FIELD_TYPE_REFERENCE:
            if (any.reference && any.reference->dst) {
                io->sdb_write(&((uint32_t){ 1 }), sizeof(uint32_t), 1, io); /* nr_refs */
                save_fields_reference(io, any.reference);
            } else {
                io->sdb_write(&((uint32_t){ 0 }), sizeof(uint32_t), 1, io); /* nr_refs */
            }
            break;
        case SELVA_FIELD_TYPE_REFERENCES:
            if (any.references && any.references->nr_refs) {
                io->sdb_write(&((uint32_t){ any.references->nr_refs }), sizeof(uint32_t), 1, io); /* nr_refs */
                save_fields_references(io, any.references);
            } else {
                io->sdb_write(&((uint32_t){ 0 }), sizeof(uint32_t), 1, io); /* nr_refs */
            }
            break;
        case SELVA_FIELD_TYPE_WEAK_REFERENCE:
                io->sdb_write(&any.weak_reference, sizeof(any.weak_reference), 1, io);
            break;
        case SELVA_FIELD_TYPE_WEAK_REFERENCES:
            if (any.weak_references.nr_refs) {
                io->sdb_write(&((uint32_t){ any.weak_references.nr_refs }), sizeof(uint32_t), 1, io); /* nr_refs */
                io->sdb_write(any.weak_references.refs, sizeof(struct SelvaNodeWeakReference), any.weak_references.nr_refs, io);
            } else {
                io->sdb_write(&((uint32_t){ 0 }), sizeof(uint32_t), 1, io); /* nr_refs */
            }
            break;
        }
    }
}

static void save_node(struct selva_io *io, struct SelvaNode *node)
{
    save_dump_magic(io, DUMP_MAGIC_NODE);
    io->sdb_write(&node->node_id, sizeof(node_id_t), 1, io);
    io->sdb_write(&node->expire, sizeof(sdb_expire_t), 1, io);
    save_fields(io, &node->fields);
}

static void save_nodes(struct selva_io *io, struct SelvaTypeEntry *te)
{
    struct SelvaNodeIndex *nodes = &te->nodes;
    const sdb_nr_nodes_t nr_nodes = te->nr_nodes;
    struct SelvaNode *node;

    save_dump_magic(io, DUMP_MAGIC_NODES);

    io->sdb_write(&nr_nodes, sizeof(nr_nodes), 1, io);

    RB_FOREACH(node, SelvaNodeIndex, nodes) {
        save_node(io, node);
    }
}

static void save_aliases(struct selva_io *io, struct SelvaTypeEntry *te)
{
    struct SelvaAliases *aliases = &te->aliases;
    const sdb_nr_aliases_t nr_aliases = te->nr_aliases;
    struct SelvaAlias *alias;

    save_dump_magic(io, DUMP_MAGIC_ALIASES);

    io->sdb_write(&nr_aliases, sizeof(nr_aliases), 1, io);

    RB_FOREACH(alias, SelvaAliasesByName, &aliases->alias_by_name) {
        sdb_arr_len_t alias_len = strlen(alias->name);

        io->sdb_write(&alias->dest, sizeof(alias->dest), 1, io);
        io->sdb_write(&alias_len, sizeof(alias_len), 1, io);
        io->sdb_write(alias->name, sizeof(char), alias_len, io);
    }
}

static void save_schema(struct selva_io *io, struct SelvaDb *db)
{
    SVector *types = &db->type_list;
    const sdb_nr_types_t nr_types = SVector_Size(types);
    struct SVectorIterator it;
    struct SelvaTypeEntry *te;

    save_dump_magic(io, DUMP_MAGIC_SCHEMA);
    io->sdb_write(&nr_types, sizeof(nr_types), 1, io);

    SVector_ForeachBegin(&it, types);
    while ((te = vecptr2SelvaTypeEntry(SVector_Foreach(&it)))) {
        node_type_t type = te->type;
        const sdb_arr_len_t schema_len = te->schema_len;

        io->sdb_write(&type, sizeof(type), 1, io);
        io->sdb_write(&schema_len, sizeof(schema_len), 1, io);
        io->sdb_write(te->schema_buf, sizeof(char), te->schema_len, io);
    }
}

static void save_types(struct selva_io *io, struct SelvaDb *db)
{
    SVector *types = &db->type_list;
    struct SVectorIterator it;
    struct SelvaTypeEntry *te;

    save_dump_magic(io, DUMP_MAGIC_TYPES);
    /*
     * We don't save nr_types here again because it's already known from the
     * schema that should have been saved before.
     */

    SVector_ForeachBegin(&it, types);
    while ((te = vecptr2SelvaTypeEntry(SVector_Foreach(&it)))) {
        const node_type_t type = te->type;

        io->sdb_write(&type, sizeof(type), 1, io);
        save_nodes(io, te);
        save_aliases(io, te);
    }
}

static void save_db(struct selva_io *io, struct SelvaDb *db)
{
    save_schema(io, db);
    save_types(io, db);
}

static void print_ready(char *msg, struct timespec * restrict ts_start, struct timespec * restrict ts_end)
{
    struct timespec ts_diff;
    double t;
    const char *t_unit;

    timespec_sub(&ts_diff, ts_end, ts_start);
    t = timespec2ms(&ts_diff);

    if (t < 1e3) {
        t_unit = "ms";
    } else if (t < 60e3) {
        t /= 1e3;
        t_unit = "s";
    } else if (t < 3.6e6) {
        t /= 60e3;
        t_unit = "min";
    } else {
        t /= 3.6e6;
        t_unit = "h";
    }

    fprintf(stderr, "%s ready in %.2f %s", msg, t, t_unit);
}

int io_dump_save_async(struct SelvaDb *db, const char *filename)
{
    pid_t pid;

    pid = fork();
    if (pid == 0) {
        struct selva_io io;
        uint8_t hash[SELVA_IO_HASH_SIZE];
        struct timespec ts_start, ts_end;
        int err;

        ts_monotime(&ts_start);

        err = selva_io_init_file(&io, filename, SELVA_IO_FLAGS_WRITE | SELVA_IO_FLAGS_COMPRESSED);
        if (err) {
            return err;
        }

        save_db(&io, db);
        selva_io_end(&io, NULL, hash);

        ts_monotime(&ts_end);
        print_ready("save", &ts_start, &ts_end);

        quick_exit(EXIT_SUCCESS);
    } else if (pid < 0) {
        return SELVA_EGENERAL;
    }

    return 0;
}

static void load_schema(struct selva_io *io, struct SelvaDb *db)
{
    if (!read_dump_magic(io, DUMP_MAGIC_SCHEMA)) {
        db_panic("Schema not found");
    }

    sdb_nr_types_t nr_types;
    if (io->sdb_read(&nr_types, sizeof(nr_types), 1, io) != 1) {
        db_panic("nr_types schema");
    }

    for (size_t i = 0; i < nr_types; i++) {
        node_type_t type;
        char *schema_buf;
        sdb_arr_len_t schema_len;
        int err;

        io->sdb_read(&type, sizeof(type), 1, io);
        io->sdb_read(&schema_len, sizeof(schema_len), 1, io);
        schema_buf = selva_malloc(schema_len);
        io->sdb_read(schema_buf, sizeof(char), schema_len, io);

        err = db_schema_create(db, type, schema_buf, schema_len);
        if (err) {
            db_panic("Failed to create a node type entry: %s", selva_strerror(err));
        }
        selva_free(schema_buf);
    }
}

static void load_field_timestamp(struct selva_io *io, struct SelvaNodeSchema *ns, struct SelvaNode *node, struct SelvaFieldSchema *fs, field_t field)
{
    /* TODO load timestamp */
}

static void load_field_number(struct selva_io *io, struct SelvaNodeSchema *ns, struct SelvaNode *node, struct SelvaFieldSchema *fs, field_t field)
{
    /* TODO load number */
}

static void load_field_integer(struct selva_io *io, struct SelvaNodeSchema *ns, struct SelvaNode *node, struct SelvaFieldSchema *fs, field_t field)
{
    /* TODO load integer */
}

static void load_field_uint8(struct selva_io *io, struct SelvaNodeSchema *ns, struct SelvaNode *node, struct SelvaFieldSchema *fs, field_t field)
{
    /* TODO load uint8 */
}

static void load_field_uint32(struct selva_io *io, struct SelvaNodeSchema *ns, struct SelvaNode *node, struct SelvaFieldSchema *fs, field_t field)
{
    /* TODO load uint32 */
}

static void load_field_uint64(struct selva_io *io, struct SelvaNodeSchema *ns, struct SelvaNode *node, struct SelvaFieldSchema *fs, field_t field)
{
    /* TODO load uint64 */
}

static void load_field_boolean(struct selva_io *io, struct SelvaNodeSchema *ns, struct SelvaNode *node, struct SelvaFieldSchema *fs, field_t field)
{
    /* TODO load boolean */
}

static void load_field_enum(struct selva_io *io, struct SelvaNodeSchema *ns, struct SelvaNode *node, struct SelvaFieldSchema *fs, field_t field)
{
    /* TODO load enum */
}

static void load_field_string(struct selva_io *io, struct SelvaNodeSchema *ns, struct SelvaNode *node, struct SelvaFieldSchema *fs, field_t field)
{
    /* TODO load string */
}

static void load_field_text(struct selva_io *io, struct SelvaNodeSchema *ns, struct SelvaNode *node, struct SelvaFieldSchema *fs, field_t field)
{
    /* TODO load text */
}

static void load_field_reference(struct selva_io *io, struct SelvaNodeSchema *ns, struct SelvaNode *node, struct SelvaFieldSchema *fs, field_t field)
{
    /* TODO load reference */
}

static void load_field_references(struct selva_io *io, struct SelvaNodeSchema *ns, struct SelvaNode *node, struct SelvaFieldSchema *fs, field_t field)
{
    /* TODO load references */
}

static void load_field_weak_reference(struct selva_io *io, struct SelvaNodeSchema *ns, struct SelvaNode *node, struct SelvaFieldSchema *fs, field_t field)
{
    /* TODO load weak reference */
}

static void load_field_weak_references(struct selva_io *io, struct SelvaNodeSchema *ns, struct SelvaNode *node, struct SelvaFieldSchema *fs, field_t field)
{
    /* TODO load weak references */
}

static void load_fields(struct selva_io *io, struct SelvaTypeEntry *te, struct SelvaNode *node)
{
    struct SelvaNodeSchema *ns = &te->ns;

    if (!read_dump_magic(io, DUMP_MAGIC_FIELDS)) {
        db_panic("load fields: %d:%d", node->type, node->node_id);
    }

    sdb_nr_fields_t nr_fields;
    io->sdb_read(&nr_fields, sizeof(nr_fields), 1, io);

    for (sdb_nr_fields_t i = 0; i < nr_fields; i++) {
        field_t field;
        struct SelvaFieldSchema *fs;

        io->sdb_read(&field, sizeof(field), 1, io);
        fs = db_get_fs_by_ns_field(ns, field);

        switch (fs->type) {
        case SELVA_FIELD_TYPE_NULL:
            break;
        case SELVA_FIELD_TYPE_TIMESTAMP:
        case SELVA_FIELD_TYPE_CREATED:
        case SELVA_FIELD_TYPE_UPDATED:
            load_field_timestamp(io, ns, node, fs, field);
            break;
        case SELVA_FIELD_TYPE_NUMBER:
            load_field_number(io, ns, node, fs, field);
            break;
        case SELVA_FIELD_TYPE_INTEGER:
            load_field_number(io, ns, node, fs, field);
            break;
        case SELVA_FIELD_TYPE_UINT8:
            load_field_uint8(io, ns, node, fs, field);
            break;
        case SELVA_FIELD_TYPE_UINT32:
            load_field_uint32(io, ns, node, fs, field);
            break;
        case SELVA_FIELD_TYPE_UINT64:
            load_field_uint64(io, ns, node, fs, field);
            break;
        case SELVA_FIELD_TYPE_BOOLEAN:
            load_field_boolean(io, ns, node, fs, field);
            break;
        case SELVA_FIELD_TYPE_ENUM:
            load_field_enum(io, ns, node, fs, field);
            break;
        case SELVA_FIELD_TYPE_STRING:
            load_field_string(io, ns, node, fs, field);
            break;
        case SELVA_FIELD_TYPE_TEXT:
            load_field_text(io, ns, node, fs, field);
            break;
        case SELVA_FIELD_TYPE_REFERENCE:
            load_field_reference(io, ns, node, fs, field);
            break;
        case SELVA_FIELD_TYPE_REFERENCES:
            load_field_references(io, ns, node, fs, field);
            break;
        case SELVA_FIELD_TYPE_WEAK_REFERENCE:
            load_field_weak_reference(io, ns, node, fs, field);
            break;
        case SELVA_FIELD_TYPE_WEAK_REFERENCES:
            load_field_weak_references(io, ns, node, fs, field);
        }
    }
}

static void load_node(struct selva_io *io, struct SelvaTypeEntry *te)
{
    if (!read_dump_magic(io, DUMP_MAGIC_NODE)) {
        db_panic("load node");
    }

    node_id_t node_id;
    io->sdb_read(&node_id, sizeof(node_id), 1, io);

    sdb_expire_t expire;
    io->sdb_read(&expire, sizeof(expire), 1, io);

    struct SelvaNode *node = db_upsert_node(te, node_id);
    /* TODO set expire */
    load_fields(io, te, node);
}

static void load_nodes(struct selva_io *io, struct SelvaTypeEntry *te)
{
    if (!read_dump_magic(io, DUMP_MAGIC_NODES)) {
        db_panic("Schema not found");
    }

    sdb_nr_nodes_t nr_nodes;
    io->sdb_read(&nr_nodes, sizeof(nr_nodes), 1, io);

    for (sdb_nr_nodes_t i = 0; i < nr_nodes; i++) {
        load_node(io, te);
    }
}

static void load_aliases(struct selva_io *io, struct SelvaTypeEntry *te)
{
    if (!read_dump_magic(io, DUMP_MAGIC_ALIASES)) {
        db_panic("Schema not found");
    }

    /* TODO */
}

static void load_types(struct selva_io *io, struct SelvaDb *db)
{
    SVector *types = &db->type_list;
    struct SVectorIterator it;
    struct SelvaTypeEntry *te;

    if (!read_dump_magic(io, DUMP_MAGIC_TYPES)) {
        db_panic("Schema not found");
    }

    SVector_ForeachBegin(&it, types);
    while ((te = vecptr2SelvaTypeEntry(SVector_Foreach(&it)))) {
        node_type_t type;

        io->sdb_read(&type, sizeof(type), 1, io);
        if (type != te->type) {
            db_panic("Incorrect type found");
        }

        load_nodes(io, te);
        load_aliases(io, te);
    }
}

static struct SelvaDb *load_db(struct selva_io *io)
{
    struct SelvaDb *db = db_create();

    load_schema(io, db);
    load_types(io, db);

    return db;
}

int io_dump_load(const char *filename, struct SelvaDb **db_out)
{
    struct selva_io io;
    struct timespec ts_start, ts_end;
    struct SelvaDb *db;
    int err;

    ts_monotime(&ts_start);

    err = selva_io_init_file(&io, filename, SELVA_IO_FLAGS_READ | SELVA_IO_FLAGS_COMPRESSED);
    if (err) {
        return err;
    }

    db = load_db(&io);
    selva_io_end(&io, NULL, NULL);

    ts_monotime(&ts_end);
    print_ready("load", &ts_start, &ts_end);

    *db_out = db;
    return 0;
}
