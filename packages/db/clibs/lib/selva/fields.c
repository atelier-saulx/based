/*
 * Copyright (c) 2024-2025 SAULX
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
#include "selva_error.h"
#include "bits.h"
#include "db.h"
#include "db_panic.h"
#include "idz.h"
#include "ptag.h"
#include "selva/fast_linear_search.h"
#include "selva/node_id_set.h"
#include "selva/fields.h"

#if defined(EN_VALGRIND)
#define selva_sallocx(p, v)     0
#endif

static void destroy_fields(struct SelvaFields *fields);
static void reference_meta_create(struct SelvaNodeReference *ref, size_t nr_fields);
static void reference_meta_destroy(struct SelvaDb *db, const struct EdgeFieldConstraint *efc, struct SelvaNodeReference *ref);

/**
 * Size of each type in fields.data.
 */
static const size_t selva_field_data_size[] = {
    [SELVA_FIELD_TYPE_NULL] = 0,
    [SELVA_FIELD_TYPE_STRING] = sizeof(struct selva_string),
    [SELVA_FIELD_TYPE_TEXT] = sizeof(struct SelvaTextField),
    [SELVA_FIELD_TYPE_REFERENCE] = sizeof(struct SelvaNodeReference),
    [SELVA_FIELD_TYPE_REFERENCES] = sizeof(struct SelvaNodeReferences),
    [SELVA_FIELD_TYPE_WEAK_REFERENCE] = sizeof(struct SelvaNodeWeakReference),
    [SELVA_FIELD_TYPE_WEAK_REFERENCES] = sizeof(struct SelvaNodeWeakReferences),
    [SELVA_FIELD_TYPE_MICRO_BUFFER] = 0, /* check fs. */
    [SELVA_FIELD_TYPE_ALIAS] = 0, /* Aliases are stored separately under the type struct. */
    [SELVA_FIELD_TYPE_ALIASES] = 0,
};
static_assert(sizeof(bool) == sizeof(int8_t));

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
    char *data = (char *)PTAG_GETP(fields->data);
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
        data = selva_realloc(data, new_size);
        fields->data = PTAG(data, PTAG_GETTAG(fields->data));
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
    char *data = (char *)PTAG_GETP(fields->data);

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

    nfo = &fields->fields_map[fs->field];
    if (!nfo->in_use) {
        *nfo = alloc_block(fields, fs);
        memset(nfo2p(fields, nfo), 0, selva_fields_get_data_size(fs));
    }

    return nfo;
}

struct SelvaFieldInfo *selva_fields_ensure(struct SelvaFields *fields, const struct SelvaFieldSchema *fs)
{
    return ensure_field(fields, fs);
}

/**
 * Get a mutable string in fields at fs/nfo.
 */
static struct selva_string *get_mutable_string(struct SelvaFields *fields, const struct SelvaFieldSchema *fs, struct SelvaFieldInfo *nfo, size_t len)
{
    struct selva_string *s = nfo2p(fields, nfo);

    assert(nfo->in_use);
    assert(s && ((uintptr_t)s & 7) == 0);

    if (!(s->flags & SELVA_STRING_STATIC)) { /* Previously initialized. */
        int err;

        if (fs->string.fixed_len == 0) {
            err = selva_string_init(s, nullptr, len, SELVA_STRING_MUTABLE | SELVA_STRING_CRC);
        } else {
            assert(len <= fs->string.fixed_len);
            err = selva_string_init(s, nullptr, fs->string.fixed_len, SELVA_STRING_MUTABLE_FIXED | SELVA_STRING_CRC);
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

    if (fs->string.fixed_len && len > fs->string.fixed_len) {
        return SELVA_ENOBUFS;
    }

    uint32_t crc;
    memcpy(&crc, str + len - sizeof(crc), sizeof(crc));
    s = get_mutable_string(fields, fs, nfo, len - sizeof(crc));
    (void)selva_string_replace_crc(s, str, len - sizeof(crc), crc);
    if (str[1] == 1) selva_string_set_compress(s);

    return 0;
}

int selva_fields_set_string(struct SelvaNode *node, const struct SelvaFieldSchema *fs, struct SelvaFieldInfo *nfo, const char *str, size_t len)
{
    struct SelvaFields *fields = &node->fields;

    return set_field_string(fields, fs, nfo, str, len);
}

#if 0
static void print_refs(struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    struct SelvaFields *fields = &node->fields;
    struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];

    assert(fs->type == SELVA_FIELD_TYPE_REFERENCES);
    if (nfo->in_use) {
        struct SelvaNodeReferences *refs = nfo2p(fields, nfo);

        fprintf(stderr, "node: %u: [", node->node_id);
        for (size_t i = 0; i < refs->nr_refs; i++) {
            fprintf(stderr, "%u%s", refs->refs[i].dst->node_id, (i < refs->nr_refs - 1) ? ", " : "");
        }
        fprintf(stderr, "] %p\n", refs);
    }
}
#endif

static void remove_refs_offset(struct SelvaNodeReferences *refs)
{
    if (refs->offset > 0) {
        memmove(refs->refs - refs->offset, refs->refs, refs->nr_refs * sizeof(*refs->refs));
        refs->refs -= refs->offset;
        refs->offset = 0;
    }
}

static void remove_weak_refs_offset(struct SelvaNodeWeakReferences *refs)
{
    /* If offset > 0 then refs is also allocated. */
    if (refs->offset > 0) {
        memmove(refs->refs - refs->offset, refs->refs, refs->nr_refs * sizeof(*refs->refs));
        refs->refs -= refs->offset;
        refs->offset = 0;
    }
}

/**
 * Write a ref to the fields data.
 * Note that this function doesn't touch the destination node.
 */
static int write_ref(struct SelvaNode * restrict node, const struct SelvaFieldSchema *fs, struct SelvaNode * restrict dst, struct SelvaNodeReference **ref_out)
{
    struct SelvaFields *fields = &node->fields;
    struct SelvaFieldInfo *nfo;
    struct SelvaNodeReference ref = {
        .dst = dst,
    };

    nfo = ensure_field(fields, fs);
    void *vp = nfo2p(fields, nfo);

    assert(!memcmp(vp, &(struct SelvaNodeReference){}, sizeof(struct SelvaNodeReference)));
    memcpy(vp, &ref, sizeof(ref));

    if (ref_out) {
        assert(((uintptr_t)vp & 7) == 0);
        *ref_out = (struct SelvaNodeReference *)vp;
    }

    return 0;
}

/**
 * Write a ref to the fields data.
 * Note that this function doesn't touch the destination node.
 */
static int write_refs(struct SelvaNode * restrict node, const struct SelvaFieldSchema *fs, ssize_t index, struct SelvaNode * restrict dst, struct SelvaNodeReference **ref_out)
{
    struct SelvaFields *fields = &node->fields;
    struct SelvaFieldInfo *nfo;

    if (index < -1) {
        return SELVA_EINVAL;
    }

    nfo = ensure_field(fields, fs);

    struct SelvaNodeReferences refs;
    void *vp = nfo2p(fields, nfo);

    memcpy(&refs, vp, sizeof(refs));

    if (refs.offset > 0) {
        if (index == 0) {
            /*
             * Lucky case:
             * 1. refs is already allocated,
             * 2. we have empty/unused space in front,
             * 3. new insertions falls within the empty space.
             */
            refs.refs--;
            refs.offset--;
            refs.nr_refs++;
            refs.refs[0] = (struct SelvaNodeReference){
                .dst = dst,
            };

#if 0
            assert(node_id_set_has(refs.index, refs.nr_refs, dst->node_id));
#endif

            goto out;
        }
    }

    if (refs.refs) {
        remove_refs_offset(&refs);
    }

    index = (index == -1) ? refs.nr_refs : (index > refs.nr_refs) ? refs.nr_refs : index;
    const size_t new_len = refs.nr_refs + 1;
    const size_t new_size = new_len * sizeof(*refs.refs);

    if (!refs.refs || selva_sallocx(refs.refs, 0) < new_size) {
        refs.refs = selva_realloc(refs.refs, new_size);
    }
    if ((size_t)index + 1 < new_len) {
        /* Move old refs to the right to make space. */
        assert(index + 1 + (new_len - 1 - index) <= new_len);
        memmove(refs.refs + index + 1, refs.refs + index, (new_len - 1 - index) * sizeof(*refs.refs));
    } else if (new_len - refs.nr_refs > 1) {
        /* Clear the gap created. */
        assert(refs.nr_refs + (new_len - refs.nr_refs) <= new_len);
        memset(refs.refs + refs.nr_refs, 0, (new_len - refs.nr_refs) * sizeof(*refs.refs));
    }
    refs.nr_refs = new_len;

    /*
     * Finally set the new ref in its correct location.
     */
    refs.refs[index] = (struct SelvaNodeReference){
        .dst = dst,
    };

#if 0
    assert(node_id_set_has(refs.index, refs.nr_refs, dst->node_id));
#endif

out:
    if (ref_out) {
        *ref_out = &refs.refs[index];
    }

    memcpy(vp, &refs, sizeof(refs));
    return 0;
}

/*
 * add_to_refs_index() must be called before this function.
 */
static void write_ref_2way(
        struct SelvaNode * restrict src, const struct SelvaFieldSchema *fs_src, ssize_t index,
        struct SelvaNode * restrict dst, const struct SelvaFieldSchema *fs_dst)
{
    int err;

