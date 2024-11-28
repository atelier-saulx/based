/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>
#include "jemalloc.h"
#include "util/ctime.h"
#include "util/selva_string.h"
#include "util/sigstr.h"
#include "util/timestamp.h"
#include "selva/fields.h"
#include "selva/selva_hash128.h"
#include "selva_error.h"
#include "selva_lang_code.h"
#include "../db.h"
#include "../db_panic.h"
#include "../io.h"
#include "../print_ready.h"
#include "io_struct.h"

#define USE_DUMP_MAGIC_FIELD_BEGIN 0
#define PRINT_SAVE_TIME 0

/*
 * Pick 32-bit primes for these.
 */
#define DUMP_MAGIC_SCHEMA       3360690301 /* common.sdb */
#define DUMP_MAGIC_TYPES        3550908863 /* [range].sdb */
#define DUMP_MAGIC_NODE         3323984057
#define DUMP_MAGIC_FIELDS       3126175483
#if USE_DUMP_MAGIC_FIELD_BEGIN
#define DUMP_MAGIC_FIELD_BEGIN  3734376047
#endif
#define DUMP_MAGIC_FIELD_END    2944546091
#define DUMP_MAGIC_ALIASES      4019181209

/*
 * Helper types for portable serialization.
 * Picking the right type:
 * 1. Use one of these types
 * 2. Use one of the specified-width types in ../db.h
 * 3. Use a specified-width type from stdint.h
 * 4. Use a BitInt type
 * 5. Use the original type
 */
typedef uint32_t sdb_nr_types_t;
typedef uint32_t sdb_nr_nodes_t;
typedef uint32_t sdb_nr_fields_t;
typedef uint64_t sdb_nr_aliases_t;
typedef uint32_t sdb_arr_len_t; /*!< Used for most arrays, string or object. */

#define SDB_STRING_META_FLAGS_MASK (SELVA_STRING_CRC | SELVA_STRING_COMPRESS)

struct sdb_string_meta {
    uint32_t crc;
    sdb_arr_len_t len;
    enum selva_string_flags flags; /*!< Saved flags SDB_STRING_META_FLAGS_MASK. */
} __packed;

struct sdb_text_meta {
    uint32_t crc;
    sdb_arr_len_t len;
    enum selva_lang_code lang;
    enum selva_string_flags flags; /*!< Saved flags SDB_STRING_META_FLAGS_MASK. */
};

static void save_fields(struct selva_io *io, struct SelvaDb *db, struct SelvaFields *fields);

/**
 * Write one of the magic numbers to the dump.
 */
static void write_dump_magic(struct selva_io *io, uint32_t magic)
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

static void save_field_string(struct selva_io *io, struct selva_string *string)
{
    size_t len;
    const char *str = selva_string_to_str(string, &len);
    struct sdb_string_meta meta = {
        .flags = selva_string_get_flags(string) & SDB_STRING_META_FLAGS_MASK,
        .crc = selva_string_get_crc(string),
        .len = len,
    };

    if (!selva_string_verify_crc(string)) {
        db_panic("%p Invalid CRC: %u", string, (unsigned)meta.crc);
    }

    io->sdb_write(&meta, sizeof(meta), 1, io);
    io->sdb_write(str, sizeof(char), meta.len, io);
}

static void save_field_text(struct selva_io *io, struct SelvaTextField *text)
{
    const uint8_t len = text->len;

    io->sdb_write(&len, sizeof(len), 1, io);

    for (uint8_t i = 0; i < len; i++) {
        struct selva_string *tl = &text->tl[i];
        size_t len;
        const char *str = selva_string_to_str(tl, &len);
        struct sdb_text_meta meta = {
            .flags = selva_string_get_flags(tl) & SDB_STRING_META_FLAGS_MASK,
            .crc = selva_string_get_crc(tl),
            .len = len,
            .lang = tl->lang,
        };

        if (!selva_string_verify_crc(tl)) {
            db_panic("%p Invalid CRC: %u", tl, (unsigned)meta.crc);
        }

        io->sdb_write(&meta, sizeof(meta), 1, io);
        io->sdb_write(str, sizeof(char), len, io);
    }
}

