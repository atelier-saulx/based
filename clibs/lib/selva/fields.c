/*
 * Copyright (c) 2024-2026 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <inttypes.h>
#include <stdio.h>
#include <string.h>
#include "jemalloc_selva.h"
#include "selva/align.h"
#include "selva/selva_hash128.h"
#include "selva/selva_lang.h"
#include "selva/selva_string.h"
#include "selva/colvec.h"
#include "selva_error.h"
#include "bits.h"
#include "db.h"
#include "db_panic.h"
#include "selva/fast_linear_search.h"
#include "selva/node_id_set.h"
#include "selva/fields.h"

#if defined(EN_VALGRIND)
#define selva_sallocx(p, v)     0
#endif

static struct SelvaNode *next_ref_edge_node(struct SelvaTypeEntry *edge_type);
static void reference_edge_destroy(
        struct SelvaDb *db,
        const struct EdgeFieldConstraint *efc,
        struct SelvaNodeLargeReference *ref,
        bool keep_edge_node);

/**
 * Size of each type in fields.data.
 */
static const size_t selva_field_data_size[] = {
    [SELVA_FIELD_TYPE_NULL] = 0,
    [SELVA_FIELD_TYPE_STRING] = sizeof(struct selva_string),
    [SELVA_FIELD_TYPE_TEXT] = sizeof(struct SelvaTextField),
    [SELVA_FIELD_TYPE_REFERENCE] = sizeof(struct SelvaNodeLargeReference),
    [SELVA_FIELD_TYPE_REFERENCES] = sizeof(struct SelvaNodeReferences),
    [SELVA_FIELD_TYPE_MICRO_BUFFER] = 0, /* check fs. */
    [SELVA_FIELD_TYPE_ALIAS] = 0, /* Aliases are stored separately under the type struct. */
    [SELVA_FIELD_TYPE_COLVEC] = sizeof(void *),
};

size_t selva_fields_get_data_size(const struct SelvaFieldSchema *fs)
{
    const enum SelvaFieldType type = fs->type;

    if (type == SELVA_FIELD_TYPE_STRING) {
        const size_t fixed_len = fs->string.fixed_len;

        if (fixed_len > 0) {
            return sizeof(struct selva_string) + SELVA_STRING_STATIC_BUF_SIZE_WCRC(fs->string.fixed_len);
        } else {
            return sizeof(struct selva_string);
        }
    } else if (type == SELVA_FIELD_TYPE_MICRO_BUFFER) {
        return fs->smb.len;
    } else {
        return selva_field_data_size[type];
    }
}

static struct SelvaFieldInfo alloc_block(struct SelvaFields *fields, const struct SelvaFieldSchema *fs)
{
    auto data = (char *)fields->data;
    const size_t off = fields->data_len;
    const size_t field_data_size = selva_fields_get_data_size(fs);
    const size_t new_size = ALIGNED_SIZE(off + field_data_size, SELVA_FIELDS_DATA_ALIGN);

    if ((ssize_t)new_size > (ssize_t)((1 << bitsizeof(struct SelvaFields, data_len)) - 1)) {
        db_panic("new_size too large: %zu", new_size);
    }
    if ((off & ~(size_t)((((1 << bitsizeof(struct SelvaFieldInfo, off)) - 1) << SELVA_FIELDS_OFF))) != 0) {
        db_panic("fields->data too full or invalid offset: %zu", off);
    }

    if (!data || selva_sallocx(data, 0) < new_size) {
        data = fields->data = selva_realloc(data, new_size);
    }
    fields->data_len = new_size;
    memset(data + off, 0, field_data_size);

    return (struct SelvaFieldInfo){
        .in_use = true,
        .off = off >> SELVA_FIELDS_OFF,
    };
}

#if __has_c_attribute(reproducible)
[[reproducible]]
#endif
static inline void *nfo2p(const struct SelvaFields *fields, const struct SelvaFieldInfo *nfo)
{
    auto data = (char *)fields->data;
    void *p = data + (nfo->off << SELVA_FIELDS_OFF);

    if (unlikely((char *)p > data + fields->data_len)) {
        db_panic("Invalid field data access");
    }

    return p;
}

#define NFO2P_QP(T, F, S, ...) \
    STATIC_IF(IS_POINTER_CONST((S)), \
            (T const *) (F) ((S) __VA_OPT__(,) __VA_ARGS__), \
            (T *) (F) ((S) __VA_OPT__(,) __VA_ARGS__))

#define nfo2p(FIELDS, NFO) NFO2P_QP(void, nfo2p, (FIELDS), (NFO))

void *selva_fields_nfo2p(struct SelvaFields *fields, const struct SelvaFieldInfo *nfo)
{
    return nfo2p(fields, nfo);
}

/**
 * Ensure that a field is allocated properly.
 * @param node Optional node context.
 * @param fields is the fields structure modified.
 */
static struct SelvaFieldInfo *ensure_field(struct SelvaFields *fields, const struct SelvaFieldSchema *fs)
{
    struct SelvaFieldInfo *nfo;

    assert(fs->field < fields->nr_fields);

    nfo = &fields->fields_map[fs->field];
    if (!nfo->in_use) {
        *nfo = alloc_block(fields, fs);
        memset(nfo2p(fields, nfo), 0, selva_fields_get_data_size(fs));
    }

    return nfo;
}

struct SelvaNodeLargeReference *selva_fields_ensure_reference(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs)
{
    auto fields = &node->fields;
    auto nfo = ensure_field(fields, fs);

    return nfo2p(fields, nfo);
}

/**
 * Initialize a reference(s) field.
 * Accepts both SELVA_FIELD_TYPE_REFERENCE and SELVA_FIELD_TYPE_REFERENCES.
 */
static struct SelvaFieldInfo *ensure_field_references(struct SelvaFields *fields, const struct SelvaFieldSchema *fs, enum SelvaNodeReferenceType type)
{
    auto nfo = ensure_field(fields, fs);

    if (fs->type == SELVA_FIELD_TYPE_REFERENCES) {
        struct SelvaNodeReferences *refs = nfo2p(fields, nfo);
        refs->size = type;
    } else {
        assert(fs->type == SELVA_FIELD_TYPE_REFERENCE);
    }

    return nfo;
}

/**
 * Get a mutable string in fields at fs/nfo.
 * @param unsafe Get a mutable string in fields at fs/nfo without initializing the buffer.
 */
static inline struct selva_string *get_mutable_string(
        struct SelvaFields *fields,
        const struct SelvaFieldSchema *fs,
        struct SelvaFieldInfo *nfo,
        size_t initial_len,
        bool unsafe)
{
    struct selva_string *s = nfo2p(fields, nfo);

    assert(nfo->in_use);
#if 0
    assert(s && ((uintptr_t)s & 7) == 0);
#endif

    if (!(s->flags & SELVA_STRING_STATIC)) {
        int err;

        if (fs->string.fixed_len == 0) {
            const enum selva_string_flags flags =
                SELVA_STRING_MUTABLE | SELVA_STRING_CRC |
                (unsafe ? SELVA_STRING_NOZERO : 0);
            err = selva_string_init(s, nullptr, initial_len, flags);
        } else {
            const enum selva_string_flags flags =
                SELVA_STRING_MUTABLE_FIXED | SELVA_STRING_CRC |
                (unsafe ? SELVA_STRING_NOZERO : 0);
            assert(initial_len <= fs->string.fixed_len);
            err = selva_string_init(s, nullptr, fs->string.fixed_len, flags);
        }
        if (err) {
            s = nullptr;
        }
    }

    return s;
}

static int set_field_string(struct SelvaFields *fields, const struct SelvaFieldSchema *fs, struct SelvaFieldInfo *nfo, const char *str, size_t len)
{
    struct selva_string *s;

    assert(len >= 2 + sizeof(uint32_t));
    assume(len >= 2 + sizeof(uint32_t));

    if (fs->string.fixed_len > 0 && len > fs->string.fixed_len) {
        return SELVA_ENOBUFS;
    }

    uint32_t crc;
    memcpy(&crc, str + len - sizeof(crc), sizeof(crc));
    s = get_mutable_string(fields, fs, nfo, len - sizeof(crc), true);
    (void)selva_string_replace_crc(s, str, len - sizeof(crc), crc);
    if (str[1] == 1) selva_string_set_compress(s);

    return 0;
}

int selva_fields_set_string(struct SelvaNode *node, const struct SelvaFieldSchema *fs, const char *str, size_t len)
{
    struct SelvaFields *fields = &node->fields;
    struct SelvaFieldInfo *nfo = ensure_field(fields, fs);

    if (fs->type != SELVA_FIELD_TYPE_STRING) {
        return SELVA_EINTYPE;
    }

    return set_field_string(fields, fs, nfo, str, len);
}

#if 0
static void print_refs(struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    assert(fs->field < fields->nr_fields);

    struct SelvaFields *fields = &node->fields;
    struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];

    assert(fs->type == SELVA_FIELD_TYPE_REFERENCES);
    if (nfo->in_use) {
        struct SelvaNodeReferences *refs = nfo2p(fields, nfo);

        fprintf(stderr, "node: %u: [", node->node_id);
        for (size_t i = 0; i < refs->nr_refs; i++) {
            fprintf(stderr, "%u%s", refs->refs[i].dst, (i < refs->nr_refs - 1) ? ", " : "");
        }
        fprintf(stderr, "] %p\n", refs);
    }
}
#endif

static field_t refs_get_nr_fields(struct SelvaDb *db, const struct EdgeFieldConstraint *efc)
{
    const struct SelvaFieldsSchema *efc_fields_schema = selva_get_edge_field_fields_schema(db, efc);
    const field_t nr_fields = efc_fields_schema ? efc_fields_schema->nr_fields - efc_fields_schema->nr_virtual_fields : 0;

    return nr_fields;
}