    assert(fs_src->type == SELVA_FIELD_TYPE_REFERENCE || fs_src->type == SELVA_FIELD_TYPE_REFERENCES);
    assert(fs_dst->type == SELVA_FIELD_TYPE_REFERENCE || fs_dst->type == SELVA_FIELD_TYPE_REFERENCES);
#if 0
    assert(fs_src->edge_constraint.dst_node_type == dst->type);
    assert(fs_dst->edge_constraint.dst_node_type == src->type);
#endif

    err = (fs_src->type == SELVA_FIELD_TYPE_REFERENCE)
        ? write_ref(src, fs_src, dst, nullptr)
        : write_refs(src, fs_src, index, dst, nullptr);
    if (err) {
        db_panic("Failed to write ref: %s", selva_strerror(err));
    }

    err = (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE)
        ? write_ref(dst, fs_dst, src, nullptr)
        : write_refs(dst, fs_dst, -1, src, nullptr);
    if (err) {
        db_panic("Failed to write the inverse reference field: %s", selva_strerror(err));
    }
}

/**
 * Clear single ref value.
 * @returns the original value.
 */
static struct SelvaNode *del_single_ref(struct SelvaDb *db, struct SelvaNode *src_node, const struct EdgeFieldConstraint *efc, struct SelvaFields *fields, struct SelvaFieldInfo *nfo, bool ignore_dependent)
{
    void *vp = nfo2p(fields, nfo);
    struct SelvaNodeReference ref;

    memcpy(&ref, vp, sizeof(ref));
    memset(vp, 0, sizeof(ref)); /* This is fine here because we have a copy of the original struct. */
    reference_meta_destroy(db, efc, &ref);

#if 0
    assert(!ref.dst || ref.dst->type == efc->dst_node_type);
#endif

    if (!ignore_dependent && (efc->flags & EDGE_FIELD_CONSTRAINT_FLAG_DEPENDENT)) {
        selva_expire_node(db, src_node->type, src_node->node_id, 0);
    }

    return ref.dst;
}

/**
 * This is only a helper for remove_reference().
 */
static void del_multi_ref(struct SelvaDb *db, struct SelvaNode *src_node, const struct EdgeFieldConstraint *efc, struct SelvaNodeReferences *refs, size_t i)
{
    struct SelvaNodeReference *ref;
    size_t id_set_len = refs->nr_refs;

    if (!refs->refs || id_set_len == 0) {
        return;
    }

    assert(i < id_set_len);

    ref = &refs->refs[i];
    reference_meta_destroy(db, efc, ref);

    assert(refs->index);
    if (!node_id_set_remove(&refs->index, &id_set_len, ref->dst->node_id)) {
        db_panic("node_id not found in refs: %u:%u\n", ref->dst->type, ref->dst->node_id);
    }
    memset(ref, 0, sizeof(*ref));
    ref = nullptr;

    if (i < refs->nr_refs - 1) {
        if (i == 0) {
            /*
             * Head removal can be done by offsetting the pointer.
             */
            refs->offset++;
            refs->refs++;

            static_assert(sizeof(refs->offset) == sizeof(uint16_t));
            if (refs->offset == 0xffff) {
                remove_refs_offset(refs);
            }
        } else if (i + 1 < refs->nr_refs) {
            /*
             * Otherwise we must do a slightly expensive memmove().
             */
            memmove(&refs->refs[i],
                    &refs->refs[i + 1],
                    (refs->nr_refs - i - 1) * sizeof(struct SelvaNodeReference));
        }

        /*
         * Realloc if we have a lot of extra space.
         */
        if (selva_sallocx(refs->refs - refs->offset, 0) / sizeof(refs->refs[0]) >= refs->nr_refs + 131072) {
            remove_refs_offset(refs);
            refs->refs = selva_realloc(refs->refs, refs->nr_refs);
        }
    }
    refs->nr_refs--;

    assert(id_set_len == refs->nr_refs);

    if  ((efc->flags & EDGE_FIELD_CONSTRAINT_FLAG_DEPENDENT) && refs->nr_refs == 0) {
        selva_expire_node(db, src_node->type, src_node->node_id, 0);
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

    type_dst = selva_get_type_by_index(db, efc->dst_node_type);
    assert(type_dst->type == efc->dst_node_type);

    return selva_get_fs_by_te_field(type_dst, efc->inverse_field);
}

/**
 * Delete a reference field edge.
 * Clears both ways.
 * @param orig_dst should be given if fs_src is of type SELVA_FIELD_TYPE_REFERENCES.
 * @returns the removed dst_node_id.
 */
static node_id_t remove_reference(struct SelvaDb *db, struct SelvaNode *src, const struct SelvaFieldSchema *fs_src, node_id_t orig_dst, ssize_t idx, bool ignore_src_dependent)
{
    struct SelvaFields *fields_src = &src->fields;
    struct SelvaFieldInfo *nfo_src = &fields_src->fields_map[fs_src->field];
    struct SelvaNode *dst = nullptr;
    node_id_t dst_node_id = 0;

#if 0
    assert(selva_get_fs_by_node(db, src, fs_src->field) == fs_src);
#endif

    if (nfo_src->in_use) {
        if (fs_src->type == SELVA_FIELD_TYPE_REFERENCE) {
            dst = del_single_ref(db, src, &fs_src->edge_constraint, fields_src, nfo_src, ignore_src_dependent);
        } else if (fs_src->type == SELVA_FIELD_TYPE_REFERENCES) {
            struct SelvaNodeReferences *refs = nfo2p(fields_src, nfo_src);

            if (idx >= 0) {
                assert(idx < refs->nr_refs);
                dst = refs->refs[idx].dst;
                del_multi_ref(db, src, &fs_src->edge_constraint, refs, idx);
            } else {
                struct SelvaTypeEntry *dst_type = selva_get_type_by_index(db, fs_src->edge_constraint.dst_node_type);
                assert(dst_type);
                struct SelvaNode *orig_dst_node = selva_find_node(dst_type, orig_dst);
                assert(orig_dst_node);

                ssize_t i = fast_linear_search_references(refs->refs, refs->nr_refs, orig_dst_node);
                if (i >= 0) {
                    dst = refs->refs[i].dst;
                    del_multi_ref(db, src, &fs_src->edge_constraint, refs, i);
                }
            }
        }
    }

    /*
     * Clear from the other end.
     */
    if (dst) {
        const struct SelvaFieldSchema *fs_dst;
        struct SelvaFields *fields_dst = &dst->fields;
        struct SelvaFieldInfo *nfo_dst;

        dst_node_id = dst->node_id;

        fs_dst = get_edge_dst_fs(db, fs_src);
        if (!fs_dst) {
            db_panic("field schema not found");
        }

#if 0
        assert(fs_src->type == SELVA_FIELD_TYPE_REFERENCE || fs_src->type == SELVA_FIELD_TYPE_REFERENCES);
        assert(fs_dst->type == SELVA_FIELD_TYPE_REFERENCE || fs_dst->type == SELVA_FIELD_TYPE_REFERENCES);
        assert(selva_get_fs_by_node(db, src, fs_src->field) == fs_src);
        assert(selva_get_fs_by_node(db, dst, fs_dst->field) == fs_dst);
        assert(fs_src->edge_constraint.dst_node_type == dst->type);
        assert(fs_src->edge_constraint.inverse_field == fs_dst->field);
        assert(fs_dst->edge_constraint.dst_node_type == src->type);
        assert(fs_dst->edge_constraint.inverse_field == fs_src->field);
        assert(fs_dst->field < fields_dst->nr_fields);
#endif

        nfo_dst = &fields_dst->fields_map[fs_dst->field];
        if (nfo_dst->in_use) {
            if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE) {
                struct SelvaNode *removed;

#if 0
                assert(fs_dst->edge_constraint.dst_node_type == src->type);
#endif
                removed = del_single_ref(db, dst, &fs_dst->edge_constraint, fields_dst, nfo_dst, false);
                assert(removed == src);
            } else if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCES) {
                struct SelvaNodeReferences *refs = nfo2p(fields_dst, nfo_dst);

                if (!node_id_set_has(refs->index, refs->nr_refs, src->node_id)) {
                    goto out;
                }

                ssize_t i = fast_linear_search_references(refs->refs, refs->nr_refs, src);
                assert(i >= 0);
                del_multi_ref(db, dst, &fs_dst->edge_constraint, refs, i);
            }
        }
    }

out:
    return dst_node_id;
}