static void save_ref(struct selva_io *io, struct SelvaNodeReference *ref)
{
    const uint8_t meta_present = !!ref->meta;

    io->sdb_write(&ref->dst->node_id, sizeof(node_id_t), 1, io);
    io->sdb_write(&meta_present, sizeof(meta_present), 1, io);
    if (meta_present) {
        /*
         * We don't pass the db here to prevent any attempt to access node schema.
         */
        save_fields(io, nullptr, ref->meta);
    }
}

/**
 * Save references.
 * The caller must save nr_refs.
 */
static void save_field_references(struct selva_io *io, struct SelvaNodeReferences *refs)
{
    for (size_t i = 0; i < refs->nr_refs; i++) {
        struct SelvaNodeReference *ref = &refs->refs[i];

        if (ref && ref->dst) {
            save_ref(io, ref);
        } else {
            /* TODO Handle NULL */
            db_panic("ref in refs shouldn't be NULL");
        }
    }
}

static void save_fields(struct selva_io *io, struct SelvaDb *db, struct SelvaFields *fields)
{
    const size_t nr_fields = fields->nr_fields;

    write_dump_magic(io, DUMP_MAGIC_FIELDS);
    io->sdb_write(&((sdb_nr_fields_t){ fields->nr_fields }), sizeof(sdb_nr_fields_t), 1, io);

    for (field_t field = 0; field < nr_fields; field++) {
        struct SelvaFieldsAny any;

        any = selva_fields_get2(fields, field);
        if (any.type == SELVA_FIELD_TYPE_REFERENCE ||
            any.type == SELVA_FIELD_TYPE_REFERENCES) {
            /*
             * Assuming these field types can only exist in a SelvaNode, we can
             * do the following:
             */
            struct SelvaNode *node = containerof(fields, struct SelvaNode, fields);
            const struct SelvaFieldSchema *fs = selva_get_fs_by_node(db, node, field);

#if 0
            assert(fs->type == any.type);
#endif

            if (fs->edge_constraint.flags & EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP) {
                /* This saves it as a NULL and the loader will skip it. */
#if 0
                fprintf(stderr, "Skip %d (refs %d) on type %d\n", field, any.type == SELVA_FIELD_TYPE_REFERENCES, node->type);
#endif
                any.type = SELVA_FIELD_TYPE_NULL;
            }
        }

#if USE_DUMP_MAGIC_FIELD_BEGIN
        write_dump_magic(io, DUMP_MAGIC_FIELD_BEGIN);
#endif
        io->sdb_write(&field, sizeof(field), 1, io);
        io->sdb_write(&any.type, sizeof(enum SelvaFieldType), 1, io);
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
        case SELVA_FIELD_TYPE_INT8:
        case SELVA_FIELD_TYPE_UINT8:
            io->sdb_write(&any.uint8, sizeof(any.uint8), 1, io);
            break;
        case SELVA_FIELD_TYPE_INT16:
        case SELVA_FIELD_TYPE_UINT16:
            io->sdb_write(&any.uint16, sizeof(any.uint16), 1, io);
            break;
        case SELVA_FIELD_TYPE_INT32:
        case SELVA_FIELD_TYPE_UINT32:
            io->sdb_write(&any.uint32, sizeof(any.uint32), 1, io);
            break;
        case SELVA_FIELD_TYPE_INT64:
        case SELVA_FIELD_TYPE_UINT64:
            io->sdb_write(&any.uint64, sizeof(any.uint64), 1, io);
            break;
        case SELVA_FIELD_TYPE_BOOLEAN:
            io->sdb_write(&(uint8_t){ any.boolean }, sizeof(uint8_t), 1, io);
            break;
        case SELVA_FIELD_TYPE_ENUM:
            io->sdb_write(&any.enu, sizeof(any.enu), 1, io);
            break;
        case SELVA_FIELD_TYPE_STRING:
            save_field_string(io, any.string);
            break;
        case SELVA_FIELD_TYPE_TEXT:
            save_field_text(io, any.text);
            break;
        case SELVA_FIELD_TYPE_REFERENCE:
            if (any.reference && any.reference->dst) {
                const sdb_arr_len_t nr_refs = 1;

                io->sdb_write(&nr_refs, sizeof(nr_refs), 1, io); /* nr_refs */
                save_ref(io, any.reference);
            } else {
                io->sdb_write(&((uint32_t){ 0 }), sizeof(uint32_t), 1, io); /* nr_refs */
            }
            break;
        case SELVA_FIELD_TYPE_REFERENCES:
            if (any.references && any.references->nr_refs) {
                const sdb_arr_len_t nr_refs = any.references->nr_refs;

                io->sdb_write(&nr_refs, sizeof(nr_refs), 1, io); /* nr_refs */
                save_field_references(io, any.references);
            } else {
                io->sdb_write(&((uint32_t){ 0 }), sizeof(uint32_t), 1, io); /* nr_refs */
            }
            break;
        case SELVA_FIELD_TYPE_WEAK_REFERENCE:
                io->sdb_write(&any.weak_reference, sizeof(any.weak_reference), 1, io);
            break;
        case SELVA_FIELD_TYPE_WEAK_REFERENCES:
            if (any.weak_references.nr_refs) {
                const sdb_arr_len_t nr_refs = any.weak_references.nr_refs;

                io->sdb_write(&nr_refs, sizeof(nr_refs), 1, io); /* nr_refs */
                io->sdb_write(any.weak_references.refs, sizeof(struct SelvaNodeWeakReference), any.weak_references.nr_refs, io);
            } else {
                io->sdb_write(&((uint32_t){ 0 }), sizeof(uint32_t), 1, io); /* nr_refs */
            }
            break;
        case SELVA_FIELD_TYPE_MICRO_BUFFER:
            io->sdb_write(any.smb, sizeof(uint8_t), sizeof(*any.smb) + any.smb->len, io);
            /* TODO Verify CRC */
            break;
        case SELVA_FIELD_TYPE_ALIAS:
        case SELVA_FIELD_TYPE_ALIASES:
            /* NOP */
            break;
        }

        write_dump_magic(io, DUMP_MAGIC_FIELD_END);
    }
}