__attribute__((pure))
static enum SelvaNodeReferenceType refs_get_type(struct SelvaDb *db, const struct EdgeFieldConstraint *efc)
{
    return refs_get_nr_fields(db, efc) == 0 ? SELVA_NODE_REFERENCE_SMALL : SELVA_NODE_REFERENCE_LARGE;
}

static ssize_t refs_find_node_i(struct SelvaNodeReferences *refs, node_id_t node_id)
{
    switch (refs->size) {
    case SELVA_NODE_REFERENCE_SMALL:
        return fast_linear_search_references_small(refs->small, refs->nr_refs, node_id);
    case SELVA_NODE_REFERENCE_LARGE:
        return fast_linear_search_references_large(refs->large, refs->nr_refs, node_id);
    default:
        return -1;
    }
}

static const struct SelvaFieldSchema *get_edge_dst_fs(
        const struct SelvaDb *db,
        const struct SelvaFieldSchema *fs_src)
{
    const struct EdgeFieldConstraint *efc = &fs_src->edge_constraint;
    struct SelvaTypeEntry *type_dst;

    if (fs_src->type != SELVA_FIELD_TYPE_REFERENCE &&
        fs_src->type != SELVA_FIELD_TYPE_REFERENCES) {
        return nullptr;
    }

    /* TODO This could be also handled with a Generic */
    type_dst = selva_get_type_by_index((typeof_unqual(*db) *)db, efc->dst_node_type);
    assert(type_dst->type == efc->dst_node_type);

    return selva_get_fs_by_te_field(type_dst, efc->inverse_field);
}

static void remove_refs_offset(struct SelvaNodeReferences *refs)
{
    if (refs->offset > 0) {
        switch (refs->size) {
        case SELVA_NODE_REFERENCE_SMALL:
            memmove(refs->small - refs->offset, refs->small, refs->nr_refs * sizeof(*refs->small));
            refs->small -= refs->offset;
            break;
        case SELVA_NODE_REFERENCE_LARGE:
            memmove(refs->large - refs->offset, refs->large, refs->nr_refs * sizeof(*refs->large));
            refs->large -= refs->offset;
            break;
        default:
            return;
        }
        refs->offset = 0;
    }
}

/**
 * Write a ref to the fields data.
 * Note that this function doesn't touch the destination node.
 * @param edge can be null.
 */
static void write_ref(
        struct SelvaNode * restrict node,
        const struct SelvaFieldSchema *fs,
        struct SelvaNode * restrict dst,
        struct SelvaNode * restrict edge,
        struct SelvaNodeLargeReference **ref_out)
{
    auto fields = &node->fields;
    struct SelvaFieldInfo *nfo;
    struct SelvaNodeLargeReference ref = {
        .dst = dst->node_id,
        .edge = edge ? edge->node_id : 0,
    };

    nfo = ensure_field(fields, fs);
    void *vp = nfo2p(fields, nfo);

    assert(!memcmp(vp, &(struct SelvaNodeLargeReference){}, sizeof(struct SelvaNodeLargeReference)));
    memcpy(vp, &ref, sizeof(ref));

    if (ref_out) {
        assert(((uintptr_t)vp & 7) == 0);
        *ref_out = (struct SelvaNodeLargeReference *)vp;
    }
}

/**
 * Write a ref to the fields data.
 * Note that this function doesn't touch the destination node.
 * @param edge can be null.
 */
static void write_refs(
        struct SelvaNode * restrict node,
        const struct SelvaFieldSchema *fs,
        ssize_t index,
        struct SelvaNode * restrict dst,
        struct SelvaNode * restrict edge,
        struct SelvaNodeReferenceAny *ref_out)
{
    auto fields = &node->fields;
    void *vp = nfo2p(fields, &fields->fields_map[fs->field]);
    struct SelvaNodeReferences refs;

    memcpy(&refs, vp, sizeof(refs));
    assert(index >= -1);
    assume(index >= -1);

    if (refs.offset > 0) {
        if (index == 0) {
            /*
             * Lucky case:
             * 1. refs is already allocated,
             * 2. we have empty/unused space in front,
             * 3. new insertions falls within the empty space.
             */
            refs.offset--;
            refs.nr_refs++;
            switch (refs.size) {
            case SELVA_NODE_REFERENCE_SMALL:
                refs.small--;
                refs.small[0] = (struct SelvaNodeSmallReference){
                    .dst = dst->node_id,
                };
                break;
            case SELVA_NODE_REFERENCE_LARGE:
                refs.large--;
                refs.large[0] = (struct SelvaNodeLargeReference){
                    .dst = dst->node_id,
                    .edge = edge ? edge->node_id : 0,
                };
                break;
            default:
                db_panic("Invalid ref type: %d", refs.size);
            }

#if 0
            assert(node_id_set_has(refs.index, refs.nr_refs, dst->node_id));
#endif

            goto out;
        }
    }

    if (refs.any) {
        remove_refs_offset(&refs);
    }

    index = (index == -1) ? refs.nr_refs : (index > refs.nr_refs) ? refs.nr_refs : index;
    const size_t new_len = refs.nr_refs + 1;
    size_t new_size;

    switch (refs.size) {
    case SELVA_NODE_REFERENCE_SMALL:
        new_size = new_len * sizeof(*refs.small);
        break;
    case SELVA_NODE_REFERENCE_LARGE:
        new_size = new_len * sizeof(*refs.large);
        break;
    default:
        db_panic("Invalid ref type: %d", refs.size);
    }

    if (!refs.any || selva_sallocx(refs.any, 0) < new_size) {
        refs.any = selva_realloc(refs.any, new_size);
    }
    if ((size_t)index + 1 < new_len) {
        /* Move old refs to the right to make space. */
        assert(index + 1 + (new_len - 1 - index) <= new_len);
        assume(index + 1 + (new_len - 1 - index) <= new_len);
        switch (refs.size) {
        case SELVA_NODE_REFERENCE_SMALL:
            memmove(refs.small + index + 1, refs.small + index, (new_len - 1 - index) * sizeof(*refs.small));
            break;
        case SELVA_NODE_REFERENCE_LARGE:
            memmove(refs.large + index + 1, refs.large + index, (new_len - 1 - index) * sizeof(*refs.large));
            break;
        default:
            db_panic("Invalid ref type: %d", refs.size);
        }
    } else if (new_len - refs.nr_refs > 1) {
        /* Clear the gap created. */
        assert(refs.nr_refs + (new_len - refs.nr_refs) <= new_len);
        assume(refs.nr_refs + (new_len - refs.nr_refs) <= new_len);
        switch (refs.size) {
        case SELVA_NODE_REFERENCE_SMALL:
            memset(refs.small + refs.nr_refs, 0, (new_len - refs.nr_refs) * sizeof(*refs.small));
            break;
        case SELVA_NODE_REFERENCE_LARGE:
            memset(refs.large + refs.nr_refs, 0, (new_len - refs.nr_refs) * sizeof(*refs.large));
            break;
        default:
            db_panic("Invalid ref type: %d", refs.size);
        }
    }
    refs.nr_refs = new_len;

    /*
     * Finally set the new ref in its correct location.
     */
    switch (refs.size) {
    case SELVA_NODE_REFERENCE_SMALL:
        refs.small[index] = (struct SelvaNodeSmallReference){
            .dst = dst->node_id,
        };
        break;
    case SELVA_NODE_REFERENCE_LARGE:
        refs.large[index] = (struct SelvaNodeLargeReference){
            .dst = dst->node_id,
            .edge = edge ? edge->node_id : 0,
        };
        break;
    default:
        db_panic("Invalid ref type: %d", refs.size);
    }

#if 0
    assert(node_id_set_has(refs.index, refs.nr_refs, dst->node_id));
#endif

out:
    if (ref_out) {
        ref_out->type = refs.size;
        switch (refs.size) {
        case SELVA_NODE_REFERENCE_SMALL:
            ref_out->small = &refs.small[index];
            break;
        case SELVA_NODE_REFERENCE_LARGE:
            ref_out->large = &refs.large[index];
            break;
        default:
            ref_out->type = SELVA_NODE_REFERENCE_NULL;
            ref_out->any = nullptr;
        }
    }

    memcpy(vp, &refs, sizeof(refs));
}

/**
 * Clear single ref value.
 * A helper for remove_reference().
 * @returns the original value.
 */
static node_id_t del_single_ref(
        struct SelvaDb *db,
        struct SelvaNode *src_node,
        const struct EdgeFieldConstraint *efc,
        struct SelvaFields *fields,
        struct SelvaFieldInfo *nfo,
        bool ignore_dependent)
{
    void *vp = nfo2p(fields, nfo);
    struct SelvaNodeLargeReference ref;

    memcpy(&ref, vp, sizeof(ref));
    memset(vp, 0, sizeof(ref)); /* This is fine here because we have a copy of the original struct. */
    reference_edge_destroy(db, efc, &ref, false);

#if 0
    assert(!ref.dst || ref.dst->type == efc->dst_node_type);
#endif

    if (!ignore_dependent && (efc->flags & EDGE_FIELD_CONSTRAINT_FLAG_DEPENDENT)) {
        selva_expire_node(db, src_node->type, src_node->node_id, 0, SELVA_EXPIRE_NODE_STRATEGY_CANCEL_OLD);
    }

    return ref.dst;
}

/**
 * This is only a helper for remove_reference().
 */