static void remove_weak_reference(struct SelvaFields *fields, const struct SelvaFieldSchema *fs_src, node_id_t orig_dst)
{
    struct SelvaFieldInfo *nfo = &fields->fields_map[fs_src->field];
    void *vp = nfo2p(fields, nfo);

    if (fs_src->type == SELVA_FIELD_TYPE_WEAK_REFERENCE) {
        memset(vp, 0, sizeof(struct SelvaNodeWeakReference));
    } else if (fs_src->type == SELVA_FIELD_TYPE_WEAK_REFERENCES) {
        struct SelvaNodeWeakReferences refs;

        memcpy(&refs, vp, sizeof(refs));

        if (!refs.refs) {
            return;
        }

        for (size_t i = 0; i < refs.nr_refs; i++) {
            if (refs.refs[i].dst_id == orig_dst) {
                if (i == 0) {
                    /*
                     * Head removal can be done by offsetting the pointer.
                     */
                    refs.offset++;
                    refs.refs++;

                    static_assert(sizeof(refs.offset) == sizeof(uint32_t));
                    if (refs.offset == 0xFFFFFFFF) {
                        remove_weak_refs_offset(&refs);
                    }
                } else if (i + 1 < refs.nr_refs) {
                    /*
                     * Otherwise we must do a slightly expensive memmove().
                     */
                    memmove(&refs.refs[i],
                            &refs.refs[i + 1],
                            (refs.nr_refs - i - 1) * sizeof(struct SelvaNodeWeakReference));
                }

                refs.nr_refs--;

                /*
                 * Realloc if we have a lot of extra space.
                 */
                if (selva_sallocx(refs.refs - refs.offset, 0) / sizeof(refs.refs[0]) >= refs.nr_refs + 131072) {
                    remove_weak_refs_offset(&refs);
                    refs.refs = selva_realloc(refs.refs, refs.nr_refs);
                }

                memcpy(vp, &refs, sizeof(refs));
                break;
            }
        }
    }
}

static struct SelvaNodeReferences *clear_references(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, selva_dirty_node_cb_t dirty_cb, void *dirty_ctx)
{
    struct SelvaFields *fields = &node->fields;
    struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];
    struct SelvaNodeReferences *refs;

    if (!nfo->in_use) {
        return nullptr;
    }

    refs = nfo2p(fields, nfo);
#if 0
    assert(((uintptr_t)refs & 7) == 0);
#endif

    if (dirty_cb && !(fs->edge_constraint.flags & EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP)) {
        dirty_cb(dirty_ctx, node->type, node->node_id);
    }

    while (refs->nr_refs > 0) {
        ssize_t i = refs->nr_refs - 1;
        node_id_t removed_dst;

        /*
         * Deleting the last ref first is faster because a memmove() is not needed.
         * TODO do we even need dst_node_id here.
         */
        node_id_t dst_node_id = refs->refs[i].dst->node_id;
        removed_dst = remove_reference(db, node, fs, dst_node_id, i, false);
        assert(removed_dst == dst_node_id);
        if (dirty_cb) {
            /*
             * TODO Don't call if this side of the ref is not saved. This would
             * be if the other side is a SELVA_FIELD_TYPE_REFERENCE field.
             * Otherwise, it's always saved.
             */
            dirty_cb(dirty_ctx, fs->edge_constraint.dst_node_type, removed_dst);
        }
    }

    selva_free(refs->index);
    refs->index = nullptr;

    return refs;
}

__attribute__((nonnull(1, 2)))
static void remove_references(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, selva_dirty_node_cb_t dirty_cb, void *dirty_ctx)
{
    struct SelvaNodeReferences *refs = clear_references(db, node, fs, dirty_cb, dirty_ctx);
    if (refs) {
        selva_free(refs->refs - refs->offset);
        /*
         * ref->index is already freed.
         * TODO but maybe index shouldn't be freed by clear?
         */
    }
}

static void remove_weak_references(struct SelvaFields *fields, const struct SelvaFieldSchema *fs)
{
    struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];
    struct SelvaNodeWeakReferences refs;

    memcpy(&refs, nfo2p(fields, nfo), sizeof(refs));

    selva_free(refs.refs - refs.offset);
}

static int set_weak_references(struct SelvaFields *fields, const struct SelvaFieldSchema *fs_src, struct SelvaNodeWeakReference dsts[], size_t nr_dsts)
{
    struct SelvaFieldInfo *nfo = &fields->fields_map[fs_src->field];
    void *vp = nfo2p(fields, nfo);
    struct SelvaNodeWeakReferences refs;

    assert(fs_src->type == SELVA_FIELD_TYPE_WEAK_REFERENCES);

    if (nr_dsts == 0) {
        return 0;
    }

    memcpy(&refs, vp, sizeof(refs));

    /*
     * Get rid of any offset first.
     */
    remove_weak_refs_offset(&refs);

    /*
     * Then add the new reference.
     */
    refs.nr_refs += nr_dsts;
    refs.refs = selva_realloc(refs.refs, refs.nr_refs * sizeof(*refs.refs));
    memcpy(refs.refs + refs.nr_refs - nr_dsts, dsts, nr_dsts * sizeof(*refs.refs));

    memcpy(vp, &refs, sizeof(refs));

    return 0;
}