static void save_node(struct selva_io *io, struct SelvaDb *db, struct SelvaNode *node)
{
    write_dump_magic(io, DUMP_MAGIC_NODE);
    io->sdb_write(&node->node_id, sizeof(node_id_t), 1, io);
    save_fields(io, db, &node->fields);
}

static void save_aliases_node(struct selva_io *io, struct SelvaTypeEntry *te, node_id_t node_id)
{
    const sdb_nr_aliases_t nr_aliases = te->nr_aliases;

    write_dump_magic(io, DUMP_MAGIC_ALIASES);
    io->sdb_write(&nr_aliases, sizeof(nr_aliases), 1, io);

    for (size_t i = 0; i < nr_aliases; i++) {
        struct SelvaAliases *aliases = &te->aliases[i];
        const struct SelvaAlias *alias_first;
        const struct SelvaAlias *alias;
        sdb_nr_aliases_t n = 0;


        alias_first = alias = selva_get_alias_by_dest(aliases, node_id);
        while (alias_first && (alias = alias->next)) {
            n++;
        }

        io->sdb_write(&n, sizeof(n), 1, io);
        if (n == 0) {
            /* No aliases on this field. */
            continue;
        }

        alias = alias_first;
        while ((alias = alias->next)) {
            const char *name_str = alias->name;
            const size_t name_len = strlen(name_str);

            io->sdb_write(&name_len, sizeof(name_len), 1, io);
            io->sdb_write(name_str, sizeof(*name_str), name_len, io);
        }
    }
}

