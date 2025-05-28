/*
 * Copyright (c) 2024-2025 SAULX
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
#include "jemalloc_selva.h"
#include "selva/ctime.h"
#include "selva/fields.h"
#include "selva/selva_hash128.h"
#include "selva/selva_string.h"
#include "selva/timestamp.h"
#include "selva_error.h"
#include "selva_lang_code.h"
#include "auto_free.h"
#include "db.h"
#include "db_panic.h"
#include "expire.h"
#include "io.h"
#include "print_ready.h"
#include "io_struct.h"

#define USE_DUMP_MAGIC_FIELD_BEGIN 0
#define PRINT_SAVE_TIME 0

/*
 * Pick 32-bit primes for these.
 */
#define DUMP_MAGIC_SCHEMA       3360690301 /* common.sdb */
#define DUMP_MAGIC_EXPIRE       2147483647 /* common.sdb */
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
    sdb_arr_len_t len;
    enum selva_string_flags flags; /*!< Saved flags SDB_STRING_META_FLAGS_MASK. */
} __packed;

struct sdb_text_meta {
    sdb_arr_len_t len;
    enum selva_string_flags flags; /*!< Saved flags SDB_STRING_META_FLAGS_MASK. */
};

static void save_fields(struct selva_io *io, struct SelvaDb *db, const struct SelvaFieldsSchema *schema, struct SelvaFields *fields);

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
    const uint8_t *str = selva_string_to_buf(string, &len);
    struct sdb_string_meta meta = {
        .flags = selva_string_get_flags(string) & SDB_STRING_META_FLAGS_MASK,
        .len = len,
    };

    /*
     * FIXME This is a hack to detect if the CRC is for the string in mem.
     * We know that the first byte indicates whether it's compressed. If the
     * string is compressed then the CRC is for the uncompressed string.
     * However, this is not the right way to do this. We should probably set
     * the SELVA_STRING_COMPRESS flag somewhere long before we end up here.
     */
#if 0
    if (str[0] == 0 && !selva_string_verify_crc(string)) {
        db_panic("%p Invalid CRC: %u", string, (unsigned)selva_string_get_crc(string));
    }
#endif

    io->sdb_write(&meta, sizeof(meta), 1, io);
    io->sdb_write(str, sizeof(char), meta.len, io);
}

static void save_field_text(struct selva_io *io, struct SelvaTextField *text)
{
    const uint8_t len = text->len;

    io->sdb_write(&len, sizeof(len), 1, io);

    for (uint8_t i = 0; i < len; i++) {
        struct selva_string *tl = &text->tl[i];
        size_t str_len;
        const uint8_t *str = selva_string_to_buf(tl, &str_len);
        struct sdb_text_meta meta = {
            .flags = selva_string_get_flags(tl) & SDB_STRING_META_FLAGS_MASK,
            .len = str_len,
        };

        /* FIXME string field CRC verification. */
#if 0
        if (!selva_string_verify_crc(tl)) {
            db_panic("%p Invalid CRC: %u", tl, (unsigned)selva_string_get_crc(tl));
        }
#endif

        io->sdb_write(&meta, sizeof(meta), 1, io);
        io->sdb_write(str, sizeof(char), str_len, io);
    }
}

static void save_ref(struct selva_io *io, const struct EdgeFieldConstraint *efc, const struct SelvaFieldsSchema *schema, struct SelvaNodeReference *ref)
{
    /*
     * If EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP then this is a SELVA_FIELD_TYPE_REFERENCES
     * field (i.e. need to preserve the sort order) and meta is save on the other end.
     */
    const uint8_t meta_present = ref->dst && !!ref->meta && !(efc->flags & EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP);
    const node_id_t node_id = ref->dst ? ref->dst->node_id : 0;

    io->sdb_write(&node_id, sizeof(node_id), 1, io);
    io->sdb_write(&meta_present, sizeof(meta_present), 1, io);
    if (meta_present) {
        /*
         * We don't pass the db here to prevent any attempt to access node schema.
         * Static analyzers may think that ref->meta is somehow null now but it's
         * definitely not!
         */
        save_fields(io, nullptr, schema, ref->meta);
    }
}

/**
 * Save references.
 * The caller must save nr_refs.
 */