static node_id_t del_multi_ref(
        struct SelvaDb *db,
        struct SelvaNode *src_node,
        const struct EdgeFieldConstraint *efc,
        struct SelvaNodeReferences *refs,
        size_t i,
        bool ignore_src_dependent)
{
    node_id_t dst_id;
    size_t id_set_len = refs->nr_refs;

    if (!refs->any || id_set_len == 0) {
        return 0;
    }

    assert(i < id_set_len);

    switch (refs->size) {
    case SELVA_NODE_REFERENCE_SMALL:
        dst_id = refs->small[i].dst;
        memset(&refs->small[i], 0, sizeof(refs->small[i]));
        break;
    case SELVA_NODE_REFERENCE_LARGE:
        dst_id = refs->large[i].dst;
        reference_edge_destroy(db, efc, &refs->large[i], false);
        memset(&refs->large[i], 0, sizeof(refs->large[i]));
        break;
    default:
        return 0;
    }

    assert(refs->index);
    if (!node_id_set_remove(&refs->index, &id_set_len, dst_id)) {
        db_panic("node_id not found in refs: %u:%u\n", efc->dst_node_type, dst_id);
    }

    if (i < refs->nr_refs - 1) {
        if (i == 0) {
            static_assert(sizeof(refs->offset) == sizeof(uint16_t));
            if (refs->offset == 0xffff) {
                remove_refs_offset(refs);
            }

            /*
             * Head removal can be done by offsetting the pointer.
             */
            refs->offset++;
            switch (refs->size) {
            case SELVA_NODE_REFERENCE_SMALL:
                refs->small++;
                break;
            case SELVA_NODE_REFERENCE_LARGE:
                refs->large++;
                break;
            default:
                db_panic("Invalid ref type: %d", refs->size);
            }
        } else if (i + 1 < refs->nr_refs) {
            /*
             * Otherwise we must do a slightly expensive memmove().
             */
            switch (refs->size) {
            case SELVA_NODE_REFERENCE_SMALL:
                memmove(&refs->small[i],
                        &refs->small[i + 1],
                        (refs->nr_refs - i - 1) * sizeof(struct SelvaNodeSmallReference));
                break;
            case SELVA_NODE_REFERENCE_LARGE:
                memmove(&refs->large[i],
                        &refs->large[i + 1],
                        (refs->nr_refs - i - 1) * sizeof(struct SelvaNodeLargeReference));
                break;
            default:
                db_panic("Invalid ref type: %d", refs->size);
            }
        }

        /*
         * Realloc if we have a lot of extra space.
         */
        switch (refs->size) {
        case SELVA_NODE_REFERENCE_SMALL:
            if (selva_sallocx(refs->small - refs->offset, 0) / sizeof(refs->small[0]) >= refs->nr_refs + 131072) {
                remove_refs_offset(refs);
                refs->small = selva_realloc(refs->small, refs->nr_refs * sizeof(refs->small[0]));
            }
            break;
        case SELVA_NODE_REFERENCE_LARGE:
            if (selva_sallocx(refs->large - refs->offset, 0) / sizeof(refs->large[0]) >= refs->nr_refs + 131072) {
                remove_refs_offset(refs);
                refs->large = selva_realloc(refs->large, refs->nr_refs * sizeof(refs->large[0]));
            }
            break;
        default:
            db_panic("Invalid ref type: %d", refs->size);
        }
    }
    refs->nr_refs--;

    assert(id_set_len == refs->nr_refs);
    assume(id_set_len == refs->nr_refs);

    if  (!ignore_src_dependent && (efc->flags & EDGE_FIELD_CONSTRAINT_FLAG_DEPENDENT) && refs->nr_refs == 0) {
        selva_expire_node(db, src_node->type, src_node->node_id, 0, SELVA_EXPIRE_NODE_STRATEGY_CANCEL_OLD);
    }

    return dst_id;
}

/**
 * One-side ref removal.
 */
static void clear_ref_dst(struct SelvaDb *db, const struct SelvaFieldSchema *fs_src, node_id_t dst_node_id, node_id_t src_node_id)
{
    if (dst_node_id == 0) {
        return;
    }

    struct SelvaTypeEntry *dst_type = selva_get_type_by_index(db, fs_src->edge_constraint.dst_node_type);
    assert(dst_type);

    /* TODO Partials */
    struct SelvaNode *dst = selva_find_node(dst_type, dst_node_id).node;
    if (!dst) {
        return;
    }

    const struct SelvaFieldSchema *fs_dst;
    fs_dst = get_edge_dst_fs(db, fs_src);
    if (!fs_dst) {
        db_panic("field schema not found");
    }

    struct SelvaFields *fields_dst = &dst->fields;
    struct SelvaFieldInfo *nfo_dst;

    assert(fs_dst->field < fields_dst->nr_fields);
    assume(fs_src->type == SELVA_FIELD_TYPE_REFERENCE || fs_src->type == SELVA_FIELD_TYPE_REFERENCES);
    assume(fs_dst->type == SELVA_FIELD_TYPE_REFERENCE || fs_dst->type == SELVA_FIELD_TYPE_REFERENCES);

    nfo_dst = &fields_dst->fields_map[fs_dst->field];
    if (!nfo_dst->in_use) {
        return;
    }

    if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE) {
        node_id_t removed;

        removed = del_single_ref(db, dst, &fs_dst->edge_constraint, fields_dst, nfo_dst, false);
        assert(removed == src_node_id);
    } else if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCES) {
        struct SelvaNodeReferences *refs = nfo2p(fields_dst, nfo_dst);

        if (!node_id_set_has(refs->index, refs->nr_refs, src_node_id)) {
            return;
        }

        ssize_t i = refs_find_node_i(refs, src_node_id);
        assert(i >= 0);
        (void)del_multi_ref(db, dst, &fs_dst->edge_constraint, refs, i, false);
    }

    selva_mark_dirty(selva_get_type_by_index(db, fs_dst->edge_constraint.dst_node_type), src_node_id);
    selva_mark_dirty(dst_type, dst_node_id);
}

/*
 * add_to_refs_index() must be called before this function.
 */
static inline void write_ref_2way(
        struct SelvaDb *db,
        struct SelvaNode * restrict src, const struct SelvaFieldSchema *fs_src, ssize_t index,
        struct SelvaNode * restrict dst, const struct SelvaFieldSchema *fs_dst,
        struct SelvaNodeReferenceAny *ref_out)
{
    struct SelvaNode *edge = nullptr;

    if (refs_get_type(db, &fs_src->edge_constraint) == SELVA_NODE_REFERENCE_LARGE) {
        struct SelvaTypeEntry *edge_type;

        edge_type = selva_get_type_by_index(db, fs_src->edge_constraint.edge_node_type);
        edge = next_ref_edge_node(edge_type);
    }

#if 0
    assert(fs_src->edge_constraint.dst_node_type == dst->type);
    assert(fs_dst->edge_constraint.dst_node_type == src->type);
#endif

    if (fs_src->type == SELVA_FIELD_TYPE_REFERENCE) {
        write_ref(src, fs_src, dst, edge, ref_out ? &ref_out->large : nullptr);
        ref_out->type = SELVA_NODE_REFERENCE_LARGE;
    } else {
#if 0
        assert(fs_src->type == SELVA_FIELD_TYPE_REFERENCES);
#endif
        assume(fs_src->type == SELVA_FIELD_TYPE_REFERENCES);
        write_refs(src, fs_src, index, dst, edge, ref_out);
    }

    if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE) {
        write_ref(dst, fs_dst, src, edge, nullptr);
    } else {
#if 0
        assert(fs_dst->type == SELVA_FIELD_TYPE_REFERENCES);
#endif
        assume(fs_dst->type == SELVA_FIELD_TYPE_REFERENCES);
        write_refs(dst, fs_dst, -1, src, edge, nullptr);
    }
}

/**
 * Delete a reference field edge.
 * Clears both ways.
 * The removed dst_node_id is marked dirty so that the caller doesn't need to do it.
 * @param orig_dst should be given if fs_src is of type SELVA_FIELD_TYPE_REFERENCES.
 * @returns the removed dst_node_id.
 */
static node_id_t remove_reference(struct SelvaDb *db, struct SelvaNode *src, const struct SelvaFieldSchema *fs_src, node_id_t orig_dst, ssize_t idx, bool ignore_src_dependent)
{
    struct SelvaFields *fields_src = &src->fields;
    struct SelvaFieldInfo *nfo_src = &fields_src->fields_map[fs_src->field];
    struct SelvaTypeEntry *dst_type = selva_get_type_by_index(db, fs_src->edge_constraint.dst_node_type);
    node_id_t dst_node_id = 0;

    assert(dst_type);

#if 0
    assert(selva_get_fs_by_node(db, src, fs_src->field) == fs_src);
#endif

    if (nfo_src->in_use) {
        if (fs_src->type == SELVA_FIELD_TYPE_REFERENCE) {
            dst_node_id = del_single_ref(db, src, &fs_src->edge_constraint, fields_src, nfo_src, ignore_src_dependent);
        } else if (fs_src->type == SELVA_FIELD_TYPE_REFERENCES) {
            struct SelvaNodeReferences *refs = nfo2p(fields_src, nfo_src);

            if (refs->size == SELVA_NODE_REFERENCE_NULL) {
                return 0;
            }

            ssize_t i = (idx >= 0) ? idx : refs_find_node_i(refs, orig_dst);
            if (i >= 0 && i < refs->nr_refs) {
                dst_node_id = del_multi_ref(db, src, &fs_src->edge_constraint, refs, i, ignore_src_dependent);
            }
        }
    }

    /*
     * Clear from the other end.
     */
    if (dst_node_id != 0) {
        clear_ref_dst(db, fs_src, dst_node_id, src->node_id);
    }

    return dst_node_id;
}

static size_t remove_references_tail(
        struct SelvaDb *db,
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        size_t limit)
{
    auto fields = &node->fields;
    struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];
    struct SelvaNodeReferences *refs;
    size_t removed = 0;

    if (!nfo->in_use) {
        return 0;
    }

    refs = nfo2p(fields, nfo);

    /*
     * Cleanup the tail.
     */
    while (refs->nr_refs > limit) {
        removed += !!remove_reference(db, node, fs, removed, 0, false);
    }

    return removed;
}