static void save_schema(struct selva_io *io, struct SelvaDb *db)
{
    SVector *types = &db->type_list;
    const sdb_nr_types_t nr_types = SVector_Size(types);
    struct SVectorIterator it;
    struct SelvaTypeEntry *te;

    write_dump_magic(io, DUMP_MAGIC_SCHEMA);
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

__used static char *hash_to_hex(char s[2 * SELVA_IO_HASH_SIZE], const uint8_t hash[SELVA_IO_HASH_SIZE])
{
    static const char map[] = "0123456789abcdef";
    char *p = s;

    for (size_t i = 0; i < SELVA_IO_HASH_SIZE; i++) {
        *p++ = map[(hash[i] >> 4) % sizeof(map)];
        *p++ = map[(hash[i] & 0x0f) % sizeof(map)];
    }

    return s;
}

int selva_dump_save_common(struct SelvaDb *db, const char *filename)
{
    struct selva_io io;
    int err;

    err = selva_io_init_file(&io, filename, SELVA_IO_FLAGS_WRITE | SELVA_IO_FLAGS_COMPRESSED);
    if (err) {
        return err;
    }

    /*
     * Save all the common data here that can't be split up.
     */
    save_schema(&io, db);

    selva_io_end(&io, nullptr);
    return 0;
}

static sdb_nr_nodes_t get_node_range(struct SelvaTypeEntry *te, node_id_t start, node_id_t end, struct SelvaNode **start_node)
{
    struct SelvaNode *node;
    sdb_nr_nodes_t n = 0;

    node = selva_nfind_node(te, start);
    if (!node || node->node_id > end) {
        return 0;
    }

    *start_node = node;

    do {
        n++;
        node = selva_next_node(te, node);
    } while (node && node->node_id <= end);

    return n;
}

int selva_dump_save_range(struct SelvaDb *db, struct SelvaTypeEntry *te, const char *filename, node_id_t start, node_id_t end, selva_hash128_t *range_hash_out)
{
#if PRINT_SAVE_TIME
    struct timespec ts_start, ts_end;
#endif
    struct selva_io io;
    int err;

#if PRINT_SAVE_TIME
    ts_monotime(&ts_start);
#endif

    err = selva_io_init_file(&io, filename, SELVA_IO_FLAGS_WRITE | SELVA_IO_FLAGS_COMPRESSED);
    if (err) {
        return err;
    }

    write_dump_magic(&io, DUMP_MAGIC_TYPES);
    io.sdb_write(&te->type, sizeof(te->type), 1, &io);

    struct SelvaNode *node;
    const sdb_nr_nodes_t nr_nodes = get_node_range(te, start, end, &node);
    selva_hash_state_t *hash_state = selva_hash_create_state();
    selva_hash_state_t *tmp_hash_state = selva_hash_create_state();

    selva_hash_reset(hash_state);
    io.sdb_write(&nr_nodes, sizeof(nr_nodes), 1, &io);

    if (nr_nodes > 0) {
        do {
            selva_hash128_t node_hash;

            node_hash = selva_node_hash_update(te, node, tmp_hash_state);
            selva_hash_update(hash_state, &node_hash, sizeof(node_hash));
            save_node(&io, db, node);
            save_aliases_node(&io, te, node->node_id);

            node = selva_next_node(te, node);
        } while (node && node->node_id <= end);
    }

    *range_hash_out = selva_hash_digest(hash_state);
    selva_hash_free_state(hash_state);
    selva_hash_free_state(tmp_hash_state);

    selva_io_end(&io, nullptr);

#if PRINT_SAVE_TIME
    ts_monotime(&ts_end);
    print_ready("save", &ts_start, &ts_end, "hash: %.*s range_hash: %.*s\n",
            2 * SELVA_IO_HASH_SIZE, hash_to_hex((char [2 * SELVA_IO_HASH_SIZE]){ 0 }, io.computed_hash),
            2 * SELVA_IO_HASH_SIZE, hash_to_hex((char [2 * SELVA_IO_HASH_SIZE]){ 0 }, (const uint8_t *)range_hash_out));
#endif

    return 0;
}

static void load_schema(struct selva_io *io, struct SelvaDb *db)
{
    sdb_nr_types_t nr_types;

    if (!read_dump_magic(io, DUMP_MAGIC_SCHEMA)) {
        db_panic("Invalid schema magic");
    }

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

        err = selva_db_schema_create(db, type, schema_buf, schema_len);
        if (err) {
            db_panic("Failed to create a node type entry: %s", selva_strerror(err));
        }
        selva_free(schema_buf);
    }
}