/**
 * Generic set function for SelvaFields that can be used for node fields as well as for edge metadata.
 * @param db Can be NULL if field type is not a strong reference.
 * @param node Can be NULL if field type is not a strong reference.
 */
static int fields_set(struct SelvaNode *node, const struct SelvaFieldSchema *fs, struct SelvaFields *fields, const void *value, size_t len)
{
    struct SelvaFieldInfo *nfo = ensure_field(fields, fs);
    const enum SelvaFieldType type = fs->type;

    switch (type) {
    case SELVA_FIELD_TYPE_NULL:
        break;
        /*
         * Note: We don't verify len in this function. We merely expect that
         * the caller is passing it correctly.
         */
    case SELVA_FIELD_TYPE_WEAK_REFERENCE:
        memcpy(nfo2p(fields, nfo), value, len);
        break;
    case SELVA_FIELD_TYPE_STRING:
        return set_field_string(fields, fs, nfo, value, len);
    case SELVA_FIELD_TYPE_TEXT:
        return selva_fields_set_text(node, fs, value, len);
    case SELVA_FIELD_TYPE_WEAK_REFERENCES:
        if ((len % sizeof(struct SelvaNodeWeakReference)) != 0) {
            return SELVA_EINVAL;
        }
        return set_weak_references(fields, fs, (struct SelvaNodeWeakReference *)value, len / sizeof(struct SelvaNodeWeakReference));
    case SELVA_FIELD_TYPE_MICRO_BUFFER: /* JBOB or MUFFER? */
        assert(len <= fs->smb.len);
        memcpy(nfo2p(fields, nfo), value, len);
        memset((char *)nfo2p(fields, nfo) + len, 0, fs->smb.len - len);
        break;
    case SELVA_FIELD_TYPE_REFERENCES:
    case SELVA_FIELD_TYPE_REFERENCE:
    case SELVA_FIELD_TYPE_ALIAS:
    case SELVA_FIELD_TYPE_ALIASES:
        return SELVA_ENOTSUP;
    }

    return 0;
}

int selva_fields_set(struct SelvaNode *node, const struct SelvaFieldSchema *fs, const void *value, size_t len)
{
#if 0
    assert(selva_get_fs_by_node(db, node, fs->field) == fs);
#endif
    return fields_set(node, fs, &node->fields, value, len);
}

int fields_set2(struct SelvaNode *node, const struct SelvaFieldSchema *fs, struct SelvaFields *fields, const void *value, size_t len)
{
    return fields_set(node, fs, fields, value, len);
}

int selva_fields_get_mutable_string(struct SelvaNode *node, const struct SelvaFieldSchema *fs, size_t len, struct selva_string **s)
{
    struct SelvaFields *fields = &node->fields;
    struct SelvaFieldInfo *nfo;

    if (fs->type != SELVA_FIELD_TYPE_STRING) {
        return SELVA_EINTYPE;
    }

    if (fs->string.fixed_len && len > fs->string.fixed_len) {
        return SELVA_ENOBUFS;
    }

    nfo = ensure_field(fields, fs);
    *s = get_mutable_string(fields, fs, nfo, len);

    return !*s ? SELVA_EINVAL : 0;
}

struct selva_string *selva_fields_ensure_string(struct SelvaNode *node, const struct SelvaFieldSchema *fs, size_t initial_len)
{
    if (fs->type != SELVA_FIELD_TYPE_STRING) {
        return nullptr;
    }

    struct SelvaFields *fields = &node->fields;
    struct SelvaFieldInfo *nfo = ensure_field(fields, fs);

    return get_mutable_string(fields, fs, nfo, initial_len);
}

struct selva_string *selva_fields_ensure_string2(
        struct SelvaDb *db,
        struct SelvaNode *node,
        const struct EdgeFieldConstraint *efc,
        struct SelvaNodeReference *ref,
        const struct SelvaFieldSchema *fs,
        size_t initial_len)
{
    struct SelvaFieldInfo *nfo;

    if (fs->type != SELVA_FIELD_TYPE_STRING) {
        return nullptr;
    }

    selva_fields_ensure_ref_meta(db, node, ref, efc);
    nfo = ensure_field(ref->meta, fs);

    return get_mutable_string(ref->meta, fs, nfo, initial_len);
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

    nfo = &fields->fields_map[fs->field];
    if (!nfo->in_use) {
        *nfo = alloc_block(fields, fs);
        res.text = memset(nfo2p(fields, nfo), 0, sizeof(*res.text));
        res.tl = nullptr;
    } else {
        res.text = nfo2p(fields, nfo);
        res.tl = find_text_by_lang(res.text, lang);
    }

    return res;
}

int selva_fields_set_text(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        const char *str,
        size_t len)
{
    assert(len >= 2 + sizeof(uint32_t));

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
    } else if (!tf.tl) {
        int err;

        tf.text->tl = selva_realloc(tf.text->tl, ++tf.text->len * sizeof(*tf.text->tl));
        tf.tl = memset(&tf.text->tl[tf.text->len - 1], 0, sizeof(*tf.tl));
        err = selva_string_init(tf.tl, nullptr, len, SELVA_STRING_MUTABLE | SELVA_STRING_CRC);
        if (err) {
            db_panic("Failed to init a text field");
        }
    }

    (void)selva_string_replace_crc(tf.tl, str, len, crc);

    return 0;
}

int selva_fields_get_text(
        struct SelvaDb *,
        struct SelvaNode * restrict node,
        const struct SelvaFieldSchema *fs,
        enum selva_lang_code lang,
        const char **str,
        size_t *len)
{
    struct SelvaFields *fields = &node->fields;
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
        struct SelvaNode * restrict src,
        struct SelvaNode * restrict dst,
        const struct SelvaFieldSchema * restrict fs_src,
        const struct SelvaFieldSchema * restrict fs_dst)
{
    struct SelvaFieldInfo *nfo_src = ensure_field(&src->fields, fs_src);
    struct SelvaFieldInfo *nfo_dst = ensure_field(&dst->fields, fs_dst);
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
        bool reorder,
        struct SelvaTypeEntry *te_dst,
        struct SelvaNode *restrict dst,
        struct SelvaNodeReference **ref_out)
{
    const struct SelvaFieldSchema *fs_dst;
    node_type_t type_dst = te_dst->type;

    if (fs->type != SELVA_FIELD_TYPE_REFERENCES ||
        type_dst != dst->type ||
        type_dst != fs->edge_constraint.dst_node_type) {
        return SELVA_EINVAL;
    }

    fs_dst = selva_get_fs_by_te_field(te_dst, fs->edge_constraint.inverse_field);
    if (!fs_dst) {
        return SELVA_EINTYPE;
    }

    if (add_to_refs_index(node, dst, fs, fs_dst)) {
        int err;

        if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE) {
            remove_reference(db, dst, fs_dst, 0, -1, false);
        }

        /*
         * Two-way write.
         * See: write_ref_2way()
         */
        err = write_refs(node, fs, index, dst, ref_out);
        if (err) {
            db_panic("Failed to write ref: %s", selva_strerror(err));
        }
        err = (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE)
            ? write_ref(dst, fs_dst, node, nullptr)
            : write_refs(dst, fs_dst, -1, node, nullptr);
        if (err) {
            db_panic("Failed to write the inverse reference field: %s", selva_strerror(err));
        }