static struct SelvaNodeReferences *clear_references(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, bool ignore_src_dependent)
{
    struct SelvaTypeEntry *te = selva_get_type_by_index(db, node->type);
    auto fields = &node->fields;
    assert(fs->field < fields->nr_fields);
    struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];
    struct SelvaNodeReferences *refs;

    if (!nfo->in_use) {
        return nullptr;
    }

    refs = nfo2p(fields, nfo);
#if 0
    assert(((uintptr_t)refs & 7) == 0);
#endif

    selva_mark_dirty(te, node->node_id);

    struct SelvaTypeEntry *dst_type = selva_get_type_by_index(db, fs->edge_constraint.dst_node_type);
    assert(dst_type);

    while (refs->nr_refs > 0) {
        ssize_t i = refs->nr_refs - 1;
        node_id_t dst_node_id, removed_dst;

        /*
         * Deleting the last ref first is faster because a memmove() is not needed.
         */
        switch (refs->size) {
        case SELVA_NODE_REFERENCE_SMALL:
            dst_node_id = refs->small[i].dst;
            break;
        case SELVA_NODE_REFERENCE_LARGE:
            dst_node_id = refs->large[i].dst;
            break;
        default:
            goto out;
        }

        removed_dst = remove_reference(db, node, fs, dst_node_id, i, ignore_src_dependent);
        if (removed_dst != 0) {
            assert(removed_dst == dst_node_id);
        }
    }

out:
    selva_free(refs->index);
    refs->index = nullptr;

    return refs;
}

__attribute__((nonnull(1, 2, 3)))
static void remove_references(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    struct SelvaNodeReferences *refs = clear_references(db, node, fs, false);
    if (refs) {
        switch (refs->size) {
        case SELVA_NODE_REFERENCE_SMALL:
            selva_free(refs->small - refs->offset);
            break;
        case SELVA_NODE_REFERENCE_LARGE:
            selva_free(refs->large - refs->offset);
            break;
        default:
            assert(refs->any == NULL);
            break;
        }
        /*
         * refs->index is already freed.
         * TODO but maybe index shouldn't be freed by clear?
         */
    }
}


__attribute__((nonnull(1, 2)))
static void unload_references(struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    auto fields = &node->fields;
    struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];
    struct SelvaNodeReferences *refs;

    if (!nfo->in_use) {
        return;
    }

    refs = nfo2p(fields, nfo);
    switch (refs->size) {
        case SELVA_NODE_REFERENCE_SMALL:
            selva_free(refs->small - refs->offset);
            selva_free(refs->index);
            break;
        case SELVA_NODE_REFERENCE_LARGE:
            selva_free(refs->large - refs->offset);
            selva_free(refs->index);
            break;
        default:
            assert(refs->any == NULL);
            break;
    }
    refs->size = SELVA_NODE_REFERENCE_NULL;
}

static inline int _selva_fields_get_mutable_string(struct SelvaNode *node, const struct SelvaFieldSchema *fs, bool unsafe, size_t len, struct selva_string **s)
{
    auto fields = &node->fields;
    struct SelvaFieldInfo *nfo;

    if (fs->type != SELVA_FIELD_TYPE_STRING) {
        return SELVA_EINTYPE;
    }

    if (fs->string.fixed_len > 0 && len > fs->string.fixed_len) {
        return SELVA_ENOBUFS;
    }

    nfo = ensure_field(fields, fs);
    *s = get_mutable_string(fields, fs, nfo, len, unsafe);

    return !*s ? SELVA_EINVAL : 0;
}

int selva_fields_get_mutable_string(struct SelvaNode *node, const struct SelvaFieldSchema *fs, size_t len, struct selva_string **s)
{
    return _selva_fields_get_mutable_string(node, fs, false, len, s);
}

int selva_fields_get_mutable_string_unsafe(struct SelvaNode *node, const struct SelvaFieldSchema *fs, size_t len, struct selva_string **s)
{
    return _selva_fields_get_mutable_string(node, fs, true, len, s);
}

struct selva_string *selva_fields_ensure_string(struct SelvaNode *node, const struct SelvaFieldSchema *fs, size_t initial_len)
{
    if (fs->type != SELVA_FIELD_TYPE_STRING) {
        return nullptr;
    }

    auto fields = &node->fields;
    struct SelvaFieldInfo *nfo = ensure_field(fields, fs);

    return get_mutable_string(fields, fs, nfo, initial_len, false);
}

static void del_field_text(struct SelvaFields *fields, struct SelvaFieldInfo *nfo)
{
    struct SelvaTextField *text;

    assert(nfo->in_use);
    text = nfo2p(fields, nfo);

    const size_t len = text->len;
    for (size_t i = 0; i < len; i++) {
        selva_string_free(&text->tl[i]);
    }

    selva_free(text->tl);
    memset(text, 0, sizeof(*text));
}

static struct selva_string *find_text_by_lang(const struct SelvaTextField *text, enum selva_lang_code lang)
{
    const size_t len = text->len;

    for (size_t i = 0; i < len; i++) {
        struct selva_string *s = &text->tl[i];
        const uint8_t *buf;
        size_t blen;

        buf = selva_string_to_buf(s, &blen);
        if (blen >= (2 + sizeof(uint32_t)) && /* contains at least [lang | flag | .. | crc32 ] */
            buf[0] == lang) {
            return s;
        }
    }

    return nullptr;
}

struct ensure_text_field {
    struct SelvaTextField *text;
    struct selva_string *tl;
};

__attribute__((nonnull))
static struct ensure_text_field ensure_text_field(struct SelvaFields *fields, const struct SelvaFieldSchema *fs, enum selva_lang_code lang)
{
    struct SelvaFieldInfo *nfo;
    struct ensure_text_field res = {};

    if (fs->type != SELVA_FIELD_TYPE_TEXT) {
        db_panic("Invalid type for text! field: %d type: %s (%d)",
                 fs->field,
                 selva_str_field_type(fs->type), fs->type);
    }

    assert(fs->field < fields->nr_fields);
    nfo = &fields->fields_map[fs->field];
    if (!nfo->in_use) {
        *nfo = alloc_block(fields, fs);
        res.text = memset(nfo2p(fields, nfo), 0, sizeof(*res.text));
        res.tl = nullptr;
    } else {
        res.text = nfo2p(fields, nfo);
        res.tl = lang != selva_lang_none ? find_text_by_lang(res.text, lang) : nullptr;
    }

    return res;
}

static void init_tl(struct selva_string *tl, const char *str, size_t len, uint32_t crc)
{
    const enum selva_string_flags flags = (len <= sizeof(tl->emb) - sizeof(crc))
        ? SELVA_STRING_MUTABLE_FIXED
        : SELVA_STRING_MUTABLE;
    int err;

    err = selva_string_init_crc(tl, str, len, crc, flags);
    if (err) {
        db_panic("Failed to init a text field");
    }
}

int selva_fields_set_text(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        const char *str,
        size_t len)
{
    assert(len >= 2 + sizeof(uint32_t));
    assume(len >= 2 + sizeof(uint32_t));

    enum selva_lang_code lang = str[0];
    struct ensure_text_field tf;
    uint32_t crc;

    if (fs->type != SELVA_FIELD_TYPE_TEXT) {
        return SELVA_EINVAL;
    }

    memcpy(&crc, str + len - sizeof(crc), sizeof(crc));
    len -= sizeof(crc);

    tf = ensure_text_field(&node->fields, fs, lang);
    if (unlikely(!tf.text)) {
        db_panic("Text missing");
    }
    if (tf.tl) {
        if (tf.tl->flags & SELVA_STRING_MUTABLE_FIXED) {
            selva_string_free(tf.tl);
            init_tl(tf.tl, str, len, crc);
        } else {
            (void)selva_string_replace_crc(tf.tl, str, len, crc);
        }
    } else {
        tf.text->tl = selva_realloc(tf.text->tl, ++tf.text->len * sizeof(*tf.text->tl));
        tf.tl = memset(&tf.text->tl[tf.text->len - 1], 0, sizeof(*tf.tl));
        init_tl(tf.tl, str, len, crc);
    }

    return 0;
}

int selva_fields_get_mutable_text(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        enum selva_lang_code lang,
        size_t len,
        struct selva_string **out)
{
    struct ensure_text_field tf;
    int err;

    if (fs->type != SELVA_FIELD_TYPE_TEXT) {
        return SELVA_EINVAL;
    }

    tf = ensure_text_field(&node->fields, fs, lang);
    if (unlikely(!tf.text)) {
        db_panic("Text missing");
    } else if (tf.tl) {
        db_panic("We only support previously unset translations for now");
    }

    tf.text->tl = selva_realloc(tf.text->tl, ++tf.text->len * sizeof(*tf.text->tl));
    tf.tl = memset(&tf.text->tl[tf.text->len - 1], 0, sizeof(*tf.tl));

    err = selva_string_init(tf.tl, NULL, len, SELVA_STRING_MUTABLE | SELVA_STRING_CRC);
    if (err) {
        return err;
    }
    *out = tf.tl;

    return 0;
}

int selva_fields_get_text(
        struct SelvaNode * restrict node,
        const struct SelvaFieldSchema *fs,
        enum selva_lang_code lang,
        const char **str,
        size_t *len)
{
    auto fields = &node->fields;
    const struct SelvaFieldInfo *nfo;
    const struct SelvaTextField *text;
    struct selva_string *s;

    if (fs->type != SELVA_FIELD_TYPE_TEXT) {
        return SELVA_EINVAL;
    }

    nfo = &fields->fields_map[fs->field];
    if (!nfo->in_use) {
        return SELVA_ENOENT;
    }

    text = nfo2p(fields, nfo);
    s = find_text_by_lang(text, lang);
    if (s) {
        const char *res_str;
        size_t res_len;

        res_str = (const char *)selva_string_to_buf(s, &res_len);
        if (str) {
            *str = res_str;
        }
        if (len) {
            *len = res_len;
        }

        return 0;
    }

    return SELVA_ENOENT;
}