static int load_string(struct selva_io *io, struct selva_string *s, const struct sdb_string_meta *meta)
{
    if (io->sdb_read(selva_string_to_mstr(s, nullptr), sizeof(char), meta->len, io) != meta->len * sizeof(char)) {
        selva_string_free(s);
        return SELVA_EIO;
    }

    selva_string_set_crc(s, meta->crc);

    return 0;
}

static int load_field_string(struct selva_io *io, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    struct sdb_string_meta meta;
    struct selva_string *s;
    int err;

    io->sdb_read(&meta, sizeof(meta), 1, io);
    err = selva_fields_get_mutable_string(node, fs, meta.len, &s);
    if (err) {
        return err;
    }

    return load_string(io, s, &meta);
}

static int load_reference_meta_field_string(
        struct selva_io *io,
        struct SelvaNode *node,
        struct SelvaNodeReference *ref,
        const struct EdgeFieldConstraint *efc,
        field_t field)
{
    struct sdb_string_meta meta;
    struct selva_string *s;
    int err;

    io->sdb_read(&meta, sizeof(meta), 1, io);
    err = selva_fields_get_reference_meta_mutable_string(node, ref, efc, field, meta.len, &s);
    if (err) {
        return err;
    }

    return load_string(io, s, &meta);
}

static int load_field_text(struct selva_io *io, struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    uint8_t len;

    io->sdb_read(&len, sizeof(len), 1, io);

    for (uint8_t i = 0; i < len; i++) {
        struct sdb_text_meta meta;
        char *str;

        io->sdb_read(&meta, sizeof(meta), 1, io);
        str = selva_malloc(meta.len); /* TODO Optimize */
        io->sdb_read(str, sizeof(char), meta.len, io);
        selva_fields_set_text_crc(db, node, fs, meta.lang, str, meta.len, meta.crc);
        selva_free(str);
    }

    return 0;
}

/**
 * Load meta fields of an edge in an edge field of node.
 */
static void load_reference_meta(
        struct selva_io *io,
        struct SelvaNode *node,
        struct SelvaNodeReference *ref, const struct EdgeFieldConstraint *efc)
{
    if (!read_dump_magic(io, DUMP_MAGIC_FIELDS)) {
        db_panic("Load ref meta fields of %d:%d: Invalid magic", node->type, node->node_id);
    }

    sdb_nr_fields_t nr_fields;
    io->sdb_read(&nr_fields, sizeof(nr_fields), 1, io);