static void save_field_references(struct selva_io *io, const struct EdgeFieldConstraint *efc, const struct SelvaFieldsSchema *schema, struct SelvaNodeReferences *refs)
{
    for (size_t i = 0; i < refs->nr_refs; i++) {
        save_ref(io, efc, schema, &refs->refs[i]);
    }
}

__attribute__((nonnull))
static void save_fields(struct selva_io *io, struct SelvaDb *db, const struct SelvaFieldsSchema *schema, struct SelvaFields *fields)
{
    const size_t nr_fields = fields->nr_fields;

    write_dump_magic(io, DUMP_MAGIC_FIELDS);
    io->sdb_write(&((sdb_nr_fields_t){ fields->nr_fields }), sizeof(sdb_nr_fields_t), 1, io);

    for (field_t field = 0; field < nr_fields; field++) {
        const struct SelvaFieldSchema *fs = get_fs_by_fields_schema_field(schema, field);
        struct SelvaFieldInfo *nfo = &fields->fields_map[field];
        enum SelvaFieldType type = nfo->in_use ? fs->type : SELVA_FIELD_TYPE_NULL;

        if (fs->type == SELVA_FIELD_TYPE_REFERENCE &&
            (fs->edge_constraint.flags & EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP)) {
            /*
             * This saves it as a NULL and the loader will skip it.
             * Note that SELVA_FIELD_TYPE_REFERENCES still needs to be saved
             * to preserve the order.
             */
            type = SELVA_FIELD_TYPE_NULL;
#if 0
            fprintf(stderr, "Skip %d (refs %d) on type %d\n", field, any.type == SELVA_FIELD_TYPE_REFERENCES, node->type);
#endif
        }

#if USE_DUMP_MAGIC_FIELD_BEGIN
        write_dump_magic(io, DUMP_MAGIC_FIELD_BEGIN);
#endif
        io->sdb_write(&field, sizeof(field), 1, io);
        io->sdb_write(&type, sizeof(enum SelvaFieldType), 1, io);
        switch (type) {
        case SELVA_FIELD_TYPE_NULL:
            break;
        case SELVA_FIELD_TYPE_STRING:
            /* In the old code we tested if (string->flags & SELVA_STRING_STATIC) but is it important? */
            save_field_string(io, selva_fields_nfo2p(fields, nfo));
            break;
        case SELVA_FIELD_TYPE_TEXT:
            save_field_text(io, selva_fields_nfo2p(fields, nfo));
            break;
        case SELVA_FIELD_TYPE_REFERENCE:
            if (((struct SelvaNodeReference *)selva_fields_nfo2p(fields, nfo))->dst) {
                const struct EdgeFieldConstraint *efc = &fs->edge_constraint;
                const struct SelvaFieldsSchema *eschema = selva_get_edge_field_fields_schema(db, efc);
                struct SelvaNodeReference *ref = selva_fields_nfo2p(fields, nfo);
                const sdb_arr_len_t nr_refs = 1;

                io->sdb_write(&nr_refs, sizeof(nr_refs), 1, io); /* nr_refs */
                save_ref(io, efc, eschema, ref);
            } else {
                io->sdb_write(&((sdb_arr_len_t){ 0 }), sizeof(sdb_arr_len_t), 1, io); /* nr_refs */
            }
            break;
        case SELVA_FIELD_TYPE_REFERENCES:
            if (((struct SelvaNodeReferences *)selva_fields_nfo2p(fields, nfo))->nr_refs > 0) {
                const struct EdgeFieldConstraint *efc = &fs->edge_constraint;
                const struct SelvaFieldsSchema *eschema = selva_get_edge_field_fields_schema(db, efc);
                struct SelvaNodeReferences *refs = selva_fields_nfo2p(fields, nfo);
                const sdb_arr_len_t nr_refs = refs->nr_refs;

                io->sdb_write(&nr_refs, sizeof(nr_refs), 1, io); /* nr_refs */
                save_field_references(io, efc, eschema, refs);
            } else {
                io->sdb_write(&((sdb_arr_len_t){ 0 }), sizeof(sdb_arr_len_t), 1, io); /* nr_refs */
            }
            break;
        case SELVA_FIELD_TYPE_WEAK_REFERENCE:
                io->sdb_write(selva_fields_nfo2p(fields, nfo), sizeof(struct SelvaNodeWeakReference), 1, io);
            break;
        case SELVA_FIELD_TYPE_WEAK_REFERENCES:
            if (((struct SelvaNodeWeakReferences *)selva_fields_nfo2p(fields, nfo))->nr_refs > 0) {
                struct SelvaNodeWeakReferences *weak_refs = selva_fields_nfo2p(fields, nfo);
                const sdb_arr_len_t nr_refs = weak_refs->nr_refs;

                io->sdb_write(&nr_refs, sizeof(nr_refs), 1, io); /* nr_refs */
                io->sdb_write(weak_refs->refs, sizeof(struct SelvaNodeWeakReference), weak_refs->nr_refs, io);
            } else {
                io->sdb_write(&((sdb_arr_len_t){ 0 }), sizeof(sdb_arr_len_t), 1, io); /* nr_refs */
            }
            break;
        case SELVA_FIELD_TYPE_MICRO_BUFFER:
            io->sdb_write(selva_fields_nfo2p(fields, nfo), sizeof(uint8_t), fs->smb.len, io);
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

__attribute__((nonnull))
static void save_node(struct selva_io *io, struct SelvaDb *db, struct SelvaNode *node)
{
    const struct SelvaFieldsSchema *schema = &selva_get_ns_by_te(selva_get_type_by_node(db, node))->fields_schema;

    write_dump_magic(io, DUMP_MAGIC_NODE);
    io->sdb_write(&node->node_id, sizeof(node_id_t), 1, io);
    save_fields(io, db, schema, &node->fields);
}

static void save_aliases_node(struct selva_io *io, struct SelvaTypeEntry *te, node_id_t node_id)
{
    const sdb_nr_aliases_t nr_aliases = te->ns.nr_aliases;

    write_dump_magic(io, DUMP_MAGIC_ALIASES);
    io->sdb_write(&nr_aliases, sizeof(nr_aliases), 1, io);

    for (size_t i = 0; i < nr_aliases; i++) {
        struct SelvaAliases *aliases = &te->aliases[i];
        const struct SelvaAlias *alias_first;
        const struct SelvaAlias *alias;
        sdb_nr_aliases_t nr_aliases_by_dest = 0;

        alias_first = alias = selva_get_alias_by_dest(aliases, node_id);
        while (alias) {
            nr_aliases_by_dest++;
            alias = alias->next;
        }

        io->sdb_write(&nr_aliases_by_dest, sizeof(nr_aliases_by_dest), 1, io);

        alias = alias_first;
        while (alias) {
            const char *name_str = alias->name;
            const sdb_arr_len_t name_len = alias->name_len;

            io->sdb_write(&name_len, sizeof(name_len), 1, io);
            io->sdb_write(name_str, sizeof(*name_str), name_len, io);

            alias = alias->next;
        }
    }
}

static void save_schema(struct selva_io *io, struct SelvaDb *db)
{
    const sdb_nr_types_t nr_types = db->types.count;
    struct SelvaTypeEntry *te;

    write_dump_magic(io, DUMP_MAGIC_SCHEMA);
    io->sdb_write(&nr_types, sizeof(nr_types), 1, io);

    RB_FOREACH(te, SelvaTypeEntryIndex, &db->types.index) {
        node_type_t type = te->type;
        const sdb_arr_len_t schema_len = te->schema_len;

        io->sdb_write(&type, sizeof(type), 1, io);
        io->sdb_write(&schema_len, sizeof(schema_len), 1, io);
        io->sdb_write(te->schema_buf, sizeof(te->schema_buf[0]), te->schema_len, io);
    }
}

static void save_expire(struct selva_io *io, struct SelvaDb *db)
{

    struct SVectorIterator it;
    struct SelvaExpireToken *token;
    const sdb_arr_len_t count = selva_expire_count(&db->expiring);

    write_dump_magic(io, DUMP_MAGIC_EXPIRE);
    io->sdb_write(&count, sizeof(count), 1, io);

    SVector_ForeachBegin(&it, &db->expiring.list);
    while (!SVector_Done(&it)) {
        token = SVector_Foreach(&it);
        do {
            struct SelvaDbExpireToken *dbToken = containerof(token, typeof(*dbToken), token);
            node_type_t type = dbToken->type;
            node_id_t node_id = dbToken->node_id;
            int64_t expire = dbToken->token.expire;

            io->sdb_write(&type, sizeof(type), 1, io);
            io->sdb_write(&node_id, sizeof(node_id), 1, io);
            io->sdb_write(&expire, sizeof(expire), 1, io);
        } while ((token = token->next));
    }

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
     * Just in case.
     */
    io.errlog_buf = nullptr;
    io.errlog_left = 0;

    /*
     * Save all the common data here that can't be split up.
     */
    save_schema(&io, db);
    save_expire(&io, db);
    selva_io_end(&io, nullptr);

    return 0;
}

static sdb_nr_nodes_t get_node_range(struct SelvaTypeEntry *te, node_id_t start, node_id_t end, struct SelvaNode **start_node)
{
    struct SelvaNode *node;
    sdb_nr_nodes_t n = 0;

    node = selva_nfind_node(te, start);
    if (!node || node->node_id > end) {
        *start_node = nullptr;
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

    struct SelvaNode *node = nullptr;
    const sdb_nr_nodes_t nr_nodes = get_node_range(te, start, end, &node);

    if (nr_nodes == 0) {
        /*
         * Don't save anything if the range is empty.
         */
        return SELVA_ENOENT;
    }

#if PRINT_SAVE_TIME
    ts_monotime(&ts_start);
#endif

    err = selva_io_init_file(&io, filename, SELVA_IO_FLAGS_WRITE | SELVA_IO_FLAGS_COMPRESSED);
    if (err) {
        return err;
    }

    /*
     * Just in case.
     */
    io.errlog_buf = nullptr;
    io.errlog_left = 0;

    write_dump_magic(&io, DUMP_MAGIC_TYPES);
    io.sdb_write(&te->type, sizeof(te->type), 1, &io);

    selva_hash_state_t *hash_state = selva_hash_create_state();
    selva_hash_state_t *tmp_hash_state = selva_hash_create_state();

    selva_hash_reset(hash_state);
    io.sdb_write(&nr_nodes, sizeof(nr_nodes), 1, &io);

    /*
     * `node` is definitely set but we just want to make static analyzers
     * happy.
     */
    if (node && nr_nodes > 0) {
        do {
            selva_hash128_t node_hash;

            node_hash = selva_node_hash_update(db, te, node, tmp_hash_state);
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
            2 * SELVA_IO_HASH_SIZE, selva_io_hash_to_hex((char [2 * SELVA_IO_HASH_SIZE]){ 0 }, io.computed_hash),
            2 * SELVA_IO_HASH_SIZE, selva_io_hash_to_hex((char [2 * SELVA_IO_HASH_SIZE]){ 0 }, (const uint8_t *)range_hash_out));
#endif

    return 0;
}

__attribute__((warn_unused_result))
static int load_schema(struct selva_io *io, struct SelvaDb *db)
{
    sdb_nr_types_t nr_types;

    if (!read_dump_magic(io, DUMP_MAGIC_SCHEMA)) {
        selva_io_errlog(io, "Invalid schema magic");
        return SELVA_EINVAL;
    }

    if (io->sdb_read(&nr_types, sizeof(nr_types), 1, io) != 1) {
        selva_io_errlog(io, "nr_types schema");
        return SELVA_EINVAL;
    }

    for (size_t i = 0; i < nr_types; i++) {
        node_type_t type;
        __selva_autofree uint8_t *schema_buf;
        sdb_arr_len_t schema_len;
        int err;

        io->sdb_read(&type, sizeof(type), 1, io);
        io->sdb_read(&schema_len, sizeof(schema_len), 1, io);
        schema_buf = selva_malloc(schema_len);
        io->sdb_read(schema_buf, sizeof(schema_buf[0]), schema_len, io);

        err = selva_db_create_type(db, type, schema_buf, schema_len);
        if (err) {
            selva_io_errlog(io, "Failed to create a node type entry: %s", selva_strerror(err));
            return SELVA_EINVAL;
        }
    }

    return 0;
}

__attribute__((warn_unused_result))
static int load_expire(struct selva_io *io, struct SelvaDb *db)
{
    sdb_arr_len_t count;

    if (!read_dump_magic(io, DUMP_MAGIC_EXPIRE)) {
        selva_io_errlog(io, "Ivalid types magic");
        return SELVA_EINVAL;
    }

    io->sdb_read(&count, sizeof(count), 1, io);

    for (sdb_arr_len_t i = 0; i < count; i++) {
        node_type_t type;
        node_id_t node_id;
        int64_t expire;

        io->sdb_read(&type, sizeof(type), 1, io);
        io->sdb_read(&node_id, sizeof(node_id), 1, io);
        io->sdb_read(&expire, sizeof(expire), 1, io);

        selva_expire_node(db, type, node_id, expire);
    }

    return 0;
}

__attribute__((warn_unused_result))
static int load_string(struct selva_io *io, struct selva_string *s, const struct sdb_string_meta *meta)
{
    if (io->sdb_read(selva_string_to_mstr(s, nullptr), sizeof(char), meta->len, io) != meta->len * sizeof(char)) {
        selva_string_free(s);
        return SELVA_EIO;
    }

    return 0;
}

__attribute__((warn_unused_result))
static int load_field_string(struct selva_io *io, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    struct sdb_string_meta meta;
    struct selva_string *s;
    int err;

    io->sdb_read(&meta, sizeof(meta), 1, io);
    if (meta.len == 0) {
        return 0;
    }

    err = selva_fields_get_mutable_string(node, fs, meta.len - sizeof(uint32_t), &s);
    if (err) {
        return err;
    }

    return load_string(io, s, &meta);
}

__attribute__((warn_unused_result))
static int load_reference_meta_field_string(
        struct SelvaDb *db,
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
    err = selva_fields_get_reference_meta_mutable_string(db, node, ref, efc, field, meta.len - sizeof(uint32_t), &s);
    if (err) {
        return err;
    }

    return load_string(io, s, &meta);
}

__attribute__((warn_unused_result))
static int load_field_text(struct selva_io *io, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    uint8_t len;

    io->sdb_read(&len, sizeof(len), 1, io);

    for (uint8_t i = 0; i < len; i++) {
        struct sdb_text_meta meta;
        __selva_autofree char *str;

        io->sdb_read(&meta, sizeof(meta), 1, io);
        str = selva_malloc(meta.len); /* TODO Optimize */
        io->sdb_read(str, sizeof(char), meta.len, io);
        selva_fields_set_text(node, fs, str, meta.len);
    }

    return 0;
}
__attribute__((warn_unused_result))
static int load_field_micro_buffer(struct selva_io *io, struct SelvaFields *fields, const struct SelvaFieldSchema *fs)
{
    struct SelvaFieldInfo *nfo = selva_fields_ensure(fields, fs);
    void *smb = selva_fields_nfo2p(fields, nfo);

    io->sdb_read(smb, sizeof(uint8_t), fs->smb.len, io);

    return 0;
}

__attribute__((warn_unused_result))
static int load_field_weak_references(struct selva_io *io, const struct SelvaFieldSchema *fs, struct SelvaFields *fields)
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
        err = selva_fields_set_weak_references2(fields, fs, &reference.dst_id, 1);
        if (err) {
            return err;
        }
    }

    return 0;
}


/**
 * Load meta fields of an edge in an edge field of node.
 */
__attribute__((warn_unused_result))
static int load_reference_meta(
        struct selva_io *io,
        struct SelvaDb *db,
        struct SelvaNode *node,
        struct SelvaNodeReference *ref, const struct EdgeFieldConstraint *efc)
{
    const struct SelvaFieldsSchema *schema = selva_get_edge_field_fields_schema(db, efc);
    int err = 0;

    if (!read_dump_magic(io, DUMP_MAGIC_FIELDS)) {
        selva_io_errlog(io, "Load ref meta fields of %d:%d: Invalid magic", node->type, node->node_id);
        return SELVA_EINVAL;
    }

    sdb_nr_fields_t nr_fields;
    io->sdb_read(&nr_fields, sizeof(nr_fields), 1, io);

    if (nr_fields > 0) {
        selva_fields_ensure_ref_meta(db, node, ref, efc);
        assert(ref->meta);
    }

    for (sdb_nr_fields_t i = 0; i < nr_fields; i++) {
        struct {
            field_t field;
            enum SelvaFieldType type;
        } __packed rd;
        const struct SelvaFieldSchema *fs;

#if USE_DUMP_MAGIC_FIELD_BEGIN
        if (!read_dump_magic(io, DUMP_MAGIC_FIELD_BEGIN)) {
            selva_io_errlog(io, "Invalid field begin magic for %d:%d",
                            node->type, node->node_id);
            return SELVA_EINVAL;
        }
#endif

        io->sdb_read(&rd, sizeof(rd), 1, io);

        fs = get_fs_by_fields_schema_field(schema, rd.field);
        if (!fs) {
            selva_io_errlog(io, "Field schema not found for the field %d", rd.field);
            return SELVA_EINVAL;
        }
        if (rd.type != SELVA_FIELD_TYPE_NULL && rd.type != fs->type) {
            selva_io_errlog(io, "Invalid field type found %d != %d",
                            rd.type, fs->type);
            return SELVA_EINVAL;
        }

        const size_t value_size = selva_fields_get_data_size(fs);
        alignas(uint64_t) uint8_t value_buf[value_size + !value_size]; /* 0 length VLA is prohibited. */

        err = SELVA_EINVAL;

        switch (rd.type) {
        case SELVA_FIELD_TYPE_NULL:
            err = 0;
            break;
        case SELVA_FIELD_TYPE_MICRO_BUFFER:
            err = load_field_micro_buffer(io, ref->meta, fs);
            break;
        case SELVA_FIELD_TYPE_STRING:
            err = load_reference_meta_field_string(db, io, node, ref, efc, rd.field);
            break;
        case SELVA_FIELD_TYPE_TEXT:
            /* TODO Text field support in meta */
#if 0
            err = load_field_text(io, ns, node, fs);
#endif
            err = SELVA_ENOTSUP;
            break;
        case SELVA_FIELD_TYPE_REFERENCE:
        case SELVA_FIELD_TYPE_REFERENCES:
            selva_io_errlog(io, "References not supported in edge meta");
            err = SELVA_ENOTSUP;
            break;
        case SELVA_FIELD_TYPE_WEAK_REFERENCE:
            /* TODO check return value */
            io->sdb_read(value_buf, sizeof(uint8_t), value_size, io);
            err = selva_fields_set_weak_reference2(ref->meta, fs, *(node_id_t *)value_buf);
            break;
        case SELVA_FIELD_TYPE_WEAK_REFERENCES:
            err = load_field_weak_references(io, fs, ref->meta);
            break;
        case SELVA_FIELD_TYPE_ALIAS:
        case SELVA_FIELD_TYPE_ALIASES:
            /* NOP */
            break;
        }
        if (err) {
            selva_io_errlog(io, "Failed to set edge (%d:%d.%d %s): %s",
                            node->type, node->node_id, rd.field,
                            selva_str_field_type(rd.type),
                            selva_strerror(err));
        } else if (!read_dump_magic(io, DUMP_MAGIC_FIELD_END)) {
            selva_io_errlog(io, "Invalid field end magic for %d:%d.%d",
                            node->type, node->node_id, rd.field);
            err = SELVA_EINVAL;
        }
    }

    return err;
}

__attribute__((warn_unused_result))
static int load_ref(struct selva_io *io, struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, struct SelvaTypeEntry *dst_te, ssize_t index)
{
    node_id_t dst_id;
    uint8_t meta_present;
    struct SelvaNode *dst_node;
    struct SelvaNodeReference *ref = nullptr;
    int err;

    io->sdb_read(&dst_id, sizeof(dst_id), 1, io);
    io->sdb_read(&meta_present, sizeof(meta_present), 1, io);

    if (unlikely(dst_id == 0)) {
        /* TODO Should we insert nullptr? */
        return 0;
    }

    dst_node = selva_upsert_node(dst_te, dst_id);
    if (fs->type == SELVA_FIELD_TYPE_REFERENCE) {
        node_id_t dirty[2]; /* never really happens in load. */
        err = selva_fields_reference_set(db, node, fs, dst_node, &ref, dirty);
    } else if (fs->type == SELVA_FIELD_TYPE_REFERENCES) {
        err = selva_fields_references_insert(db, node, fs, index, true, dst_te, dst_node, meta_present ? &ref : nullptr);
    } else {
        err = SELVA_EINTYPE;
    }
    if (err == SELVA_EEXIST) {
#if 0
        fprintf(stderr, "%s: Reference %u:%u.%u <-> %u:%u.%u exists: %s\n",
                __func__,
                node->type, node->node_id, fs->field,
                dst_te->type, dst_id, fs->edge_constraint.inverse_field,
                selva_strerror(err));
#endif
        err = 0;
    } else if (err) {
        return SELVA_EIO;
    }

    if (meta_present) {
        err = load_reference_meta(io, db, node, ref, &fs->edge_constraint);
    }

    return err;
}

__attribute__((warn_unused_result))
static int load_field_reference(struct selva_io *io, struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    struct SelvaTypeEntry *te_dst = selva_get_type_by_index(db, fs->edge_constraint.dst_node_type);
    sdb_arr_len_t nr_refs;

    io->sdb_read(&nr_refs, sizeof(nr_refs), 1, io);
    return (nr_refs) ? load_ref(io, db, node, fs, te_dst, -1) : 0;
}

__attribute__((warn_unused_result))
static int load_field_references(struct selva_io *io, struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    struct SelvaTypeEntry *te_dst = selva_get_type_by_index(db, fs->edge_constraint.dst_node_type);
    sdb_arr_len_t nr_refs;
    int err = 0;

    io->sdb_read(&nr_refs, sizeof(nr_refs), 1, io);
    (void)selva_fields_prealloc_refs(node, fs, nr_refs);
    for (sdb_arr_len_t i = 0; i < nr_refs; i++) {
        err = load_ref(io, db, node, fs, te_dst, i);
        if (err) {
            break;
        }
    }

    return err;
}

__attribute__((warn_unused_result))
static int load_node_fields(struct selva_io *io, struct SelvaDb *db, struct SelvaTypeEntry *te, struct SelvaNode *node)
{
    struct SelvaNodeSchema *ns = &te->ns;
    sdb_nr_fields_t nr_fields;
    int err = 0;

    if (!read_dump_magic(io, DUMP_MAGIC_FIELDS)) {
        selva_io_errlog(io, "Invalid magic for node fields load fields of %d:%d",
                        node->type, node->node_id);
        return SELVA_EINVAL;
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
            selva_io_errlog(io, "Invalid field begin magic for %d:%d",
                            node->type, node->node_id);
            return SELVA_EINVAL;
        }
#endif

        io->sdb_read(&rd, sizeof(rd), 1, io);
        fs = selva_get_fs_by_ns_field(ns, rd.field);
        if (!fs) {
            selva_io_errlog(io, "Field Schema not found for %d:%d.%d",
                            node->type, node->node_id, rd.field);
            return SELVA_EINVAL;
        }
        if (rd.type != SELVA_FIELD_TYPE_NULL && rd.type != fs->type) {
            selva_io_errlog(io, "Invalid field type found for %d:%d.%d: %d != %d\n",
                            node->type, node->node_id, fs->field,
                            rd.type, fs->type);
            return SELVA_EINVAL;
        }

        const size_t value_size = selva_fields_get_data_size(fs);
        alignas(uint64_t) uint8_t value_buf[value_size + !value_size]; /* 0 length VLA is prohibited. */

        err = SELVA_EINVAL;

        switch (rd.type) {
        case SELVA_FIELD_TYPE_NULL:
            err = 0;
            break;
        case SELVA_FIELD_TYPE_STRING:
            err = load_field_string(io, node, fs);
            break;
        case SELVA_FIELD_TYPE_TEXT:
            err = load_field_text(io, node, fs);
            break;
        case SELVA_FIELD_TYPE_REFERENCE:
            err = load_field_reference(io, db, node, fs);
            break;
        case SELVA_FIELD_TYPE_REFERENCES:
            err = load_field_references(io, db, node, fs);
            break;
        case SELVA_FIELD_TYPE_WEAK_REFERENCE:
            /* TODO check return value */
            io->sdb_read(value_buf, sizeof(uint8_t), value_size, io);
            err = selva_fields_set_weak_reference(node, fs, *(node_id_t *)value_buf);
            break;
        case SELVA_FIELD_TYPE_WEAK_REFERENCES:
            err = load_field_weak_references(io, fs, &node->fields);
            break;
        case SELVA_FIELD_TYPE_MICRO_BUFFER:
            err = load_field_micro_buffer(io, &node->fields, fs);
            break;
        case SELVA_FIELD_TYPE_ALIAS:
        case SELVA_FIELD_TYPE_ALIASES:
            /* NOP */
            break;
        }
        if (err) {
            selva_io_errlog(io, "Failed to set field (%d:%d.%d %s): %s",
                            node->type, node->node_id, rd.field,
                            selva_str_field_type(rd.type),
                            selva_strerror(err));
        } else if (!read_dump_magic(io, DUMP_MAGIC_FIELD_END)) {
            selva_io_errlog(io, "Invalid field end magic for %d:%d.%d",
                            node->type, node->node_id, rd.field);
            err = SELVA_EINVAL;
        }
    }

    return err;
}

__attribute__((warn_unused_result))
static node_id_t load_node(struct selva_io *io, struct SelvaDb *db, struct SelvaTypeEntry *te)
{
    int err;

    if (!read_dump_magic(io, DUMP_MAGIC_NODE)) {
        selva_io_errlog(io, "Invalid node magic for type %d", te->type);
        return 0;
    }

    node_id_t node_id;
    io->sdb_read(&node_id, sizeof(node_id), 1, io);

    struct SelvaNode *node = selva_upsert_node(te, node_id);
    assert(node->type == te->type);
    err = load_node_fields(io, db, te, node);
    if (err) {
        return 0;
    }

    return node_id;
}

__attribute__((warn_unused_result))
static int load_aliases_node(struct selva_io *io, struct SelvaTypeEntry *te, node_id_t node_id)
{
    sdb_nr_aliases_t nr_aliases;

    if (!read_dump_magic(io, DUMP_MAGIC_ALIASES)) {
        selva_io_errlog(io, "Invalid aliases magic for type %d", te->type);
        return SELVA_EINVAL;
    }

    io->sdb_read(&nr_aliases, sizeof(nr_aliases), 1, io);
    for (sdb_nr_aliases_t i = 0; i < nr_aliases; i++) {
        sdb_nr_aliases_t nr_aliases_by_dest;

        io->sdb_read(&nr_aliases_by_dest, sizeof(nr_aliases_by_dest), 1, io);
        for (size_t j = 0; j < nr_aliases_by_dest; j++) {
            sdb_arr_len_t name_len;
            struct SelvaAlias *alias;

            io->sdb_read(&name_len, sizeof(name_len), 1, io);
            alias = selva_malloc(sizeof_wflex(struct SelvaAlias, name, name_len));
            alias->name_len = name_len;
            io->sdb_read(alias->name, sizeof(char), name_len, io);
            alias->dest = node_id;

            selva_set_alias_p(&te->aliases[i], alias);
        }
    }

    return 0;
}

__attribute__((warn_unused_result))
static int load_nodes(struct selva_io *io, struct SelvaDb *db, struct SelvaTypeEntry *te)
{
    int err;
    sdb_nr_nodes_t nr_nodes;

    io->sdb_read(&nr_nodes, sizeof(nr_nodes), 1, io);
    for (sdb_nr_nodes_t i = 0; i < nr_nodes; i++) {
        node_id_t node_id;

        node_id = load_node(io, db, te);
        if (unlikely(node_id == 0)) {
            return SELVA_EINVAL;
        }

        err = load_aliases_node(io, te, node_id);
        if (err) {
            return err;
        }
    }

    return 0;
}

__attribute__((warn_unused_result))
static int load_types(struct selva_io *io, struct SelvaDb *db)
{
    if (!read_dump_magic(io, DUMP_MAGIC_TYPES)) {
        selva_io_errlog(io, "Ivalid types magic");
        return SELVA_EINVAL;
    }

    node_type_t type;
    io->sdb_read(&type, sizeof(type), 1, io);

    struct SelvaTypeEntry *te;
    te = selva_get_type_by_index(db, type);
    if (!te) {
        selva_io_errlog(io, "Type not found: %d", type);
        return SELVA_EINVAL;
    }

    return load_nodes(io, db, te);
}

int selva_dump_load_common(struct SelvaDb *db, const char *filename, char *errlog_buf, size_t errlog_size)
{
    struct selva_io io;
    int err;

    err = selva_io_init_file(&io, filename, SELVA_IO_FLAGS_READ | SELVA_IO_FLAGS_COMPRESSED);
    if (err) {
        return err;
    }

    io.errlog_buf = errlog_buf;
    io.errlog_left = errlog_size;

    err = load_schema(&io, db);
    err = err ?: load_expire(&io, db);
    selva_io_end(&io, nullptr);

    return err;
}

int selva_dump_load_range(struct SelvaDb *db, const char *filename, char *errlog_buf, size_t errlog_size)
{
    struct selva_io io;
    int err;

    err = selva_io_init_file(&io, filename, SELVA_IO_FLAGS_READ | SELVA_IO_FLAGS_COMPRESSED);
    if (err) {
        return err;
    }

    io.errlog_buf = errlog_buf;
    io.errlog_left = errlog_size;

    err = load_types(&io, db);
    selva_io_end(&io, nullptr);

    return err;
}