void *selva_fields_ensure_micro_buffer(struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    auto fields = &node->fields;
    struct SelvaFieldInfo *nfo;

    if (fs->type != SELVA_FIELD_TYPE_MICRO_BUFFER) {
        return nullptr;
    }

    nfo = ensure_field(fields, fs);

    return nfo2p(fields, nfo);
}

int selva_fields_set_micro_buffer(struct SelvaNode *node, const struct SelvaFieldSchema *fs, const void *value, size_t len)
{
    char *p;

    if (len > fs->smb.len) {
        return SELVA_EINVAL;
    }

    p = selva_fields_ensure_micro_buffer(node, fs);
    if (!p) {
        return SELVA_EINTYPE;
    }

    memcpy(p, value, len);
    memset(p + len, 0, fs->smb.len - len);

    return 0;
}

struct SelvaNodeReferenceAny selva_fields_references_get(const struct SelvaNodeReferences *refs, node_id_t dst_node_id)
{
    ssize_t i;
    struct SelvaNodeReferenceAny any = (struct SelvaNodeReferenceAny){
        .type = SELVA_NODE_REFERENCE_NULL,
    };

    if (refs && (refs->nr_refs < 100 || node_id_set_bsearch(refs->index, refs->nr_refs, dst_node_id) != -1)) {
        switch (refs->size) {
        case SELVA_NODE_REFERENCE_NULL:
            break;
        case SELVA_NODE_REFERENCE_SMALL:
            i = fast_linear_search_references_small(refs->small, refs->nr_refs, dst_node_id);
            if (i != -1) {
                any.type = SELVA_NODE_REFERENCE_SMALL;
                any.small = &refs->small[i];
            }
            break;
        case SELVA_NODE_REFERENCE_LARGE:
            i = fast_linear_search_references_large(refs->large, refs->nr_refs, dst_node_id);
            if (i != -1) {
                any.type = SELVA_NODE_REFERENCE_LARGE;
                any.large = &refs->large[i];
            }
            break;
        }
    }

    return any;
}

/**
 * @returns false if NOK
 */
static bool add_to_refs_index_(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        struct SelvaFieldInfo *nfo,
        node_id_t dst)
{
    bool res = true;

    if (fs->type == SELVA_FIELD_TYPE_REFERENCES) {
        assert(nfo->in_use);

        struct SelvaNodeReferences *refs = nfo2p(&node->fields, nfo);
        size_t nr_refs = 0;

        nr_refs = refs->nr_refs;
        res = node_id_set_add(&refs->index, &nr_refs, dst);
        if (res) {
            assert(nr_refs > refs->nr_refs);
            /* These will be equal again once the actual reference is created. */
        }
    }

    return res;
}

static bool add_to_refs_index(
        struct SelvaDb *db,
        struct SelvaNode * restrict src,
        struct SelvaNode * restrict dst,
        const struct SelvaFieldSchema * restrict fs_src,
        const struct SelvaFieldSchema * restrict fs_dst)
{
    const enum SelvaNodeReferenceType type = refs_get_type(db, &fs_src->edge_constraint);
    struct SelvaFieldInfo *nfo_src = ensure_field_references(&src->fields, fs_src, type);
    struct SelvaFieldInfo *nfo_dst = ensure_field_references(&dst->fields, fs_dst, type);
    const bool added_src = add_to_refs_index_(src, fs_src, nfo_src, dst->node_id);
    const bool added_dst = add_to_refs_index_(dst, fs_dst, nfo_dst, src->node_id);

    /*
     * If both are refs then:
     * added_src && added_dst || !added_src && !added_src == true
     * If one is ref then it's always true and the other is either false or true.
     */

    return added_src && added_dst;
}

int selva_fields_references_insert(
        struct SelvaDb *db,
        struct SelvaNode * restrict node,
        const struct SelvaFieldSchema *fs,
        ssize_t index,
        enum selva_fields_references_insert_flags flags,
        struct SelvaTypeEntry *te_dst,
        struct SelvaNode *restrict dst,
        struct SelvaNodeReferenceAny *ref_out)
{
    const struct SelvaFieldSchema *fs_dst;
    node_type_t type_dst = te_dst->type;

    if (fs->type != SELVA_FIELD_TYPE_REFERENCES ||
        type_dst != dst->type ||
        type_dst != fs->edge_constraint.dst_node_type ||
        node == dst) {
        return SELVA_EINVAL;
    }

    fs_dst = selva_get_fs_by_te_field(te_dst, fs->edge_constraint.inverse_field);
    if (!fs_dst) {
        return SELVA_EINTYPE;
    }

    bool reorder = !!(flags & SELVA_FIELDS_REFERENCES_INSERT_FLAGS_REORDER);
    bool ignore_src_dependent = !!(flags & SELVA_FIELDS_REFERENCES_INSERT_FLAGS_IGNORE_SRC_DEPENDENT);
    if (add_to_refs_index(db, node, dst, fs, fs_dst)) {
        if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE) {
            (void)remove_reference(db, dst, fs_dst, 0, -1, ignore_src_dependent);
        }

        assume(fs->type == SELVA_FIELD_TYPE_REFERENCES);
        write_ref_2way(db, node, fs, index, dst, fs_dst, ref_out);
        if (fs->edge_constraint.limit > 0) {
            (void)remove_references_tail(db, node, fs, fs->edge_constraint.limit);
        }

        return 0;
    } else if (reorder) {
        auto fields = &node->fields;
        assert(fs->field < fields->nr_fields);
        struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];
        struct SelvaNodeReferences *refs = nfo2p(fields, nfo);
        ssize_t index_old;
        int err = 0;

        index_old = refs_find_node_i(refs, dst->node_id);
        if (index_old < 0) {
            return SELVA_ENOENT;
        } else if (index_old == index) {
            goto done;
        }

        err = selva_fields_references_move(node, fs, index_old, index);

done:
        if (ref_out) {
            ref_out->type = refs->size;
            switch (refs->size) {
            case SELVA_NODE_REFERENCE_SMALL:
                ref_out->small = &refs->small[index];
                break;
            case SELVA_NODE_REFERENCE_LARGE:
                ref_out->large = &refs->large[index];
                break;
            default:
                db_panic("Invalid ref type: %d", refs->size);
            }
        }
        return err;
    } else {
        if (ref_out) {
            auto fields = &node->fields;
            assert(fs->field < fields->nr_fields);
            struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];
            struct SelvaNodeReferences *refs = nfo2p(fields, nfo);

            ref_out->type = refs->size;
            switch (refs->size) {
            case SELVA_NODE_REFERENCE_SMALL:
                ref_out->small = &refs->small[fast_linear_search_references_small(refs->small, refs->nr_refs, dst->node_id)];
                break;
            case SELVA_NODE_REFERENCE_LARGE:
                ref_out->large = &refs->large[fast_linear_search_references_large(refs->large, refs->nr_refs, dst->node_id)];
                break;
            default:
                db_panic("Invalid ref type: %d", refs->size);
            }
        }
        return SELVA_EEXIST;
    }
    __builtin_unreachable();
}

int selva_fields_reference_set(
        struct SelvaDb *db,
        struct SelvaNode * restrict src,
        const struct SelvaFieldSchema *fs_src,
        struct SelvaNode * restrict dst,
        struct SelvaNodeReferenceAny *ref_out)
{
    const struct SelvaFieldSchema *fs_dst;

    if (fs_src->type != SELVA_FIELD_TYPE_REFERENCE ||
        fs_src->edge_constraint.dst_node_type != dst->type ||
        !dst || src == dst) {
        return SELVA_EINVAL;
    }

    fs_dst = get_edge_dst_fs(db, fs_src);
    if (!fs_dst) {
        return SELVA_EINTYPE;
    }
#if 0
    assert(fs_dst->edge_constraint.dst_node_type == src->type);
#endif
    assume(fs_dst->edge_constraint.dst_node_type == src->type);

    if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCES && !add_to_refs_index(db, src, dst, fs_src, fs_dst)) {
        return SELVA_EEXIST;
    }

    /*
     * Remove previous refs.
     */
    struct SelvaTypeEntry *te_dst = selva_get_type_by_index(db, fs_src->edge_constraint.dst_node_type);

    (void)remove_reference(db, src, fs_src, 0, -1, true);
    selva_mark_dirty(te_dst, dst->node_id);

    if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE) {
        /* The new destination may have a ref to somewhere. */
        (void)remove_reference(db, dst, fs_dst, 0, -1, false);
    }

    assume(fs_src->type == SELVA_FIELD_TYPE_REFERENCE);
    write_ref_2way(db, src, fs_src, -1, dst, fs_dst, ref_out);
    if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCES && fs_dst->edge_constraint.limit > 0) {
        (void)remove_references_tail(db, dst, fs_dst, fs_dst->edge_constraint.limit);
    }

    return 0;
}

size_t selva_fields_prealloc_refs(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, size_t nr_refs_min)
{
    auto fields = &node->fields;

    if (unlikely(fs->type != SELVA_FIELD_TYPE_REFERENCES)) {
        db_panic("Invalid type: %s", selva_str_field_type(fs->type));
    }

    const enum SelvaNodeReferenceType type = refs_get_type(db, selva_get_edge_field_constraint(fs));
    struct SelvaFieldInfo *nfo = ensure_field_references(fields, fs, type);
    struct SelvaNodeReferences *refs = nfo2p(fields, nfo);

    if (refs->nr_refs >= nr_refs_min) {
        goto out;
    }

    if (refs->any) {
        remove_refs_offset(refs);
    }
    switch (refs->size) {
    case SELVA_NODE_REFERENCE_SMALL:
        refs->small = selva_realloc(refs->small, nr_refs_min * sizeof(refs->small[0]));
        break;
    case SELVA_NODE_REFERENCE_LARGE:
        refs->large = selva_realloc(refs->large, nr_refs_min * sizeof(refs->large[0]));
        break;
    default:
        db_panic("Invalid ref type: %d", refs->size);
    }
    refs->index = selva_realloc(refs->index, nr_refs_min * sizeof(refs->index[0]));

out:
    return refs->nr_refs;
}