    for (sdb_nr_fields_t i = 0; i < nr_fields; i++) {
        struct {
            field_t field;
            enum SelvaFieldType type;
        } __packed rd;
        const struct SelvaFieldSchema *fs;

#if USE_DUMP_MAGIC_FIELD_BEGIN
        if (!read_dump_magic(io, DUMP_MAGIC_FIELD_BEGIN)) {
            db_panic("Invalid field begin magic for %d:%d",
                     node->type, node->node_id);
        }
#endif

        io->sdb_read(&rd, sizeof(rd), 1, io);

        fs = get_fs_by_fields_schema_field(efc->fields_schema, rd.field);
        if (!fs) {
            db_panic("Field schema not found for the field %d", rd.field);
        }
        if (rd.type != SELVA_FIELD_TYPE_NULL && rd.type != fs->type) {
            db_panic("Invalid field type found %d != %d",
                     rd.type, fs->type);
        }

        const size_t value_size = selva_fields_get_data_size(fs);
        char value_buf[value_size];
        int err = SELVA_EINVAL;

        switch (fs->type) {
        case SELVA_FIELD_TYPE_NULL:
            err = 0;
            break;
        case SELVA_FIELD_TYPE_TIMESTAMP:
        case SELVA_FIELD_TYPE_CREATED:
        case SELVA_FIELD_TYPE_UPDATED:
        case SELVA_FIELD_TYPE_NUMBER:
        case SELVA_FIELD_TYPE_INTEGER:
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
        case SELVA_FIELD_TYPE_WEAK_REFERENCE:
        case SELVA_FIELD_TYPE_WEAK_REFERENCES:
            /* TODO check return value */
            io->sdb_read(value_buf, sizeof(char), value_size, io);
            err = selva_fields_set_reference_meta(node, ref, efc, rd.field, value_buf, value_size);
            break;
        case SELVA_FIELD_TYPE_STRING:
            err = load_reference_meta_field_string(io, node, ref, efc, rd.field);
            break;
        case SELVA_FIELD_TYPE_TEXT:
            /* TODO Text field support in meta */
#if 0
            err = load_field_text(io, db, ns, node, fs);
#endif
            break;
        case SELVA_FIELD_TYPE_REFERENCE:
        case SELVA_FIELD_TYPE_REFERENCES:
            db_panic("References not supported in edge meta");
        case SELVA_FIELD_TYPE_MICRO_BUFFER:
            db_panic("Muffer not supported in edge meta");
        case SELVA_FIELD_TYPE_ALIAS:
        case SELVA_FIELD_TYPE_ALIASES:
            /* NOP */
            break;
        }
        if (err) {
            db_panic("Failed to set field (%d:%d:%d): %s",
                     node->type, node->node_id, rd.field,
                     selva_strerror(err));
        }

        if (!read_dump_magic(io, DUMP_MAGIC_FIELD_END)) {
            db_panic("Invalid field end magic for %d:%d.%d",
                     node->type, node->node_id, rd.field);
        }
    }
}

static int load_ref(struct selva_io *io, struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, field_t field)
{
    node_id_t dst_id;
    uint8_t meta_present;
    int err;

    io->sdb_read(&dst_id, sizeof(dst_id), 1, io);
    io->sdb_read(&meta_present, sizeof(meta_present), 1, io);

    struct SelvaTypeEntry *dst_te = selva_get_type_by_index(db, fs->edge_constraint.dst_node_type);
    struct SelvaNode *dst_node = selva_upsert_node(dst_te, dst_id);

    err = selva_fields_set(db, node, fs, dst_node, sizeof(dst_node));
    if (err) {
        return SELVA_EIO;
    }

    if (meta_present) {
        struct SelvaFieldsAny any;

        any = selva_fields_get2(&node->fields, field);
        if (any.type == SELVA_FIELD_TYPE_NULL) {
            return SELVA_ENOENT;
        } else if (any.type == SELVA_FIELD_TYPE_REFERENCE) {
            assert(any.reference);
            load_reference_meta(io, node, any.reference, &fs->edge_constraint);
        } else if (any.type == SELVA_FIELD_TYPE_REFERENCES) {
            const size_t len = any.references->nr_refs;
            struct SelvaNodeReference *refs = any.references->refs;

            /* TODO We really need a better implementation for this! */
            for (size_t i = 0; i < len; i++) {
                if (refs[i].dst == dst_node) {
                    load_reference_meta(io, node, &refs[i], &fs->edge_constraint);
                    break;
                }
            }
        }
    }

    return 0;
}

static int load_field_reference(struct selva_io *io, struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, field_t field)
{
    sdb_arr_len_t nr_refs;

    io->sdb_read(&nr_refs, sizeof(nr_refs), 1, io);
    return (nr_refs) ? load_ref(io, db, node, fs, field) : 0;
}

static int load_field_references(struct selva_io *io, struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, field_t field)
{
    sdb_arr_len_t nr_refs;

    io->sdb_read(&nr_refs, sizeof(nr_refs), 1, io);
    for (sdb_arr_len_t i = 0; i < nr_refs; i++) {
        load_ref(io, db, node, fs, field);
    }

    return 0;
}