        return 0;
    } else if (reorder) {
        struct SelvaFields *fields = &node->fields;
        struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];
        struct SelvaNodeReferences *refs = nfo2p(fields, nfo);
        ssize_t index_old;
        int err = 0;

        index_old = fast_linear_search_references(refs->refs, refs->nr_refs, dst);
        if (index_old < 0) {
            return SELVA_EGENERAL;
        } else if (index_old == index) {
            goto done;
        }

        err = selva_fields_references_move(node, fs, index_old, index);

done:
        if (ref_out) {
            *ref_out = &refs->refs[index];
        }
        return err;
    } else {
        if (ref_out) {
            struct SelvaFields *fields = &node->fields;
            struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];
            struct SelvaNodeReferences *refs = nfo2p(fields, nfo);

            *ref_out = &refs->refs[fast_linear_search_references(refs->refs, refs->nr_refs, dst)];
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
        struct SelvaNodeReference **ref_out,
        node_id_t dirty_nodes[static 2])
{
    const struct SelvaFieldSchema *fs_dst;
    int err;

    assert(fs_src->type == SELVA_FIELD_TYPE_REFERENCE);
    assert(fs_src->edge_constraint.dst_node_type == dst->type);

    if (!dst || src == dst) {
        return SELVA_EINVAL;
    }

    fs_dst = get_edge_dst_fs(db, fs_src);
    if (!fs_dst) {
        return SELVA_EINTYPE;
    }
#if 0
    assert(fs_dst->edge_constraint.dst_node_type == src->type);
#endif

    if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCES && !add_to_refs_index(src, dst, fs_src, fs_dst)) {
        return SELVA_EEXIST;
    }

    /*
     * Remove previous refs.
     */
    dirty_nodes[0] = remove_reference(db, src, fs_src, 0, -1, true);
    if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE) {
        /* The destination may have a ref to somewhere. */
        dirty_nodes[1] = remove_reference(db, dst, fs_dst, 0, -1, false);
    } else {
        dirty_nodes[1] = 0;
    }

    /*
     * Two-way write.
     * See: write_ref_2way()
     */
    err = write_ref(src, fs_src, dst, ref_out);
    if (err) {
        db_panic("Failed to write ref: %s", selva_strerror(err));
    }
    err = (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE)
        ? write_ref(dst, fs_dst, src, nullptr)
        : write_refs(dst, fs_dst, -1, src, nullptr);
    if (err) {
        db_panic("Failed to write the inverse reference field: %s", selva_strerror(err));
    }

    return 0;
}

size_t selva_fields_prealloc_refs(struct SelvaNode *node, const struct SelvaFieldSchema *fs, size_t nr_refs_min)
{
    struct SelvaFields *fields = &node->fields;

    if (unlikely(fs->type != SELVA_FIELD_TYPE_REFERENCES)) {
        db_panic("Invalid type: %s", selva_str_field_type(fs->type));
    }

    struct SelvaFieldInfo *nfo = ensure_field(fields, fs);
    struct SelvaNodeReferences *refs = nfo2p(fields, nfo);

    if (refs->nr_refs >= nr_refs_min) {
        goto out;
    }

    if (refs->refs) {
        remove_refs_offset(refs);
    }
    refs->refs = selva_realloc(refs->refs, nr_refs_min * sizeof(*refs->refs));
    refs->index = selva_realloc(refs->index, nr_refs_min * sizeof(refs->index[0]));

out:
    return refs->nr_refs;
}

static void selva_fields_references_insert_tail_wupsert_empty_src_field(
        struct SelvaDb *db,
        struct SelvaTypeEntry *te_dst,
        struct SelvaNode *restrict src,
        const struct SelvaFieldSchema *fs_src,
        const struct SelvaFieldSchema *fs_dst,
        const node_id_t ids[],
        size_t nr_ids,
        void (*fn)(struct SelvaDb *db, struct SelvaNode *restrict src, struct SelvaNode *restrict dst, const struct SelvaFieldSchema *fs_src, const struct SelvaFieldSchema *fs_dst))
{
    for (size_t i = 0; i < nr_ids; i++) {
        node_id_t dst_id = ids[i];
        struct SelvaNode *dst;

        dst = selva_upsert_node(te_dst, dst_id);
        if (!dst) {
            continue;
        }

        if (!add_to_refs_index(src, dst, fs_src, fs_dst)) {
            continue; /* ignore. */
        }

        fn(db, src, dst, fs_src, fs_dst);
    }
}

static void selva_fields_references_insert_tail_wupsert_nonempty_src_field(
        struct SelvaDb *db,
        struct SelvaTypeEntry *te_dst,
        struct SelvaNode *restrict src,
        const struct SelvaFieldSchema *fs_src,
        const struct SelvaFieldSchema *fs_dst,
        const node_id_t ids[],
        size_t nr_ids,
        void (*fn)(struct SelvaDb *db, struct SelvaNode *restrict src, struct SelvaNode *restrict dst, const struct SelvaFieldSchema *fs_src, const struct SelvaFieldSchema *fs_dst))
{
    const struct SelvaFields *fields = &src->fields;
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

        dst = selva_upsert_node(te_dst, dst_id);
        if (!dst) {
            continue;
        }

        if (!add_to_refs_index(src, dst, fs_src, fs_dst)) {
            continue; /* already inserted. */
        }

        fn(db, src, dst, fs_src, fs_dst);
    }
}

static void selva_fields_references_insert_tail_wupsert_insert_refs(
        struct SelvaDb *,
        struct SelvaNode *restrict src,
        struct SelvaNode *restrict dst,
        const struct SelvaFieldSchema *fs_src,
        const struct SelvaFieldSchema *fs_dst)
{
#if 0
    assert(fs_dst->type == SELVA_FIELD_TYPE_REFERENCES);
#endif
    write_ref_2way(src, fs_src, -1, dst, fs_dst);
}

static void selva_fields_references_insert_tail_wupsert_insert_ref(
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
    remove_reference(db, dst, fs_dst, 0, -1, false);
    write_ref_2way(src, fs_src, -1, dst, fs_dst);
}

int selva_fields_references_insert_tail_wupsert(
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

    fs_dst = selva_get_fs_by_te_field(te_dst, fs->edge_constraint.inverse_field);
    if (!fs_dst) {
        return SELVA_EINTYPE;
    }

    const size_t old_nr_refs = selva_fields_prealloc_refs(node, fs, nr_ids);
    if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCES) {
        if (old_nr_refs == 0) { /* field is empty. */
            selva_fields_references_insert_tail_wupsert_empty_src_field(db, te_dst, node, fs, fs_dst, ids, nr_ids, selva_fields_references_insert_tail_wupsert_insert_refs);
        } else { /* field is non-empty. */
            selva_fields_references_insert_tail_wupsert_nonempty_src_field(db, te_dst, node, fs, fs_dst, ids, nr_ids, selva_fields_references_insert_tail_wupsert_insert_refs);
        }
    } else { /* fs_dst->type == SELVA_FIELD_TYPE_REFERENCE */
        if (old_nr_refs == 0) {
            selva_fields_references_insert_tail_wupsert_empty_src_field(db, te_dst, node, fs, fs_dst, ids, nr_ids, selva_fields_references_insert_tail_wupsert_insert_ref);
        } else {
            selva_fields_references_insert_tail_wupsert_nonempty_src_field(db, te_dst, node, fs, fs_dst, ids, nr_ids, selva_fields_references_insert_tail_wupsert_insert_ref);
        }
    }

    return 0;
}