typedef void (*selva_fields_references_insert_tail_cb_t)(
        struct SelvaDb *db,
        struct SelvaNode *restrict src,
        struct SelvaNode *restrict dst,
        const struct SelvaFieldSchema *fs_src,
        const struct SelvaFieldSchema *fs_dst);

static void selva_fields_references_insert_tail_empty_src_field(
        struct SelvaDb *db,
        struct SelvaTypeEntry *te_dst,
        struct SelvaNode *restrict src,
        const struct SelvaFieldSchema *fs_src,
        const struct SelvaFieldSchema *fs_dst,
        const node_id_t ids[],
        size_t nr_ids,
        selva_fields_references_insert_tail_cb_t fn)
{
    for (size_t i = 0; i < nr_ids; i++) {
        node_id_t dst_id = ids[i];
        struct SelvaNode *dst;

        /* TODO Partials */
        dst = selva_find_node(te_dst, dst_id).node;
        if (!dst) {
            continue;
        }

        if (!add_to_refs_index(db, src, dst, fs_src, fs_dst)) {
            continue; /* ignore. */
        }

        fn(db, src, dst, fs_src, fs_dst);
    }
}

static void selva_fields_references_insert_tail_nonempty_src_field(
        struct SelvaDb *db,
        struct SelvaTypeEntry *te_dst,
        struct SelvaNode *restrict src,
        const struct SelvaFieldSchema *fs_src,
        const struct SelvaFieldSchema *fs_dst,
        const node_id_t ids[],
        size_t nr_ids,
        selva_fields_references_insert_tail_cb_t fn)
{
    auto fields = &src->fields;
    assert(fs_src->field < fields->nr_fields);
    const struct SelvaFieldInfo *nfo = &fields->fields_map[fs_src->field];
    typeof_field(struct SelvaNodeReferences, nr_refs) *index_len = (typeof(index_len))((char *)nfo2p(fields, nfo) + offsetof(struct SelvaNodeReferences, nr_refs));
    typeof_field(struct SelvaNodeReferences, index) *index = (typeof(index))((char *)nfo2p(fields, nfo) + offsetof(struct SelvaNodeReferences, index));
    ssize_t index_lower_bound = node_id_set_bsearch(*index, *index_len, ids[0]);

    if (index_lower_bound < 0) {
        index_lower_bound = 0;
    }

    for (size_t i = 0; i < nr_ids; i++) {
        node_id_t dst_id = ids[i];
        struct SelvaNode *dst;

        ssize_t k = node_id_set_bsearch(*index + index_lower_bound, *index_len - index_lower_bound, dst_id);
        if (k > 0) {
            index_lower_bound = k;
            continue; /* ignore */
        }

        /* TODO Partials */
        dst = selva_find_node(te_dst, dst_id).node;
        if (!dst) {
            continue;
        }

        if (!add_to_refs_index(db, src, dst, fs_src, fs_dst)) {
            continue; /* already inserted. */
        }

        fn(db, src, dst, fs_src, fs_dst);
    }
}

static void selva_fields_references_insert_tail_insert_refs(
        struct SelvaDb *db,
        struct SelvaNode *restrict src,
        struct SelvaNode *restrict dst,
        const struct SelvaFieldSchema *fs_src,
        const struct SelvaFieldSchema *fs_dst)
{
#if 0
    assert(fs_dst->type == SELVA_FIELD_TYPE_REFERENCES);
#endif
    assume(fs_dst->type == SELVA_FIELD_TYPE_REFERENCES);
    write_ref_2way(db, src, fs_src, -1, dst, fs_dst, nullptr);
    if (fs_dst->edge_constraint.limit > 0) {
        (void)remove_references_tail(db, dst, fs_dst, fs_dst->edge_constraint.limit);
    }
}

static void selva_fields_references_insert_tail_insert_ref(
        struct SelvaDb *db,
        struct SelvaNode *restrict src,
        struct SelvaNode *restrict dst,
        const struct SelvaFieldSchema *fs_src,
        const struct SelvaFieldSchema *fs_dst)
{
    /* fs_dst->type == SELVA_FIELD_TYPE_REFERENCE so needs to be removed. */
#if 0
    assert (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE);
#endif
    assume(fs_dst->type == SELVA_FIELD_TYPE_REFERENCE);
    (void)remove_reference(db, dst, fs_dst, 0, -1, false);
    write_ref_2way(db, src, fs_src, -1, dst, fs_dst, nullptr);
}

int selva_fields_references_insert_tail(
        struct SelvaDb *db,
        struct SelvaNode * restrict node,
        const struct SelvaFieldSchema *fs,
        struct SelvaTypeEntry *te_dst,
        const node_id_t ids[],
        size_t nr_ids)
{
    const struct SelvaFieldSchema *fs_dst;
    node_type_t type_dst = te_dst->type;

    if (fs->type != SELVA_FIELD_TYPE_REFERENCES ||
        type_dst != fs->edge_constraint.dst_node_type) {
        return SELVA_EINVAL;
    }

    if (nr_ids == 0) {
        return 0;
    }

    /* RFE This check could be in an assert if we'd check this before calling this func. */
    if (type_dst == node->type) {
        for (size_t i = 0; i < nr_ids; i++) {
            if (node->node_id == ids[i]) {
                return SELVA_EINVAL;
            }
        }
    }

    fs_dst = selva_get_fs_by_te_field(te_dst, fs->edge_constraint.inverse_field);
    if (!fs_dst) {
        return SELVA_EINTYPE;
    }

    const size_t old_nr_refs = selva_fields_prealloc_refs(db, node, fs, nr_ids);
    if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCES) {
        if (old_nr_refs == 0) { /* field is empty. */
            selva_fields_references_insert_tail_empty_src_field(db, te_dst, node, fs, fs_dst, ids, nr_ids, selva_fields_references_insert_tail_insert_refs);
        } else { /* field is non-empty. */
            selva_fields_references_insert_tail_nonempty_src_field(db, te_dst, node, fs, fs_dst, ids, nr_ids, selva_fields_references_insert_tail_insert_refs);
        }
    } else { /* fs_dst->type == SELVA_FIELD_TYPE_REFERENCE */
        if (old_nr_refs == 0) {
            selva_fields_references_insert_tail_empty_src_field(db, te_dst, node, fs, fs_dst, ids, nr_ids, selva_fields_references_insert_tail_insert_ref);
        } else {
            selva_fields_references_insert_tail_nonempty_src_field(db, te_dst, node, fs, fs_dst, ids, nr_ids, selva_fields_references_insert_tail_insert_ref);
        }
    }

    if (fs->edge_constraint.limit > 0) {
        (void)remove_references_tail(db, node, fs, fs->edge_constraint.limit);
    }

    return 0;
}

static int clone_refs(struct SelvaNodeReferences *refs, struct SelvaFields *fields, const struct SelvaFieldSchema *fs)
{
    struct SelvaFieldInfo *nfo;

    if (fs->type != SELVA_FIELD_TYPE_REFERENCES) {
        return SELVA_EINTYPE;
    }

    assert(fs->field < fields->nr_fields);
    nfo = &fields->fields_map[fs->field];
    memcpy(refs, nfo2p(fields, nfo), sizeof(*refs));

    return 0;
}

static size_t ary_idx_to_abs(ssize_t len, ssize_t ary_idx)
{
    if (ary_idx >= 0) {
        return ary_idx;
    } else if (len == 0) {
        return 0;
    } else {
        return imaxabs((len + ary_idx) % len);
    }
}

int selva_fields_references_move(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        ssize_t index_old,
        ssize_t index_new)
{
    struct SelvaNodeReferences refs;
    int err;

    err = clone_refs(&refs, &node->fields, fs);
    if (err) {
        return err;
    }
    if (refs.size == SELVA_NODE_REFERENCE_NULL) {
        return SELVA_ENOENT;
    }

    index_old = ary_idx_to_abs(refs.nr_refs, index_old);
    index_new = min(ary_idx_to_abs(refs.nr_refs, index_new), refs.nr_refs - 1);

    if (index_old < 0 || index_old >= refs.nr_refs ||
        index_new < 0 || index_new >= refs.nr_refs) {
        return SELVA_EINVAL;
    }

    if (index_old < index_new) {
        /*
         * 1.
         *   0   1   2   3   4   5   6
         * | a | b |   | d | e | f | g |
         *           |           ^
         *           +-----c-----+
         *
         * First fill the hole.
         *
         * 2.
         *   0   1   2   3   4   5   6
         * | a | b | d | e | f |   | g |
         *           |           ^
         *           +-----c-----+
         *
         * Assign tmp to the new index.
         *
         * 3.
         *   0   1   2   3   4   5   6
         * | a | b | d | e | f | c | g |
         */
        switch (refs.size) {
        case SELVA_NODE_REFERENCE_SMALL: {
            struct SelvaNodeSmallReference tmp = refs.small[index_old];
            memmove(refs.small + index_old, refs.small + index_old + 1, (index_new - index_old) * sizeof(*refs.small));
            refs.small[index_new] = tmp;
            }
            break;
        case SELVA_NODE_REFERENCE_LARGE: {
            struct SelvaNodeLargeReference tmp = refs.large[index_old];
            memmove(refs.large + index_old, refs.large + index_old + 1, (index_new - index_old) * sizeof(*refs.large));
            refs.large[index_new] = tmp;
            }
            break;
        default:
            db_panic("Invalid ref type: %d", refs.size);
        }
    } else if (index_old > index_new) {
        /*
         * 1.
         *   0   1   2   3   4   5   6
         * | a | b | c | d | e |   | g |
         *           ^           |
         *           +-----f-----+
         *
         * First fill the hole.
         *
         * 2.
         *   0   1   2   3   4   5   6
         * | a | b |   | c | d | e | g |
         *           ^           |
         *           +-----f-----+
         *
         * Assign tmp to the new index.
         *
         * 3.
         *   0   1   2   3   4   5   6
         * | a | b | f | c | d | e | g |
         */
        switch (refs.size) {
        case SELVA_NODE_REFERENCE_SMALL: {
                struct SelvaNodeSmallReference tmp = refs.small[index_old];
                memmove(refs.small + index_new + 1, refs.small + index_new, (index_old - index_new) * sizeof(*refs.small));
                refs.small[index_new] = tmp;
            }
            break;
        case SELVA_NODE_REFERENCE_LARGE: {
                struct SelvaNodeLargeReference tmp = refs.large[index_old];
                memmove(refs.large + index_new + 1, refs.large + index_new, (index_old - index_new) * sizeof(*refs.large));
                refs.large[index_new] = tmp;
            }
            break;
        default:
            db_panic("Invalid ref type: %d", refs.size);
        }
    } /* else NOP */

    return 0;
}