static int load_field_weak_references(struct selva_io *io, struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    sdb_arr_len_t nr_refs;

    /*
     * TODO This could be optimized by reading them all at Once.
     */
    io->sdb_read(&nr_refs, sizeof(nr_refs), 1, io);
    for (sdb_arr_len_t i = 0; i < nr_refs; i++) {
        struct SelvaNodeWeakReference reference;
        int err;

        io->sdb_read(&reference, sizeof(reference), 1, io);
        err = selva_fields_set(db, node, fs, &reference, 1);
        if (err) {
            return err;
        }
    }

    return 0;
}

static int load_field_micro_buffer(struct selva_io *io, struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    int err;

    /* Hack to create the field. */
    err = selva_fields_set(db, node, fs, (uint8_t []){ 0 }, 1);
    if (err) {
        return err;
    }

    struct SelvaFieldsAny any;
    any = selva_fields_get2(&node->fields, fs->field);

    io->sdb_read(&any.smb->len, sizeof(any.smb->len), 1, io);
    io->sdb_read(any.smb->data, sizeof(uint8_t), any.smb->len, io);

    return 0;
}

static void load_node_fields(struct selva_io *io, struct SelvaDb *db, struct SelvaTypeEntry *te, struct SelvaNode *node)
{
    struct SelvaNodeSchema *ns = &te->ns;
    sdb_nr_fields_t nr_fields;

    if (!read_dump_magic(io, DUMP_MAGIC_FIELDS)) {
        db_panic("Invalid magic for node fields load fields of %d:%d", node->type, node->node_id);
    }

    io->sdb_read(&nr_fields, sizeof(nr_fields), 1, io);
    for (sdb_nr_fields_t i = 0; i < nr_fields; i++) {
        struct {
            field_t field;
            enum SelvaFieldType type;
        } __packed rd;
        const struct SelvaFieldSchema *fs;

#if USE_DUMP_MAGIC_FIELD_BEGIN
        if (!read_dump_magic(io, DUMP_MAGIC_FIELD_BEGIN)) {
            db_panic("Invalid field begin magic for %d:%d",
                     node->type, node->node_id);
        }
#endif

        io->sdb_read(&rd, sizeof(rd), 1, io);

        fs = selva_get_fs_by_ns_field(ns, rd.field);
        if (!fs) {
            db_panic("Field Schema not found for %d:%d.%d",
                      node->type, node->node_id, rd.field);
        }
        if (rd.type != SELVA_FIELD_TYPE_NULL && rd.type != fs->type) {
            db_panic("Invalid field type found for %d:%d.%d: %d != %d\n",
                     node->type, node->node_id, fs->field,
                     rd.type, fs->type);
        }

        const size_t value_size = selva_fields_get_data_size(fs);
        char value_buf[value_size];
        int err = SELVA_EINVAL;

        switch (rd.type) {
        case SELVA_FIELD_TYPE_NULL:
            err = 0;
            break;
        case SELVA_FIELD_TYPE_TIMESTAMP:
        case SELVA_FIELD_TYPE_CREATED:
        case SELVA_FIELD_TYPE_UPDATED:
        case SELVA_FIELD_TYPE_NUMBER:
        case SELVA_FIELD_TYPE_INTEGER:
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
        case SELVA_FIELD_TYPE_WEAK_REFERENCE:
            /* TODO check return value */
            io->sdb_read(value_buf, sizeof(char), value_size, io);
            err = selva_fields_set(db, node, fs, value_buf, value_size);
            break;
        case SELVA_FIELD_TYPE_STRING:
            err = load_field_string(io, node, fs);
            break;
        case SELVA_FIELD_TYPE_TEXT:
            err = load_field_text(io, db, node, fs);
            break;
        case SELVA_FIELD_TYPE_REFERENCE:
            err = load_field_reference(io, db, node, fs, rd.field);
            break;
        case SELVA_FIELD_TYPE_REFERENCES:
            err = load_field_references(io, db, node, fs, rd.field);
            break;
        case SELVA_FIELD_TYPE_WEAK_REFERENCES:
            err = load_field_weak_references(io, db, node, fs);
            break;
        case SELVA_FIELD_TYPE_MICRO_BUFFER:
            err = load_field_micro_buffer(io, db, node, fs);
            break;
        case SELVA_FIELD_TYPE_ALIAS:
        case SELVA_FIELD_TYPE_ALIASES:
            /* NOP */
            break;
        }
        if (err) {
            db_panic("Failed to set field (%d:%d:%d): %s",
                     node->type, node->node_id, rd.field,
                     selva_strerror(err));
        }

        if (!read_dump_magic(io, DUMP_MAGIC_FIELD_END)) {
            db_panic("Invalid field end magic for %d:%d.%d",
                     node->type, node->node_id, rd.field);
        }
    }
}

