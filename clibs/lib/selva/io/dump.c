/*
 * Copyright (c) 2024-2026 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <inttypes.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>
#include "jemalloc_selva.h"
#include "selva/ctime.h"
#include "selva/colvec.h"
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
#define DUMP_MAGIC_COMMON_IDS   2974848157 /* common.sdb */
#define DUMP_MAGIC_COMMON_BLOCKS 2734165127 /* common.sdb */
#define DUMP_MAGIC_TYPES        3550908863 /* [block].sdb */
#define DUMP_MAGIC_NODE         3323984057
#define DUMP_MAGIC_FIELDS       3126175483
#if USE_DUMP_MAGIC_FIELD_BEGIN
#define DUMP_MAGIC_FIELD_BEGIN  3734376047
#endif
#define DUMP_MAGIC_FIELD_END    2944546091
#define DUMP_MAGIC_ALIASES      4019181209
#define DUMP_MAGIC_COLVEC       1901731729
#define DUMP_MAGIC_BLOCK_HASH   2898966349

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

/**
 * dump_version < 4 compat.
 */
struct SelvaNodeWeakReference {
    node_id_t dst_id;
};

/**
 * dump_version < 4 compat.
 */
struct SelvaNodeWeakReferences {
    uint32_t nr_refs;
    uint32_t offset;
    struct SelvaNodeWeakReference *refs __pcounted_by(nr_refs);
};

#define SDB_STRING_META_FLAGS_MASK (SELVA_STRING_CRC | SELVA_STRING_COMPRESS)

struct sdb_string_meta {
    sdb_arr_len_t len;
    enum selva_string_flags flags; /*!< Saved flags SDB_STRING_META_FLAGS_MASK. */
} __packed;

struct sdb_text_meta {
    sdb_arr_len_t len;
    enum selva_string_flags flags; /*!< Saved flags SDB_STRING_META_FLAGS_MASK. */
};

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

static void save_field_reference(struct selva_io *io, struct SelvaNodeLargeReference *ref)
{
    if (ref->dst) {
        io->sdb_write(&((sdb_arr_len_t){ 1 }), sizeof(sdb_arr_len_t), 1, io); /* nr_refs */
        io->sdb_write(&ref->dst, sizeof(ref->dst), 1, io);
        io->sdb_write(&ref->edge, sizeof(ref->edge), 1, io);
    } else {
        io->sdb_write(&((sdb_arr_len_t){ 0 }), sizeof(sdb_arr_len_t), 1, io); /* nr_refs */
    }
}

/**
 * Save references.
 * The caller must save nr_refs.
 */
static void save_field_references(struct selva_io *io, struct SelvaNodeReferences *refs)
{
    const sdb_arr_len_t nr_refs = refs->nr_refs;

    io->sdb_write(&nr_refs, sizeof(nr_refs), 1, io); /* nr_refs */

    if (nr_refs > 0) {
        switch (refs->size) {
        case SELVA_NODE_REFERENCE_NULL:
            db_panic("refs can't be NULL");
            break;
        case SELVA_NODE_REFERENCE_SMALL:
            io->sdb_write(refs->small, sizeof(refs->small[0]), nr_refs, io);
            break;
        case SELVA_NODE_REFERENCE_LARGE:
            io->sdb_write(refs->large, sizeof(refs->large[0]), nr_refs, io);
            break;
        }

        io->sdb_write(refs->index, sizeof(refs->index[0]), nr_refs, io);
    }
}