#define SWAP_REFS(type, a, i1, i2) do { \
    type *ap = &refs.a[i1]; \
    type *bp = &refs.a[i2]; \
    type a = *ap; \
    type b = *bp; \
    *ap = b; \
    *bp = a; \
} while (0)


int selva_fields_references_swap(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        size_t index1,
        size_t index2)
{
    struct SelvaNodeReferences refs;
    int err;

    err = clone_refs(&refs, &node->fields, fs);
    if (err) {
        return err;
    }
    if (refs.size == SELVA_NODE_REFERENCE_NULL) {
        return SELVA_ENOENT;
    }

    if (index1 >= refs.nr_refs ||
        index2 >= refs.nr_refs) {
        return SELVA_EINVAL;
    }

    /*
     * No matter how clever you try to be here with temp variables or whatever,
     * clang and gcc will figure out that you are doing a swap and will optimize
     * your code the best possible (same) way for the arch.
     * That's probably 4 instructions on x86-64 and 6 on ARM64.
     */
    switch (refs.size) {
    case SELVA_NODE_REFERENCE_SMALL:
        SWAP_REFS(struct SelvaNodeSmallReference, small, index1, index2);
        break;
    case SELVA_NODE_REFERENCE_LARGE:
        SWAP_REFS(struct SelvaNodeLargeReference, large, index1, index2);
        break;
    default:
        db_panic("Invalid ref type: %d", refs.size);
    }

    return 0;
}

static struct SelvaNode *next_ref_edge_node(struct SelvaTypeEntry *edge_type)
{
    node_id_t next_id = (edge_type->max_node) ? edge_type->max_node->node_id + 1 : 1;
    struct SelvaNodeRes edge;

    /* TODO Partials */
    while (selva_find_node(edge_type, next_id).node) {
        /* FIXME This will loop infinitely if all ids are used. */
        /* FIXME Should we use some sort of free list as a bitmap or something to speed up reuse. */
        next_id++;
    }

    edge = selva_upsert_node(edge_type, next_id);
    /* TODO Support partial edges */

    constexpr enum SelvaTypeBlockStatus mask = SELVA_TYPE_BLOCK_STATUS_INMEM | SELVA_TYPE_BLOCK_STATUS_DIRTY;
    assert(edge.node && (edge.block_status & mask) == mask);
#if 0
    selva_mark_dirty(edge_type, next_id);
#endif

    return edge.node;
}

struct SelvaNodeLargeReference *selva_fields_get_reference(struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    auto fields = &node->fields;
    assert(fs->field < fields->nr_fields);
    const struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];

    return (fs->type != SELVA_FIELD_TYPE_REFERENCE || !nfo->in_use)
        ? nullptr
        : (struct SelvaNodeLargeReference *)nfo2p(fields, nfo);
}

struct SelvaNodeReferences *selva_fields_get_references(struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    auto fields = &node->fields;
    assert(fs->field < fields->nr_fields);
    const struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];

    return (fs->type != SELVA_FIELD_TYPE_REFERENCES || !nfo->in_use)
        ? nullptr
        : (struct SelvaNodeReferences *)nfo2p(fields, nfo);
}

struct selva_string *selva_fields_get_selva_string(struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    auto fields = &node->fields;
    const struct SelvaFieldInfo *nfo;

    assert(fs->type == SELVA_FIELD_TYPE_STRING);

    assert(fs->field < fields->nr_fields);
    nfo = &fields->fields_map[fs->field];

    if (!nfo->in_use) {
        return nullptr;
    }

    struct selva_string *s = nfo2p(fields, nfo);

    return (s->flags & SELVA_STRING_STATIC) ? s : nullptr;
}

struct SelvaFieldsPointer selva_fields_get_raw(struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    auto fields = &node->fields;
    const struct SelvaFieldInfo *nfo;
    enum SelvaFieldType type;

    assert(fs->field < fields->nr_fields);
    nfo = &fields->fields_map[fs->field];
    type = nfo->in_use ? fs->type : SELVA_FIELD_TYPE_NULL;

    switch (type) {
    case SELVA_FIELD_TYPE_NULL:
        return (struct SelvaFieldsPointer){
            .ptr = (uint8_t *)fields->data,
            .off = (nfo->off << SELVA_FIELDS_OFF),
            .len = 0,
        };
    case SELVA_FIELD_TYPE_TEXT:
    case SELVA_FIELD_TYPE_REFERENCE:
    case SELVA_FIELD_TYPE_REFERENCES:
        return (struct SelvaFieldsPointer){
            .ptr = (uint8_t *)fields->data,
            .off = (nfo->off << 3),
            .len = selva_fields_get_data_size(fs),
        };
    case SELVA_FIELD_TYPE_STRING:
        do {
            const struct selva_string *s = (const struct selva_string *)((uint8_t *)fields->data + (nfo->off << 3));
            size_t len;
            const uint8_t *str = selva_string_to_buf(s, &len);
            return (struct SelvaFieldsPointer){
                .ptr = (uint8_t *)str,
                .off = 0,
                .len = len,
            };
        } while (0);
    case SELVA_FIELD_TYPE_MICRO_BUFFER:
        return (struct SelvaFieldsPointer){
            .ptr = (uint8_t *)fields->data,
            .off = (nfo->off << SELVA_FIELDS_OFF),
            .len = selva_fields_get_data_size(fs),
        };
    case SELVA_FIELD_TYPE_ALIAS:
    case SELVA_FIELD_TYPE_COLVEC:
        return (struct SelvaFieldsPointer){
            .ptr = nullptr,
            .off = 0,
            .len = 0,
        };
    }
    db_panic("Invalid type");
}

static void del_field_string(struct SelvaFields *fields, struct SelvaFieldInfo *nfo)
{
    struct selva_string *s = nfo2p(fields, nfo);

    if (s->flags & SELVA_STRING_STATIC) {
        if (s->flags & SELVA_STRING_MUTABLE_FIXED) {
            selva_string_replace(s, nullptr, 0);
        } else {
            selva_string_free(s);
            memset(s, 0, sizeof(*s));
        }
    }
}

static int fields_del(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, bool unload)
{
    auto fields = &node->fields;
    struct SelvaFieldInfo *nfo;
    enum SelvaFieldType type;

    assert(fs->field < fields->nr_fields);
    nfo = &fields->fields_map[fs->field];
    type = nfo->in_use ? fs->type : SELVA_FIELD_TYPE_NULL;

    switch (type) {
    case SELVA_FIELD_TYPE_NULL:
        /* NOP */
        return 0;
    case SELVA_FIELD_TYPE_MICRO_BUFFER:
        break;
    case SELVA_FIELD_TYPE_STRING:
        del_field_string(fields, nfo);
        selva_mark_dirty(selva_get_type_by_index(db, node->type), node->node_id);
        return 0; /* Don't clear it. */
    case SELVA_FIELD_TYPE_TEXT:
        del_field_text(fields, nfo);
        break;
    case SELVA_FIELD_TYPE_REFERENCE:
        if (!unload) {
            (void)remove_reference(db, node, fs, 0, -1, false);
        }
        break;
    case SELVA_FIELD_TYPE_REFERENCES:
        if (unload) {
            unload_references(node, fs);
        } else {
            remove_references(db, node, fs);
        }
        break;
    case SELVA_FIELD_TYPE_ALIAS:
    case SELVA_FIELD_TYPE_COLVEC:
        return SELVA_ENOTSUP;
    }

    memset(nfo2p(fields, nfo), 0, selva_fields_get_data_size(fs));
    selva_mark_dirty(selva_get_type_by_index(db, node->type), node->node_id);

    return 0;
}

int selva_fields_del(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    return fields_del(db, node, fs, false);
}

int selva_fields_del_ref(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, node_id_t dst_node_id)
{
    if (fs->type != SELVA_FIELD_TYPE_REFERENCES) {
        return SELVA_EINTYPE;
    }

    struct SelvaNodeReferences *refs = selva_fields_get_references(node, fs);
    if (!refs) {
        return SELVA_ENOENT;
    }

    (void)remove_reference(db, node, fs, dst_node_id, -1, false);
    return 0;
}

void selva_fields_clear_references(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    assert(fs->type == SELVA_FIELD_TYPE_REFERENCES);
    (void)clear_references(db, node, fs, true);
}