static node_id_t load_node(struct selva_io *io, struct SelvaDb *db, struct SelvaTypeEntry *te)
{
    if (!read_dump_magic(io, DUMP_MAGIC_NODE)) {
        db_panic("Invalid node magic for type %d", te->type);
    }

    node_id_t node_id;
    io->sdb_read(&node_id, sizeof(node_id), 1, io);

    struct SelvaNode *node = selva_upsert_node(te, node_id);
    assert(node->type == te->type);
    load_node_fields(io, db, te, node);

    return node_id;
}

static void load_aliases_node(struct selva_io *io, struct SelvaTypeEntry *te, node_id_t node_id)
{
    sdb_nr_aliases_t nr_aliases;

    if (!read_dump_magic(io, DUMP_MAGIC_ALIASES)) {
        db_panic("Invalid aliases magic for type %d", te->type);
    }

    io->sdb_read(&nr_aliases, sizeof(nr_aliases), 1, io);
    for (sdb_nr_aliases_t i = 0; i < nr_aliases; i++) {
        sdb_nr_aliases_t n;

        io->sdb_read(&n, sizeof(n), 1, io);
        for (size_t j = 0; j < n; j++) {
            sdb_arr_len_t name_len;
            struct SelvaAlias *alias;

            io->sdb_read(&name_len, sizeof(name_len), 1, io);
            alias = selva_malloc(sizeof(struct SelvaAlias) + name_len + 1);
            io->sdb_read(alias->name, sizeof(char), name_len, io);
            alias->name[name_len] = '\0';
            alias->dest = node_id;

            selva_set_alias_p(&te->aliases[i], alias);
        }
    }
}

static void load_nodes(struct selva_io *io, struct SelvaDb *db, struct SelvaTypeEntry *te)
{
    sdb_nr_nodes_t nr_nodes;
    io->sdb_read(&nr_nodes, sizeof(nr_nodes), 1, io);

    for (sdb_nr_nodes_t i = 0; i < nr_nodes; i++) {
        node_id_t node_id;

        node_id = load_node(io, db, te);
        load_aliases_node(io, te, node_id);
    }
}

static void load_types(struct selva_io *io, struct SelvaDb *db)
{
    if (!read_dump_magic(io, DUMP_MAGIC_TYPES)) {
        db_panic("Ivalid types magic");
    }

    node_type_t type;
    io->sdb_read(&type, sizeof(type), 1, io);

    struct SelvaTypeEntry *te;
    te = selva_get_type_by_index(db, type);
    if (!te) {
        db_panic("Type not found: %d", type);
    }

    load_nodes(io, db, te);
}


int selva_dump_load_common(struct SelvaDb *db, const char *filename)
{
    struct selva_io io;
    int err;

    err = selva_io_init_file(&io, filename, SELVA_IO_FLAGS_READ | SELVA_IO_FLAGS_COMPRESSED);
    if (err) {
        return err;
    }

    load_schema(&io, db);
    selva_io_end(&io, nullptr);

    return 0;
}

int selva_dump_load_range(struct SelvaDb *db, const char *filename)
{
    struct selva_io io;
    int err;

    err = selva_io_init_file(&io, filename, SELVA_IO_FLAGS_READ | SELVA_IO_FLAGS_COMPRESSED);
    if (err) {
        return err;
    }

    load_types(&io, db);
    selva_io_end(&io, nullptr);

    return 0;
}