static int clone_refs(struct SelvaNodeReferences *refs, struct SelvaFields *fields, const struct SelvaFieldSchema *fs)
{
    struct SelvaFieldInfo *nfo;

    if (fs->type != SELVA_FIELD_TYPE_REFERENCES) {
        return SELVA_EINTYPE;
    }

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

    index_old = ary_idx_to_abs(refs.nr_refs, index_old);
    index_new = min(ary_idx_to_abs(refs.nr_refs, index_new), refs.nr_refs - 1);

    if (index_old < 0 || index_old >= refs.nr_refs ||
        index_new < 0 || index_new >= refs.nr_refs) {
        return SELVA_EINVAL;
    }

    if (index_old < index_new) {
        struct SelvaNodeReference tmp = refs.refs[index_old];

        /*
         *   0   1   2   3   4   5   6
         * | a | b |   | d | e | f | g |
         *           |           ^
         *           +-----c-----+
         *
         * First fill the hole.
         */
        memmove(refs.refs + index_old, refs.refs + index_old + 1, (index_new - index_old) * sizeof(*refs.refs));
        /*
         *   0   1   2   3   4   5   6
         * | a | b | d | e | f |   | g |
         *           |           ^
         *           +-----c-----+
         *
         * Assign tmp to the new index.
         */
        refs.refs[index_new] = tmp;
        /*
         *   0   1   2   3   4   5   6
         * | a | b | d | e | f | c | g |
         */
    } else if (index_old > index_new) {
        struct SelvaNodeReference tmp = refs.refs[index_old];

        /*
         *   0   1   2   3   4   5   6
         * | a | b | c | d | e |   | g |
         *           ^           |
         *           +-----f-----+
         *
         * First fill the hole.
         */
        memmove(refs.refs + index_new + 1, refs.refs + index_new, (index_old - index_new) * sizeof(*refs.refs));
        /*
         *   0   1   2   3   4   5   6
         * | a | b |   | c | d | e | g |
         *           ^           |
         *           +-----f-----+
         *
         * Assign tmp to the new index.
         */
        refs.refs[index_new] = tmp;
        /*
         *   0   1   2   3   4   5   6
         * | a | b | f | c | d | e | g |
         */
    } /* else NOP */

    return 0;
}

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
    struct SelvaNodeReference *ap = &refs.refs[index1];
    struct SelvaNodeReference *bp = &refs.refs[index2];
    struct SelvaNodeReference a = *ap;
    struct SelvaNodeReference b = *bp;
    *ap = b;
    *bp = a;

    return 0;
}

/**
 * Create meta if it's not initialized yet.
 * Most importantly this function makes sure that the object is shared between
 * both ends of the edge.
 */
void selva_fields_ensure_ref_meta(struct SelvaDb *db, struct SelvaNode *node, struct SelvaNodeReference *ref, const struct EdgeFieldConstraint *efc)
{
    const struct SelvaFieldsSchema *efc_fields_schema = selva_get_edge_field_fields_schema(db, efc);
    const field_t nr_fields = efc_fields_schema ? efc_fields_schema->nr_fields : 0;

    if (nr_fields > 0 && !ref->meta) {
        reference_meta_create(ref, nr_fields);

        struct SelvaTypeEntry *type_dst = selva_get_type_by_index(db, efc->dst_node_type);
        const struct SelvaFieldSchema *fs_dst = selva_get_fs_by_te_field(type_dst, efc->inverse_field);
        struct SelvaFields *dst_fields = &ref->dst->fields;
        const struct SelvaFieldInfo *dst_nfo = &dst_fields->fields_map[efc->inverse_field];

        if (unlikely(!dst_nfo->in_use)) {
            db_panic("dst field missing");
        }

        /*
         * Share the meta fields with the destination node
         * i.e. set it at the other end of the edge.
         */
        if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE) {
            struct SelvaNodeReference *dst_ref = nfo2p(dst_fields, dst_nfo);

            dst_ref->meta = ref->meta;
        } else if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCES) {
            struct SelvaNodeReferences refs;
            node_id_t src_node_id = node->node_id;

            memcpy(&refs, nfo2p(dst_fields, dst_nfo), sizeof(refs));
            for (size_t i = 0; i < refs.nr_refs; i++) {
                struct SelvaNode *tmp;

                tmp = refs.refs[i].dst;
                if (tmp && tmp->node_id == src_node_id) {
                    refs.refs[i].meta = ref->meta;
                    break;
                }
            }
        } else {
            db_panic("Invalid inverse field type: %d", fs_dst->type);
        }
    }
}

int selva_fields_set_reference_meta(
        struct SelvaDb *db,
        struct SelvaNode *node,
        struct SelvaNodeReference *ref,
        const struct EdgeFieldConstraint *efc,
        field_t field,
        const void *value, size_t len)
{
    const struct SelvaFieldsSchema *efc_fields_schema;
    const struct SelvaFieldSchema *fs;

    if (!ref->dst) {
        return SELVA_ENOENT;
    }

    efc_fields_schema = selva_get_edge_field_fields_schema(db, efc);
    if (!efc_fields_schema) {
        return SELVA_EINVAL;
    }

    fs = get_fs_by_fields_schema_field(efc_fields_schema, field);
    if (!fs) {
        return SELVA_EINVAL;
    }
#if 0
    assert(fs->field == field);
#endif

    /*
     * Edge metadata can't contain these types because it would be almost
     * impossible to keep track of the pointers.
     */
    if (fs->type == SELVA_FIELD_TYPE_REFERENCE ||
        fs->type == SELVA_FIELD_TYPE_REFERENCES) {
        return SELVA_ENOTSUP;
    }

    selva_fields_ensure_ref_meta(db, node, ref, efc);
    return fields_set(nullptr, fs, ref->meta, value, len);
}

int selva_fields_get_reference_meta_mutable_string(
        struct SelvaDb *db,
        struct SelvaNode *node,
        struct SelvaNodeReference *ref,
        const struct EdgeFieldConstraint *efc,
        field_t field,
        size_t len,
        struct selva_string **s)
{
    const struct SelvaFieldsSchema *efc_fields_schema = selva_get_edge_field_fields_schema(db, efc);
    const struct SelvaFieldSchema *fs;

    fs = get_fs_by_fields_schema_field(efc_fields_schema, field);
    if (!fs) {
        return SELVA_EINTYPE;
    } else if (fs->type != SELVA_FIELD_TYPE_STRING) {
        return SELVA_EINTYPE;
    }

    if (fs->string.fixed_len && len > fs->string.fixed_len) {
        return SELVA_ENOBUFS;
    }

    selva_fields_ensure_ref_meta(db, node, ref, efc);
    *s = get_mutable_string(ref->meta, fs, ensure_field(ref->meta, fs), len);

    return 0;
}

struct SelvaNodeReference *selva_fields_get_reference(struct SelvaDb *, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    struct SelvaFields *fields = &node->fields;
    const struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];
    struct SelvaNodeReference *ref;

    if (fs->field >= node->fields.nr_fields || fs->type != SELVA_FIELD_TYPE_REFERENCE || !nfo->in_use) {
        return nullptr;
    }

    ref = (struct SelvaNodeReference *)nfo2p(fields, nfo);

#if 0
    /* Verify proper alignment. */
    assert(((uintptr_t)ref & 7) == 0);
#endif

    return ref;
}

struct SelvaNodeReferences *selva_fields_get_references(struct SelvaDb *, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    struct SelvaFields *fields = &node->fields;
    const struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];
    struct SelvaNodeReferences *refs;

    if (fs->field >= node->fields.nr_fields || fs->type != SELVA_FIELD_TYPE_REFERENCES || !nfo->in_use) {
        return nullptr;
    }

    refs = (struct SelvaNodeReferences *)nfo2p(fields, nfo);