static void selva_fields_init_defaults(struct SelvaTypeEntry *te, struct SelvaFields *fields, const struct SelvaFieldsSchema *schema)
{
    const uint8_t *schema_buf = te->schema_buf;
    size_t data_len = schema->template.fixed_data_len;

    memcpy(fields->data, schema->template.fixed_data_buf, data_len);

    /*
     * Handle defaults that needs to allocate memory per each node.
     */
    for (size_t i = 0; i < schema->nr_fixed_fields; i++) {
        const struct SelvaFieldSchema *fs = get_fs_by_fields_schema_field(schema, i);

        if (fs->type == SELVA_FIELD_TYPE_STRING) {
            if (fs->string.default_off > 0) {
                const void *default_str = schema_buf + fs->string.default_off;
                size_t default_len = fs->string.default_len;
                struct SelvaFieldInfo *nfo;
                int err;

                nfo = ensure_field(fields, fs);
                err = set_field_string(fields, fs, nfo, default_str, default_len);
                if (unlikely(err)) {
                    /* TODO panic is not nice here. */
                    db_panic("Failed to set string default");
                }
            }
        } else if (fs->type == SELVA_FIELD_TYPE_TEXT) {
            const size_t nr_defaults = fs->text.nr_defaults;
            size_t off = fs->text.defaults_off;
            if (nr_defaults > 0 && off > 0) {
                struct ensure_text_field tf;

                tf = ensure_text_field(fields, fs, selva_lang_none);
                tf.text->tl = selva_malloc(nr_defaults * sizeof(*tf.text->tl));
                tf.text->len = nr_defaults;

                for (size_t i = 0; i < nr_defaults; i++) {
                    uint32_t len;
                    uint32_t crc;

                    memcpy(&len, te->schema_buf + off, sizeof(len));
                    off += sizeof(len);
                    memcpy(&crc, schema_buf + off + len - sizeof(crc), sizeof(crc));
                    init_tl(&tf.text->tl[i], (const char *)(schema_buf + off), len - sizeof(crc), crc);
                    off += len;
                }
            }
        }
        /* SELVA_FIELD_TYPE_COLVEC handled in colvec_init_node() */
    }
}

static void selva_fields_init(struct SelvaTypeEntry *te, struct SelvaFields *fields, bool set_defaults)
{
    const struct SelvaFieldsSchema *schema = &te->ns.fields_schema;

    fields->nr_fields = schema->nr_fields - schema->nr_virtual_fields;
    memcpy(fields->fields_map, schema->template.field_map_buf, schema->template.field_map_len);

    size_t data_len = schema->template.fixed_data_len;
    if (data_len > 0) {
        fields->data_len = data_len;
        fields->data = selva_malloc(data_len);

        if (schema->template.fixed_data_buf && set_defaults) {
            selva_fields_init_defaults(te, fields, schema);
        } else {
            memset(fields->data, 0, data_len);
        }
    } else {
        fields->data_len = 0;
        fields->data = nullptr;
    }
}

void selva_fields_init_node(struct SelvaTypeEntry *te, struct SelvaNode *node, bool set_defaults)
{
    selva_fields_init(te, &node->fields, set_defaults);
    if (te->ns.nr_colvec_fields > 0) {
        colvec_init_node(te, node);
    }
}

void selva_fields_flush(struct SelvaDb *db, struct SelvaNode *node)
{
    const struct SelvaNodeSchema *ns = selva_get_ns_by_te(selva_get_type_by_node(db, node));
    auto fields = &node->fields;
    const field_t nr_fields = fields->nr_fields;

    for (field_t field = 0; field < nr_fields; field++) {
        if (fields->fields_map[field].in_use) {
            const struct SelvaFieldSchema *fs;
            int err;

            fs = selva_get_fs_by_ns_field(ns, field);
            if (unlikely(!fs)) {
                db_panic("No field schema found");
            }

            err = fields_del(db, node, fs, false);
            if (unlikely(err)) {
                db_panic("Failed to remove a field: %s", selva_strerror(err));
            }
        }
    }

    /*
     * Reset the defaults for fixed fields.
     */
    const struct SelvaFieldsSchema *schema = &ns->fields_schema;
    size_t data_len = schema->template.fixed_data_len;
    assert(fields->data);
    if (data_len > 0 && schema->template.fixed_data_buf) {
        memcpy(fields->data, schema->template.fixed_data_buf, data_len);
    }
}

static inline void fields_destroy(struct SelvaDb *db, struct SelvaNode *node, bool unload)
{
    const struct SelvaNodeSchema *ns = selva_get_ns_by_te(selva_get_type_by_node(db, node));
    auto fields = &node->fields;
    const field_t nr_fields = fields->nr_fields;

    for (field_t field = 0; field < nr_fields; field++) {
        if (fields->fields_map[field].in_use) {
            const struct SelvaFieldSchema *fs;
            int err;

            fs = selva_get_fs_by_ns_field(ns, field);
            if (unlikely(!fs)) {
                db_panic("No field schema found");
            }

            err = fields_del(db, node, fs, unload);
            if (unlikely(err)) {
                db_panic("Failed to remove a field: %s", selva_strerror(err));
            }
        }
    }

#if 0
    /*
     * Clear fields map.
     */
    memset(fields->fields_map, 0, fields->nr_fields * sizeof(fields->fields_map[0]));
#endif

    fields->nr_fields = 0;
    fields->data_len = 0;
    selva_free(fields->data);
    fields->data = nullptr;
}

void selva_fields_destroy(struct SelvaDb *db, struct SelvaNode *node)
{
    fields_destroy(db, node, false);
}

void selva_fields_unload(struct SelvaDb *db, struct SelvaNode *node)
{
    fields_destroy(db, node, true);
}

/* FIXME Check when we want to set keep_edge_node */
static void reference_edge_destroy(
        struct SelvaDb *db,
        const struct EdgeFieldConstraint *efc,
        struct SelvaNodeLargeReference *ref,
        bool keep_edge_node)
{
    if (ref->edge != 0) {
        struct SelvaTypeEntry *edge_type;
        struct SelvaNode *edge_node;

        edge_type = selva_get_type_by_index(db, efc->edge_node_type);
        assert(edge_type);
        edge_node = selva_find_node(edge_type, ref->edge).node; /* TODO Partials */
        ref->edge = 0;

        if (edge_node && !keep_edge_node) {
            selva_del_node(db, edge_type, edge_node);
        }
    }
}

static inline void hash_ref(selva_hash_state_t *hash_state, const struct SelvaNodeLargeReference *ref)
{
    node_id_t dst_id = ref->dst;
    node_id_t edge_id = ref->edge;

    selva_hash_update(hash_state, &dst_id, sizeof(dst_id));
    selva_hash_update(hash_state, &edge_id, sizeof(edge_id));
}

void selva_fields_hash_update(selva_hash_state_t *hash_state, struct SelvaDb *, const struct SelvaFieldsSchema *schema, const struct SelvaNode *node)
{
    auto fields = &node->fields;
    const field_t nr_fields = fields->nr_fields;

    for (field_t field = 0; field < nr_fields; field++) {
        const struct SelvaFieldInfo *nfo = &fields->fields_map[field];
        const struct SelvaFieldSchema *fs = &schema->field_schemas[field];
        const void *p = nfo2p(fields, nfo);

        switch (fs->type) {
        case SELVA_FIELD_TYPE_NULL:
            /* Also NULL must cause a change in the hash. */
nil:
            selva_hash_update(hash_state, &(char){ '\0' }, sizeof(char));
            break;
        case SELVA_FIELD_TYPE_MICRO_BUFFER:
            if (nfo->in_use) {
                selva_hash_update(hash_state, p, selva_fields_get_data_size(fs));
            } else {
                goto nil;
            }
            break;
        case SELVA_FIELD_TYPE_TEXT:
            do {
                const struct SelvaTextField *text = p;
                const size_t len = nfo->in_use ? text->len : 0;

                selva_hash_update(hash_state, &len, sizeof(len));
                for (size_t i = 0; i < len; i++) {
                    uint32_t crc = selva_string_get_crc(&text->tl[i]);
                    selva_hash_update(hash_state, &crc, sizeof(crc));
                }
            } while (0);
            break;
        case SELVA_FIELD_TYPE_REFERENCE:
            if (nfo->in_use) {
                hash_ref(hash_state, p);
            } else {
                goto nil;
            }
            break;
        case SELVA_FIELD_TYPE_REFERENCES:
            do {
                const struct SelvaNodeReferences *refs = p;
                const size_t len = nfo->in_use ? refs->nr_refs : 0;

                selva_hash_update(hash_state, &len, sizeof(len));
                switch (refs->size) {
                case SELVA_NODE_REFERENCE_SMALL:
                    for (size_t i = 0; i < len; i++) {
                        struct SelvaNodeLargeReference ref = { .dst = refs->small->dst };
                        hash_ref(hash_state, &ref);
                    }
                    break;
                case SELVA_NODE_REFERENCE_LARGE:
                    for (size_t i = 0; i < len; i++) {
                        hash_ref(hash_state, &refs->large[i]);
                    }
                    break;
                default:
                    /* Empty. */
                }
            } while (0);
            break;
        case SELVA_FIELD_TYPE_STRING:
            do {
                const struct selva_string *s = p;
                uint32_t crc = nfo->in_use ? selva_string_get_crc(s) : 0;

                selva_hash_update(hash_state, &crc, sizeof(crc));
            } while (0);
            break;
        case SELVA_FIELD_TYPE_ALIAS:
        case SELVA_FIELD_TYPE_COLVEC:
            /*
             * NOP These are hashed in the node hash in db.c.
             */
            break;
        }
    }
}

selva_hash128_t selva_fields_hash(struct SelvaDb *db, const struct SelvaFieldsSchema *schema, const struct SelvaNode *node)
{
    selva_hash_state_t *hash_state = selva_hash_create_state();
    selva_hash128_t res;

    selva_hash_reset(hash_state);
    selva_fields_hash_update(hash_state, db, schema, node);
    res = selva_hash_digest(hash_state);
    selva_hash_free_state(hash_state);

    return res;
}