__attribute__((nonnull))
static void save_node_fields(struct selva_io *io, const struct SelvaFieldsSchema *schema, struct SelvaNode *node)
{
    struct SelvaFields *fields = &node->fields;
    const size_t nr_fields = fields->nr_fields;

    write_dump_magic(io, DUMP_MAGIC_FIELDS);
    io->sdb_write(&((sdb_nr_fields_t){ fields->nr_fields }), sizeof(sdb_nr_fields_t), 1, io);

    for (field_t field = 0; field < nr_fields; field++) {
        const struct SelvaFieldSchema *fs = get_fs_by_fields_schema_field(schema, field);
        struct SelvaFieldInfo *nfo = &fields->fields_map[field];
        enum SelvaFieldType type = nfo->in_use ? fs->type : SELVA_FIELD_TYPE_NULL;

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
            save_field_reference(io, selva_fields_nfo2p(fields, nfo));
            break;
        case SELVA_FIELD_TYPE_REFERENCES:
            save_field_references(io, selva_fields_nfo2p(fields, nfo));
            break;
        case SELVA_FIELD_TYPE_MICRO_BUFFER:
            io->sdb_write(selva_fields_nfo2p(fields, nfo), sizeof(uint8_t), fs->smb.len, io);
            break;
        case SELVA_FIELD_TYPE_ALIAS:
        case SELVA_FIELD_TYPE_ALIASES:
        case SELVA_FIELD_TYPE_COLVEC:
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
    save_node_fields(io, schema, node);
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

static void save_common_ids(struct selva_io *io, const node_id_t *ids_data, size_t meta_len)
{
    const sdb_arr_len_t len = meta_len;

    write_dump_magic(io, DUMP_MAGIC_COMMON_IDS);
    io->sdb_write(&len, sizeof(len), 1, io);
    if (likely(len > 0)) {
        io->sdb_write(ids_data, sizeof(node_id_t), len, io);
    }
}

int selva_dump_save_common(struct SelvaDb *db, struct selva_dump_common_data *com, const char *filename)
{
    struct selva_io io = {
        .errlog_buf = com->errlog_buf,
        .errlog_left = com->errlog_size,
    };
    int err;

    err = selva_io_init_file(&io, filename, SELVA_IO_FLAGS_WRITE | SELVA_IO_FLAGS_COMPRESSED);
    if (err) {
        return err;
    }

    /*
     * Save all the common data here that can't be split up.
     */
    save_schema(&io, db);
    save_expire(&io, db);
    save_common_ids(&io, com->ids_data, com->ids_len);
    //save_common_blocks(&io, com->blocks_data, blocks_len);

    db->sdb_version = io.sdb_version;
    selva_io_end(&io, nullptr);

    return 0;
}

int selva_dump_save_block(struct SelvaDb *db, struct SelvaTypeEntry *te, const char *filename, node_id_t start, selva_hash128_t *range_hash_out)
{
#if PRINT_SAVE_TIME
    struct timespec ts_start, ts_end;
#endif
    struct selva_io io = {
        .errlog_buf = nullptr,
        .errlog_left = 0,
    };
    int err;

    struct SelvaTypeBlock *block = selva_get_block(te->blocks, start);
    const sdb_nr_nodes_t nr_nodes = (block) ? block->nr_nodes_in_block : 0;

    if (nr_nodes == 0) {
        /*
         * Don't save anything if the range is empty.
         */
        return SELVA_ENOENT;
    }

    constexpr enum SelvaTypeBlockStatus block_sm = SELVA_TYPE_BLOCK_STATUS_INMEM | SELVA_TYPE_BLOCK_STATUS_DIRTY;
    if ((atomic_load(&block->status.atomic) & block_sm) != block_sm) {
        return 0; /* TODO Should this be an error instead? */
    }

#if PRINT_SAVE_TIME
    ts_monotime(&ts_start);
#endif

    if (!block->filename) {
        block->filename = selva_string_create(filename, strlen(filename) + 1, SELVA_STRING_MUTABLE);
        assert(block->filename);
    } else {
        /* RFE in the future we probably never want to change the name. */
        (void)selva_string_replace(block->filename, filename, strlen(filename) + 1);
    }

    err = selva_io_init_file(&io, filename, SELVA_IO_FLAGS_WRITE | SELVA_IO_FLAGS_COMPRESSED);
    if (err) {
        return err;
    }

    write_dump_magic(&io, DUMP_MAGIC_TYPES);
    io.sdb_write(&te->type, sizeof(te->type), 1, &io);

    selva_hash_state_t *hash_state = selva_hash_create_state();
    selva_hash_state_t *tmp_hash_state = selva_hash_create_state();

    selva_hash_reset(hash_state);
    io.sdb_write(&nr_nodes, sizeof(nr_nodes), 1, &io);

    struct SelvaNode *node;

    RB_FOREACH(node, SelvaNodeIndex, &block->nodes) {
        selva_hash128_t node_hash = selva_node_hash_update(db, te, node, tmp_hash_state);
        selva_hash_update(hash_state, &node_hash, sizeof(node_hash));
        save_node(&io, db, node);
        save_aliases_node(&io, te, node->node_id);
    }

    /*
     * Columnar fields.
     * note: colvec is hashed in node_hash.
     */
    if (io.sdb_version >= 2) {
        write_dump_magic(&io, DUMP_MAGIC_COLVEC);

        block_id_t block_i = selva_node_id2block_i2(te, start);

        /*
         * Currently block_i is not easily recoverable at load time,
         * so we put it here.
         */
        io.sdb_write(&block_i, sizeof(block_i), 1, &io);
        static_assert(sizeof(block_i) == sizeof(uint32_t));

        for (size_t i = 0; i < te->ns.nr_colvecs; i++) {
            struct SelvaColvec *colvec = &te->col_fields.colvec[i];
            uint8_t *slab = (uint8_t *)colvec->v[block_i];
            uint8_t slab_present = !!slab;

            io.sdb_write(&slab_present, sizeof(slab_present), 1, &io);
            if (slab_present) {
                /* Save the whole slab at once. */
                io.sdb_write(slab, colvec->slab_size, 1, &io);
            }
        }
    }

    *range_hash_out = selva_hash_digest(hash_state);
    selva_hash_free_state(hash_state);
    selva_hash_free_state(tmp_hash_state);

    write_dump_magic(&io, DUMP_MAGIC_BLOCK_HASH);
    io.sdb_write(range_hash_out, sizeof(*range_hash_out), 1, &io);

    selva_io_end(&io, nullptr);
    atomic_store(&block->status.atomic, (uint32_t)(SELVA_TYPE_BLOCK_STATUS_FS | SELVA_TYPE_BLOCK_STATUS_INMEM));

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

        selva_expire_node(db, type, node_id, expire, SELVA_EXPIRE_NODE_STRATEGY_IGNORE);
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
static int load_field_text(struct selva_io *io, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    uint8_t len;

    io->sdb_read(&len, sizeof(len), 1, io);

    for (uint8_t i = 0; i < len; i++) {
        struct sdb_text_meta meta;
        int err;

        io->sdb_read(&meta, sizeof(meta), 1, io);
        if (meta.len == 0) {
          continue;
        }

        enum selva_lang_code lang;
        io->sdb_read(&lang, sizeof(lang), 1, io);

        size_t len = meta.len - sizeof(uint32_t);
        struct selva_string *s;
        err = selva_fields_get_mutable_text(node, fs, lang, len, &s);
        if (err) {
            return err;
        }

        char *str = selva_string_to_mstr(s, &len);
        assert(len == meta.len - sizeof(uint32_t));
        str[0] = lang;
        io->sdb_read(str + 1, sizeof(char), meta.len - 1, io); /* will also read the CRC that's at the end. */
    }

    return 0;
}
__attribute__((warn_unused_result))
static int load_field_micro_buffer(struct selva_io *io, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    void *smb = selva_fields_ensure_micro_buffer(node, fs);

    io->sdb_read(smb, sizeof(uint8_t), fs->smb.len, io);

    return 0;
}

/**
 * dump_version < 4 compat.
 */
__attribute__((warn_unused_result))
static int load_field_weak_reference_v3(struct selva_io *io, struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    struct SelvaTypeEntry *dst_te = selva_get_type_by_index(db, fs->edge_constraint.dst_node_type);
    node_id_t dst_id;
    struct SelvaNode *dst_node;

    io->sdb_read(&dst_id, sizeof(dst_id), 1, io);
    dst_node = selva_upsert_node(dst_te, dst_id);
    return selva_fields_reference_set(db, node, fs, dst_node, nullptr);
}

/**
 * dump_version < 4 compat.
 */
__attribute__((warn_unused_result))
static int load_field_weak_references_v3(struct selva_io *io, struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    struct SelvaTypeEntry *dst_te = selva_get_type_by_index(db, fs->edge_constraint.dst_node_type);
    sdb_arr_len_t nr_refs;

    io->sdb_read(&nr_refs, sizeof(nr_refs), 1, io);
    for (sdb_arr_len_t i = 0; i < nr_refs; i++) {
        enum selva_fields_references_insert_flags insert_flags = SELVA_FIELDS_REFERENCES_INSERT_FLAGS_REORDER | SELVA_FIELDS_REFERENCES_INSERT_FLAGS_IGNORE_SRC_DEPENDENT;
        struct SelvaNodeWeakReference reference;
        struct SelvaNode *dst_node;
        int err;

        io->sdb_read(&reference, sizeof(reference), 1, io);
        dst_node = selva_upsert_node(dst_te, reference.dst_id);
        err = selva_fields_references_insert(db, node, fs, i, insert_flags, dst_te, dst_node, nullptr);
        if (err) {
            return err;
        }
    }

    return 0;
}

__attribute__((warn_unused_result))
static int load_ref_v4(struct selva_io *io, struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, struct SelvaTypeEntry *dst_te, ssize_t index)
{
    node_id_t dst_id;
    struct SelvaNode *dst_node;
    struct SelvaNodeReferenceAny ref = { .type = SELVA_NODE_REFERENCE_NULL };
    int err = 0;

    io->sdb_read(&dst_id, sizeof(dst_id), 1, io);

    if (likely(dst_id != 0)) {
        dst_node = selva_upsert_node(dst_te, dst_id);
        if (fs->type == SELVA_FIELD_TYPE_REFERENCE) {
            err = selva_fields_reference_set(db, node, fs, dst_node, &ref);
        } else if (fs->type == SELVA_FIELD_TYPE_REFERENCES) {
            enum selva_fields_references_insert_flags insert_flags = SELVA_FIELDS_REFERENCES_INSERT_FLAGS_REORDER | SELVA_FIELDS_REFERENCES_INSERT_FLAGS_IGNORE_SRC_DEPENDENT;
            err = selva_fields_references_insert(db, node, fs, index, insert_flags, dst_te, dst_node, &ref);
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
    }

    /*
     * Load meta.
     */
    node_id_t edge;
    io->sdb_read(&edge, sizeof(edge), 1, io); /* Always read. */
    if (edge) {
        switch (ref.type) {
        case SELVA_NODE_REFERENCE_LARGE:
            (void)selva_fields_ensure_ref_edge(db, node, &fs->edge_constraint, ref.large, edge);
            break;
        case SELVA_NODE_REFERENCE_NULL:
        case SELVA_NODE_REFERENCE_SMALL:
            break;
        }
    }

    return err;
}

__attribute__((warn_unused_result))
static int load_field_reference_v4(struct selva_io *io, struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    struct SelvaTypeEntry *dst_te = selva_get_type_by_index(db, fs->edge_constraint.dst_node_type);
    sdb_arr_len_t nr_refs;

    io->sdb_read(&nr_refs, sizeof(nr_refs), 1, io);
    return (nr_refs) ? load_ref_v4(io, db, node, fs, dst_te, -1) : 0;
}

__attribute__((warn_unused_result))
static int load_field_reference(struct selva_io *io, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    sdb_arr_len_t nr_refs;

    io->sdb_read(&nr_refs, sizeof(nr_refs), 1, io);
    if (nr_refs) {
        struct SelvaNodeLargeReference *ref = selva_fields_ensure_reference(node, fs);

        io->sdb_read(&ref->dst, sizeof(ref->dst), 1, io);
        io->sdb_read(&ref->edge, sizeof(ref->edge), 1, io);
    }

    return 0;
}

__attribute__((warn_unused_result))
static int load_field_references_v4(struct selva_io *io, struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    struct SelvaTypeEntry *dst_te = selva_get_type_by_index(db, fs->edge_constraint.dst_node_type);
    sdb_arr_len_t nr_refs;
    int err = 0;

    io->sdb_read(&nr_refs, sizeof(nr_refs), 1, io);
    (void)selva_fields_prealloc_refs(db, node, fs, nr_refs);
    for (sdb_arr_len_t i = 0; i < nr_refs; i++) {
        err = load_ref_v4(io, db, node, fs, dst_te, i);
        if (err) {
            break;
        }
    }

    return err;
}

__attribute__((warn_unused_result))
static int load_field_references(struct selva_io *io, struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    sdb_arr_len_t nr_refs;
    int err = 0;

    io->sdb_read(&nr_refs, sizeof(nr_refs), 1, io);
    if (nr_refs == 0) {
        return 0;
    }

    (void)selva_fields_prealloc_refs(db, node, fs, nr_refs);
    struct SelvaNodeReferences *refs = selva_fields_get_references(node, fs);
    if (!refs) {
        return SELVA_ENOENT;
    }

    refs->nr_refs = nr_refs;
    refs->offset = 0;

    switch (refs->size) {
    case SELVA_NODE_REFERENCE_SMALL:
        io->sdb_read(refs->small, sizeof(refs->small[0]), nr_refs, io);
        break;
    case SELVA_NODE_REFERENCE_LARGE:
        io->sdb_read(refs->large, sizeof(refs->large[0]), nr_refs, io);
        break;
    default:
        db_panic("Invalid ref type: %d", refs->size);
    }

    io->sdb_read(refs->index, sizeof(refs->index[0]), nr_refs, io);

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
            if (io->sdb_version <= 4) {
                err = load_field_reference_v4(io, db, node, fs);
            } else {
                err = load_field_reference(io, node, fs);
            }
            break;
        case SELVA_FIELD_TYPE_REFERENCES:
            if (io->sdb_version <= 4) {
                err = load_field_references_v4(io, db, node, fs);
            } else {
                err = load_field_references(io, db, node, fs);
            }
            break;
        case SELVA_FIELD_TYPE_WEAK_REFERENCE: // < v4 compat
            err = load_field_weak_reference_v3(io, db, node, fs);
            break;
        case SELVA_FIELD_TYPE_WEAK_REFERENCES: // < v4 compat
            err = load_field_weak_references_v3(io, db, node, fs);
            break;
        case SELVA_FIELD_TYPE_MICRO_BUFFER:
            err = load_field_micro_buffer(io, node, fs);
            break;
        case SELVA_FIELD_TYPE_ALIAS:
        case SELVA_FIELD_TYPE_ALIASES:
            /* NOP */
            break;
        case SELVA_FIELD_TYPE_COLVEC:
            selva_io_errlog(io, "Colvec not supported in fields");
            err = SELVA_ENOTSUP;
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
static int load_type(struct selva_io *io, struct SelvaDb *db, struct SelvaTypeEntry *te)
{
    int err;

    if (!read_dump_magic(io, DUMP_MAGIC_TYPES)) {
        selva_io_errlog(io, "Ivalid types magic");
        return SELVA_EINVAL;
    }

    node_type_t type;
    io->sdb_read(&type, sizeof(type), 1, io);

    if (te->type != type) {
        selva_io_errlog(io, "Invalid type found: %d != %d", type, te->type);
        return SELVA_EINVAL;
    }

    err = load_nodes(io, db, te);
    if (err) {
        return err;
    }

    /**
     * Columnar fields.
     */
    if (io->sdb_version >= 2) {
        block_id_t block_i;

        if (!read_dump_magic(io, DUMP_MAGIC_COLVEC)) {
            selva_io_errlog(io, "Ivalid types magic");
            return SELVA_EINVAL;
        }

        io->sdb_read(&block_i, sizeof(block_i), 1, io);
        static_assert(sizeof(block_i) == sizeof(uint32_t));

        for (size_t i = 0; i < te->ns.nr_colvecs; i++) {
            uint8_t slab_present;

            io->sdb_read(&slab_present, sizeof(slab_present), 1, io);
            if (slab_present) {
                /*
                 * Load the whole slab at once.
                 */
                struct SelvaColvec *colvec = &te->col_fields.colvec[i];
                void *slab = colvec_init_slab(colvec, block_i);
                if (io->sdb_read(slab, colvec->slab_size, 1, io) != 1) {
                    selva_io_errlog(io, "colvec slab");
                    return SELVA_EINVAL;
                }
            }
        }
    }

    return 0;
}

__attribute__((warn_unused_result))
static int load_common_ids(struct selva_io *io, struct selva_dump_common_data *com)
{
    sdb_arr_len_t len;
    node_id_t *data = nullptr;

    if (!read_dump_magic(io, DUMP_MAGIC_COMMON_IDS)) {
        selva_io_errlog(io, "Ivalid types magic");
        return SELVA_EINVAL;
    }

    if (io->sdb_read(&len, sizeof(len), 1, io) != 1) {
        selva_io_errlog(io, "%s: len", __func__);
        return SELVA_EIO;
    }

    if (likely(len > 0)) {
        data = selva_malloc(len * sizeof(node_id_t));
        if (io->sdb_read(data, sizeof(node_id_t), len, io) != 1) {
            selva_io_errlog(io, "%s: data", __func__);
            return SELVA_EIO;
        }
    }

    com->ids_data = data;
    com->ids_len = len;
    return 0;
}

__attribute__((warn_unused_result))
static int load_common_blocks(struct selva_io *io, struct selva_dump_common_data *com)
{
    sdb_arr_len_t len;
    struct selva_dump_blocks *blocks;

    if (!read_dump_magic(io, DUMP_MAGIC_COMMON_BLOCKS)) {
        selva_io_errlog(io, "Ivalid types magic");
        return SELVA_EINVAL;
    }

    if (io->sdb_read(&len, sizeof(len), 1, io) != 1) {
        selva_io_errlog(io, "%s: len", __func__);
        return SELVA_EIO;
    }

#if 0
    if (likely(len > 0)) {
        blocks = selva_malloc(len * sizeof(node_id_t));
        if (io->sdb_read(blocks, sizeof(node_id_t), len, io) != 1) {
            selva_io_errlog(io, "%s: data", __func__);
            return SELVA_EIO;
        }
    }

    com->ids_data = data;
    com->ids_len = len;
#endif
    return 0;
}

int selva_dump_load_common(struct SelvaDb *db, struct selva_dump_common_data *com, const char *filename)
{
    struct selva_io io = {
        .errlog_buf = com->errlog_buf,
        .errlog_left = com->errlog_size,
    };
    int err;

    err = selva_io_init_file(&io, filename, SELVA_IO_FLAGS_READ | SELVA_IO_FLAGS_COMPRESSED);
    if (err) {
        return err;
    }

    db->sdb_version = io.sdb_version;

    err = load_schema(&io, db);
    err = err ?: load_expire(&io, db);
    if (io.sdb_version >= 3) {
        err = err ?: load_common_ids(&io, com);
    }
    if (io.sdb_version >= 9) {
        err = err ?: load_common_blocks(&io, com);
    }
    selva_io_end(&io, nullptr);

    return err;
}

int selva_dump_load_block(struct SelvaDb *db, struct SelvaTypeEntry *te, const char *filename, char *errlog_buf, size_t errlog_size)
{
    struct selva_io io = {
        .errlog_buf = errlog_buf,
        .errlog_left = errlog_size,
    };
    int err;

    err = selva_io_init_file(&io, filename, SELVA_IO_FLAGS_READ | SELVA_IO_FLAGS_COMPRESSED);
    if (err) {
        return err;
    }

    if (io.sdb_version > db->sdb_version) {
        selva_io_errlog(&io, "SDB version mismatch! common: %"PRIu32" block: %"PRIu32, db->sdb_version, io.sdb_version);
        err = SELVA_ENOTSUP;
        goto fail;
    }

    err = load_type(&io, db, te);
    if (err) {
        goto fail;
    }

    if (io.sdb_version >= 9) {
        selva_hash128_t block_hash;

        if (!read_dump_magic(&io, DUMP_MAGIC_BLOCK_HASH)) {
            selva_io_errlog(&io, "Invalid block hash magic");
            err = SELVA_EINVAL;
            goto fail;
        }

        if (io.raw_read(&io, &block_hash, sizeof(block_hash)) != 1) {
            err = SELVA_EINVAL;
            goto fail;
        }

        /* TODO Do something with block_hash */
    }

fail:
    selva_io_end(&io, nullptr);
    return err;
}