#if 0
    /* Verify proper alignment. */
    assert(((uintptr_t)refs & 7) == 0);
#endif

    return refs;
}

struct SelvaNodeWeakReference selva_fields_get_weak_reference(struct SelvaDb *, struct SelvaFields *fields, field_t field)
{
    const struct SelvaFieldInfo *nfo = &fields->fields_map[field];
    struct SelvaNodeWeakReference weak_ref;

    /* TODO Get the fs */
    if (field >= fields->nr_fields || /* fs->type != SELVA_FIELD_TYPE_WEAK_REFERENCE || */ !nfo->in_use) {
        return (struct SelvaNodeWeakReference){};
    }

    memcpy(&weak_ref, nfo2p(fields, nfo), sizeof(struct SelvaNodeWeakReference));

    return weak_ref;
}

struct SelvaNodeWeakReferences selva_fields_get_weak_references(struct SelvaDb *, struct SelvaFields *fields, field_t field)
{
    const struct SelvaFieldInfo *nfo = &fields->fields_map[field];
    struct SelvaNodeWeakReferences weak_refs;

    /* TODO Get the fs */
    if (field >= fields->nr_fields || /* fs->type != SELVA_FIELD_TYPE_WEAK_REFERENCES || */ !nfo->in_use) {
        return (struct SelvaNodeWeakReferences){};
    }

    memcpy(&weak_refs, nfo2p(fields, nfo), sizeof(struct SelvaNodeWeakReferences));

    return weak_refs;
}

struct SelvaNode *selva_fields_resolve_weak_reference(const struct SelvaDb *db, const struct SelvaFieldSchema *fs, const struct SelvaNodeWeakReference *weak_ref)
{
    enum SelvaFieldType field_type = fs->type;

    if (unlikely(field_type != SELVA_FIELD_TYPE_REFERENCE &&
        field_type != SELVA_FIELD_TYPE_REFERENCES &&
        field_type != SELVA_FIELD_TYPE_WEAK_REFERENCE &&
        field_type != SELVA_FIELD_TYPE_WEAK_REFERENCES)) {
        return nullptr;
    }

    node_type_t type = fs->edge_constraint.dst_node_type;
    struct SelvaTypeEntry *te = selva_get_type_by_index(db, type);

    if (unlikely(!te)) {
        return nullptr;
    }

    return selva_find_node(te, weak_ref->dst_id);
}

struct selva_string *selva_fields_get_selva_string2(struct SelvaFields *fields, const struct SelvaFieldSchema *fs)
{
    const struct SelvaFieldInfo *nfo;

    assert(fs->type == SELVA_FIELD_TYPE_STRING);

    if (unlikely(fs->field >= fields->nr_fields)) {
        return nullptr;
    }

    nfo = &fields->fields_map[fs->field];

    return !nfo->in_use ? nullptr : nfo2p(fields, nfo);
}

struct selva_string *selva_fields_get_selva_string(struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    return selva_fields_get_selva_string2(&node->fields, fs);
}

struct selva_string *selva_fields_get_selva_string3(
        struct SelvaNodeReference *ref,
        const struct SelvaFieldSchema *fs)
{
    return ref->meta ? selva_fields_get_selva_string2(ref->meta, fs) : nullptr;
}

struct SelvaFieldsPointer selva_fields_get_raw2(struct SelvaFields *fields, const struct SelvaFieldSchema *fs)
{
    const struct SelvaFieldInfo *nfo;
    enum SelvaFieldType type;

#if 0
    assert(fs->field < fields->nr_fields);
#endif

    nfo = &fields->fields_map[fs->field];
    type = nfo->in_use ? fs->type : SELVA_FIELD_TYPE_NULL;

    switch (type) {
    case SELVA_FIELD_TYPE_NULL:
        return (struct SelvaFieldsPointer){
            .ptr = (uint8_t *)PTAG_GETP(fields->data),
            .off = (nfo->off << SELVA_FIELDS_OFF),
            .len = 0,
        };
    case SELVA_FIELD_TYPE_TEXT:
    case SELVA_FIELD_TYPE_REFERENCE:
    case SELVA_FIELD_TYPE_REFERENCES:
    case SELVA_FIELD_TYPE_WEAK_REFERENCE:
    case SELVA_FIELD_TYPE_WEAK_REFERENCES:
        return (struct SelvaFieldsPointer){
            .ptr = (uint8_t *)PTAG_GETP(fields->data),
            .off = (nfo->off << 3),
            .len = selva_fields_get_data_size(fs),
        };
    case SELVA_FIELD_TYPE_STRING:
        do {
            const struct selva_string *s = (const struct selva_string *)((uint8_t *)PTAG_GETP(fields->data) + (nfo->off << 3));
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
            .ptr = (uint8_t *)PTAG_GETP(fields->data),
            .off = (nfo->off << SELVA_FIELDS_OFF),
            .len = selva_fields_get_data_size(fs),
        };
    case SELVA_FIELD_TYPE_ALIAS:
    case SELVA_FIELD_TYPE_ALIASES:
        return (struct SelvaFieldsPointer){
            .ptr = nullptr,
            .off = 0,
            .len = 0,
        };
    }
    db_panic("Invalid type");
}

struct SelvaFieldsPointer selva_fields_get_raw(struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    return selva_fields_get_raw2(&node->fields, fs);
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

static int fields_del(struct SelvaDb *db, struct SelvaNode *node, struct SelvaFields *fields, const struct SelvaFieldSchema *fs, selva_dirty_node_cb_t dirty_cb, void *dirty_ctx)
{
    struct SelvaFieldInfo *nfo;
    enum SelvaFieldType type;

    if (unlikely(fs->field >= fields->nr_fields)) {
        return SELVA_ENOENT;
    }

    nfo = &fields->fields_map[fs->field];
    type = nfo->in_use ? fs->type : SELVA_FIELD_TYPE_NULL;

    switch (type) {
    case SELVA_FIELD_TYPE_NULL:
    case SELVA_FIELD_TYPE_MICRO_BUFFER:
        /* NOP */
        break;
    case SELVA_FIELD_TYPE_STRING:
        del_field_string(fields, nfo);
        return 0; /* Don't clear. */
    case SELVA_FIELD_TYPE_TEXT:
        del_field_text(fields, nfo);
        break;
    case SELVA_FIELD_TYPE_REFERENCE:
        {
            assert(node);
            node_id_t old_dst = remove_reference(db, node, fs, 0, -1, false);
            if (old_dst && dirty_cb) {
                /* TODO Don't call if this side of the ref is not saved. */
                dirty_cb(dirty_ctx, fs->edge_constraint.dst_node_type, old_dst);
            }
        }
        break;
    case SELVA_FIELD_TYPE_REFERENCES:
        assert(node);
        remove_references(db, node, fs, dirty_cb, dirty_ctx);
        break;
    case SELVA_FIELD_TYPE_WEAK_REFERENCE:
        remove_weak_reference(fields, fs, 0);
        break;
    case SELVA_FIELD_TYPE_WEAK_REFERENCES:
        remove_weak_references(fields, fs);
        break;
    case SELVA_FIELD_TYPE_ALIAS:
    case SELVA_FIELD_TYPE_ALIASES:
        return SELVA_ENOTSUP;
    }

    memset(nfo2p(fields, nfo), 0, selva_fields_get_data_size(fs));

    return 0;
}

int selva_fields_del(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, selva_dirty_node_cb_t dirty_cb, void *dirty_ctx)
{
    struct SelvaFields *fields = &node->fields;

    return fields_del(db, node, fields, fs, dirty_cb, dirty_ctx);
}

static void reference_meta_del(struct SelvaDb *db, const struct EdgeFieldConstraint *efc, struct SelvaNodeReference *ref, field_t field)
{
    struct SelvaFields *fields = ref->meta;
    const struct SelvaFieldsSchema *schema;
    const struct SelvaFieldSchema *fs;

    if (!fields) {
        return;
    }

    schema = selva_get_edge_field_fields_schema(db, efc);
    fs = get_fs_by_fields_schema_field(schema, field);
    if (!fs) {
        return;
    }

    /* No new nodes will turn dirty due to this operation. */
    fields_del(db, nullptr, fields, fs, nullptr, nullptr);
}

int selva_fields_del_ref(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, node_id_t dst_node_id)
{
    if (fs->type != SELVA_FIELD_TYPE_REFERENCES) {
        return SELVA_EINTYPE;
    }

    struct SelvaNodeReferences *refs = selva_fields_get_references(db, node, fs);
    if (!refs) {
        return SELVA_ENOENT;
    }

    remove_reference(db, node, fs, dst_node_id, -1, false);
    return 0;
}

void selva_fields_clear_references(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, selva_dirty_node_cb_t dirty_cb, void *dirty_ctx)
{
    assert(fs->type == SELVA_FIELD_TYPE_REFERENCES);
    (void)clear_references(db, node, fs, dirty_cb, dirty_ctx);
}

void selva_fields_init(const struct SelvaFieldsSchema *schema, struct SelvaFields *fields)
{
    fields->nr_fields = schema->nr_fields;
    fields->data_len = schema->field_map_template.fixed_data_size;
    fields->data = (fields->data_len > 0) ? selva_calloc(1, fields->data_len) : nullptr; /* No need to tag yet for edge sharing. */
    memcpy(fields->fields_map, schema->field_map_template.buf, schema->field_map_template.len);
}

/**
 * Share fields (refocount = 2).
 * This is used for sharing the fields on an edge.
 */
static void share_fields(struct SelvaFields *fields)
{
    void *data = fields->data;

    if (PTAG_GETTAG(data)) {
        db_panic("fields is already shared");
    }

    fields->data = PTAG(data, 1);
}

/**
 * Unshare fields (refcount = 1)
 */
static void unshare_fields(struct SelvaFields *fields)
{
    fields->data = PTAG(PTAG_GETP(fields->data), 0);
}

static bool is_shared_fields(struct SelvaFields *fields)
{
    return !!PTAG_GETTAG(fields->data);
}

/**
 * Fields must be deleted before calling this function.
 */
static void destroy_fields(struct SelvaFields *fields)
{
    if (is_shared_fields(fields)) {
        db_panic("Can't destroy shared fields");
    }

    /*
     * Clear fields map.
     */
    memset(fields->fields_map, 0, fields->nr_fields * sizeof(fields->fields_map[0]));

    fields->nr_fields = 0;
    fields->data_len = 0;
    selva_free(PTAG_GETP(fields->data));
    fields->data = nullptr;
}

void selva_fields_destroy(struct SelvaDb *db, struct SelvaNode *node, selva_dirty_node_cb_t dirty_cb, void *dirty_ctx)
{
    const struct SelvaNodeSchema *ns = selva_get_ns_by_te(selva_get_type_by_node(db, node));
    const field_t nr_fields = node->fields.nr_fields;

    for (field_t field = 0; field < nr_fields; field++) {
        if (node->fields.fields_map[field].in_use) {
            const struct SelvaFieldSchema *fs;
            int err;

            fs = selva_get_fs_by_ns_field(ns, field);
            if (unlikely(!fs)) {
                db_panic("No field schema found");
            }

            err = fields_del(db, node, &node->fields, fs, dirty_cb, dirty_ctx);
            if (unlikely(err)) {
                db_panic("Failed to remove a field: %s", selva_strerror(err));
            }

        }
    }

    destroy_fields(&node->fields);
}

static void reference_meta_create(struct SelvaNodeReference *ref, size_t nr_fields)
{
    struct SelvaFields *fields = selva_calloc(1, sizeof_wflex(struct SelvaFields, fields_map, nr_fields));
#if 0
    assert(sizeof(*fields) + nr_fields * sizeof(struct SelvaFieldInfo) == sizeof_wflex(struct SelvaFields, fields_map, nr_fields));
#endif
    fields->nr_fields = nr_fields;

    share_fields(fields);
    ref->meta = fields;
}

static void reference_meta_destroy(struct SelvaDb *db, const struct EdgeFieldConstraint *efc, struct SelvaNodeReference *ref)
{
    struct SelvaFields *fields = ref->meta;

    if (!fields) {
        return;
    } else if (is_shared_fields(fields)) {
        /*
         * If data is marked as shared we unshare it now and return immediately.
         */
        unshare_fields(fields);
        return;
    }

    const field_t nr_fields = fields->nr_fields;
    for (field_t field = 0; field < nr_fields; field++) {
        if (fields->fields_map[field].in_use) {
            reference_meta_del(db, efc, ref, field);
        }
    }

    destroy_fields(fields);
}

static inline void hash_ref(selva_hash_state_t *hash_state, struct SelvaDb *db, const struct EdgeFieldConstraint *efc, const struct SelvaNodeReference *ref)
{
    if (ref->dst) {
        selva_hash_update(hash_state, &ref->dst->node_id, sizeof(ref->dst->node_id));
        if (ref->meta) {
            selva_fields_hash_update(hash_state, db, selva_get_edge_field_fields_schema(db, efc), ref->meta);
        }
    } else {
        selva_hash_update(hash_state, &(char){ '\0' }, sizeof(char));
    }
}

void selva_fields_hash_update(selva_hash_state_t *hash_state, struct SelvaDb *db, const struct SelvaFieldsSchema *schema, const struct SelvaFields *fields)
{
    const field_t nr_fields = schema->nr_fields;

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
        case SELVA_FIELD_TYPE_WEAK_REFERENCE:
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
                hash_ref(hash_state, db, selva_get_edge_field_constraint(fs), p);
            } else {
                goto nil;
            }
            break;
        case SELVA_FIELD_TYPE_REFERENCES:
            do {
                const struct SelvaNodeReferences *refs = p;
                const size_t len = nfo->in_use ? refs->nr_refs : 0;

                selva_hash_update(hash_state, &len, sizeof(len));
                for (size_t i = 0; i < len; i++) {
                    hash_ref(hash_state, db, selva_get_edge_field_constraint(fs), &refs->refs[i]);
                }
            } while (0);
            break;
        case SELVA_FIELD_TYPE_WEAK_REFERENCES:
            do {
                const struct SelvaNodeWeakReferences *refs = p;
                const size_t len = nfo->in_use ? refs->nr_refs : 0;

                selva_hash_update(hash_state, &len, sizeof(len));
                if (len) {
                    selva_hash_update(hash_state, refs->refs, len * sizeof(*refs->refs));
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
        case SELVA_FIELD_TYPE_ALIASES:
            /*
             * NOP Aliases are hashed in the node hash in db.c.
             */
            break;
        }
    }
}

selva_hash128_t selva_fields_hash(struct SelvaDb *db, const struct SelvaFieldsSchema *schema, const struct SelvaFields *fields)
{
    selva_hash_state_t *hash_state = selva_hash_create_state();
    selva_hash128_t res;

    selva_hash_reset(hash_state);
    selva_fields_hash_update(hash_state, db, schema, fields);
    res = selva_hash_digest(hash_state);
    selva_hash_free_state(hash_state);

    return res;
}
