/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "jemalloc.h"
#include "xxhash.h"
#include "util/align.h"
#include "util/array_field.h"
#include "util/ptag.h"
#include "util/selva_lang.h"
#include "util/selva_string.h"
#include "selva_error.h"
#include "db_panic.h"
#include "db.h"
#include "idz.h"
#include "selva/fields.h"

#if 0
#define selva_malloc            malloc
#define selva_calloc            calloc
#define selva_realloc           realloc
#define selva_free              free
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
    [SELVA_FIELD_TYPE_TIMESTAMP] = sizeof(int64_t), // time_t
    [SELVA_FIELD_TYPE_CREATED] = sizeof(int64_t),
    [SELVA_FIELD_TYPE_UPDATED] = sizeof(int64_t),
    [SELVA_FIELD_TYPE_NUMBER] = sizeof(double),
    [SELVA_FIELD_TYPE_INTEGER] = sizeof(int32_t),
    [SELVA_FIELD_TYPE_INT8] = sizeof(int8_t),
    [SELVA_FIELD_TYPE_UINT8] = sizeof(uint8_t),
    [SELVA_FIELD_TYPE_INT16] = sizeof(int16_t),
    [SELVA_FIELD_TYPE_UINT16] = sizeof(uint16_t),
    [SELVA_FIELD_TYPE_INT32] = sizeof(int32_t),
    [SELVA_FIELD_TYPE_UINT32] = sizeof(uint32_t),
    [SELVA_FIELD_TYPE_INT64] = sizeof(int64_t),
    [SELVA_FIELD_TYPE_UINT64] = sizeof(uint64_t),
    [SELVA_FIELD_TYPE_BOOLEAN] = sizeof(int8_t),
    [SELVA_FIELD_TYPE_ENUM] = sizeof(uint8_t),
    [SELVA_FIELD_TYPE_STRING] = sizeof(struct selva_string),
    [SELVA_FIELD_TYPE_TEXT] = sizeof(struct SelvaTextField),
    [SELVA_FIELD_TYPE_REFERENCE] = sizeof(struct SelvaNodeReference),
    [SELVA_FIELD_TYPE_REFERENCES] = sizeof(struct SelvaNodeReferences),
    [SELVA_FIELD_TYPE_WEAK_REFERENCE] = sizeof(struct SelvaNodeWeakReference),
    [SELVA_FIELD_TYPE_WEAK_REFERENCES] = sizeof(struct SelvaNodeWeakReferences),
    [SELVA_FIELD_TYPE_MICRO_BUFFER] = sizeof(struct SelvaMicroBuffer),
    [SELVA_FIELD_TYPE_ALIAS] = 0, /* Aliases are stored separately under the type struct. */
    [SELVA_FIELD_TYPE_ALIASES] = 0,
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
        return sizeof(struct SelvaMicroBuffer) + fs->smb.len;
    } else {
        return selva_field_data_size[type];
    }
}

static struct SelvaFieldInfo alloc_block(struct SelvaFields *fields, const struct SelvaFieldSchema *fs)
{
    char *data = (char *)PTAG_GETP(fields->data);
    size_t off = fields->data_len;
    size_t field_data_size = selva_fields_get_data_size(fs);
    size_t new_size = ALIGNED_SIZE(off + field_data_size, SELVA_FIELDS_DATA_ALIGN);

    if (new_size > 0xFFFFFF) {
        db_panic("new_size too large: %zu", new_size);
    }

    if (!data || selva_sallocx(data, 0) < new_size) {
        data = selva_realloc(data, new_size);
        fields->data = PTAG(data, PTAG_GETTAG(fields->data));
    }
    fields->data_len = new_size;

    assert((off & 0x7) == 0);

    memset(data + off, 0, field_data_size);

    return (struct SelvaFieldInfo){
        .type = fs->type,
        .off = off >> 3,
    };
}

static inline void *nfo2p(const struct SelvaFields *fields, const struct SelvaFieldInfo *nfo)
{
    char *data = (char *)PTAG_GETP(fields->data);

    void *p = data + (nfo->off << 3);

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

/**
 * Ensure that a field is allocated properly.
 * @param node Optional node context.
 * @param fields is the fields structure modified.
 */
static struct SelvaFieldInfo *ensure_field(struct SelvaNode *node, struct SelvaFields *fields, const struct SelvaFieldSchema *fs)
{
    const enum SelvaFieldType type = fs->type;
    struct SelvaFieldInfo *nfo;

    nfo = &fields->fields_map[fs->field];
    if (nfo->type == SELVA_FIELD_TYPE_NULL) {
        void *p;

        *nfo = alloc_block(fields, fs);
        p = nfo2p(fields, nfo);

        switch (type) {
        case SELVA_FIELD_TYPE_STRING:
            memset(p, 0, sizeof(struct selva_string));
            break;
        case SELVA_FIELD_TYPE_REFERENCE:
            memset(p, 0, sizeof(struct SelvaNodeReference));
            break;
        case SELVA_FIELD_TYPE_REFERENCES:
            memset(p, 0, sizeof(struct SelvaNodeReferences));
            break;
        default:
            /* NOP */
        }
    } else if (unlikely(nfo->type != type)) {
        db_panic("Invalid nfo type for %.d:%d.%d: %s (%d) != %s (%d)\n",
                 node->type, node->node_id, fs->field,
                 selva_str_field_type(nfo->type), nfo->type,
                 selva_str_field_type(type), type);
    }

    return nfo;
}

/**
 * Get a mutable string in fields at fs/nfo.
 */
static struct selva_string *get_mutable_string(struct SelvaFields *fields, const struct SelvaFieldSchema *fs, struct SelvaFieldInfo *nfo, size_t len)
{
    struct selva_string *s = nfo2p(fields, nfo);

    assert(nfo->type == SELVA_FIELD_TYPE_STRING);
    assert(((uintptr_t)s & 7) == 0);
    assert(s);

    if (!(s->flags & SELVA_STRING_STATIC)) { /* Previously initialized. */
        if (fs->string.fixed_len == 0) {
            selva_string_init(s, NULL, len, SELVA_STRING_MUTABLE | SELVA_STRING_CRC);
        } else {
            assert(len <= fs->string.fixed_len);
            selva_string_init(s, NULL, fs->string.fixed_len, SELVA_STRING_MUTABLE_FIXED | SELVA_STRING_CRC);
        }
    }

    return s;
}

static int set_field_string(struct SelvaFields *fields, const struct SelvaFieldSchema *fs, struct SelvaFieldInfo *nfo, const char *str, size_t len)
{
    struct selva_string *s;

    if (fs->string.fixed_len && len > fs->string.fixed_len) {
        return SELVA_ENOBUFS;
    }

    s = get_mutable_string(fields, fs, nfo, len);
    (void)selva_string_replace(s, str, len);

    return 0;
}

static int set_field_string_crc(struct SelvaFields *fields, const struct SelvaFieldSchema *fs, struct SelvaFieldInfo *nfo, const char *str, size_t len, uint32_t crc)
{
    struct selva_string *s;

    if (fs->string.fixed_len && len > fs->string.fixed_len) {
        return SELVA_ENOBUFS;
    }

    s = get_mutable_string(fields, fs, nfo, len);
    (void)selva_string_replace_crc(s, str, len, crc);

    return 0;
}

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

#if 0
    assert(type == SELVA_FIELD_TYPE_REFERENCE || type == SELVA_FIELD_TYPE_REFERENCES);
    assert(fs->edge_constraint.dst_node_type == dst->type);
#endif

    nfo = ensure_field(node, fields, fs);
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

    nfo = ensure_field(node, fields, fs);

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

            return 0;
        }

        /*
         * Get rid of the offset first.
         */
        remove_refs_offset(&refs);
    }

    index = (index == -1) ? refs.nr_refs : index;
    const size_t new_len = (index > refs.nr_refs) ? index + 1 : refs.nr_refs + 1;
    const size_t new_size = new_len * sizeof(*refs.refs);

    if (!refs.refs || selva_sallocx(refs.refs, 0) < new_size) {
        refs.refs = selva_realloc(refs.refs, new_size);
    }
    if ((size_t)index + 1 < new_len) {
        /* Move old refs to the right to make space. */
        assert(index + 1 + (new_len - index) <= new_len);
        memmove(refs.refs + index + 1, refs.refs + index, (new_len - index) * sizeof(*refs.refs));
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

    if (ref_out) {
        *ref_out = &refs.refs[index];
    }

    /*
     * Update the greatest id observed.
     */
    if (dst->node_id >= idz_unpack(refs.great_idz)) {
        refs.great_idz = idz_pack(dst->node_id);
    }

    memcpy(vp, &refs, sizeof(refs));
    return 0;
}

/**
 * This function must be called if the greatest node_id is removed from refs.
 */
static void update_great_idz(struct SelvaNodeReferences *refs)
{
    size_t nr_refs = refs->nr_refs;
    node_id_t great = 0;

    for (size_t i = 0; i < nr_refs; i++) {
        struct SelvaNode *dst = refs->refs[i].dst;

        if (dst && dst->node_id > great) {
            great = dst->node_id;
        }
    }

    refs->great_idz = idz_pack(great);
}

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
        ? write_ref(src, fs_src, dst, NULL)
        : write_refs(src, fs_src, index, dst, NULL);
    if (err) {
        db_panic("Failed to write ref: %s", selva_strerror(err));
    }

    err = (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE)
        ? write_ref(dst, fs_dst, src, NULL)
        : write_refs(dst, fs_dst, -1, src, NULL);
    if (err) {
        db_panic("Failed to write the inverse reference field: %s", selva_strerror(err));
    }
}

/**
 * Clear single ref value.
 * @returns the original value.
 */
static struct SelvaNode *del_single_ref(struct SelvaDb *db, const struct EdgeFieldConstraint *efc, struct SelvaFields *fields, struct SelvaFieldInfo *nfo)
{
    void *vp = nfo2p(fields, nfo);
    struct SelvaNodeReference ref;

    memcpy(&ref, vp, sizeof(ref));
    memset(vp, 0, sizeof(struct SelvaNode *));
    reference_meta_destroy(db, efc, &ref);

#if 0
    assert(!ref.dst || ref.dst->type == efc->dst_node_type);
#endif

    return ref.dst;
}

/**
 * This is only a helper for remove_reference().
 */
static void del_multi_ref(struct SelvaDb *db, const struct EdgeFieldConstraint *efc, struct SelvaNodeReferences *refs, size_t i)
{
    if (!refs->refs) {
        return;
    }

    reference_meta_destroy(db, efc, &refs->refs[i]);

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
        /* TODO realloc on some condition */
    }
    refs->nr_refs--;
}

static struct SelvaFieldSchema *get_edge_dst_fs(
        const struct SelvaDb *db,
        const struct SelvaFieldSchema *fs_src)
{
    struct SelvaTypeEntry *type_dst;

    if (fs_src->type != SELVA_FIELD_TYPE_REFERENCE &&
        fs_src->type != SELVA_FIELD_TYPE_REFERENCES) {
        return NULL;
    }

    type_dst = selva_get_type_by_index(db, fs_src->edge_constraint.dst_node_type);
    assert(type_dst->type == fs_src->edge_constraint.dst_node_type);

    return selva_get_fs_by_ns_field(&type_dst->ns, fs_src->edge_constraint.inverse_field);
}

/**
 * Delete a reference field edge.
 * The caller must invalidate pointers in ref if relevant.
 * Clears both ways.
 * @param orig_dst should be given if fs_src is of type SELVA_FIELD_TYPE_REFERENCES.
 */
static void remove_reference(struct SelvaDb *db, struct SelvaNode *src, const struct SelvaFieldSchema *fs_src, node_id_t orig_dst)
{
    struct SelvaFields *fields_src = &src->fields;
    struct SelvaFieldInfo *nfo_src = &fields_src->fields_map[fs_src->field];
    struct SelvaNode *dst = NULL;

#if 0
    assert(selva_get_fs_by_node(db, src, fs_src->field) == fs_src);
#endif

    if (nfo_src->type == SELVA_FIELD_TYPE_REFERENCE) {
        assert(fs_src->type == SELVA_FIELD_TYPE_REFERENCE);
        dst = del_single_ref(db, &fs_src->edge_constraint, fields_src, nfo_src);
    } else if (nfo_src->type == SELVA_FIELD_TYPE_REFERENCES) {
        struct SelvaNodeReferences refs;

        assert(fs_src->type == SELVA_FIELD_TYPE_REFERENCES);
        memcpy(&refs, nfo2p(fields_src, nfo_src), sizeof(refs));
        for (size_t i = 0; i < refs.nr_refs; i++) {
            struct SelvaNode *tmp = refs.refs[i].dst;

            if (tmp && tmp->node_id == orig_dst) {
                del_multi_ref(db, &fs_src->edge_constraint, &refs, i);
                if (tmp->node_id >= idz_unpack(refs.great_idz)) {
                    update_great_idz(&refs);
                }
                dst = tmp;
                break;
            }
        }

        if (dst) {
            memcpy(nfo2p(fields_src, nfo_src), &refs, sizeof(refs));
        }
    }

    /*
     * Clear from the other end.
     */
    if (dst) {
        struct SelvaFieldSchema *fs_dst;
        struct SelvaFields *fields_dst = &dst->fields;
        struct SelvaFieldInfo *nfo_dst;

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
        if (nfo_dst->type == SELVA_FIELD_TYPE_REFERENCE) {
            struct SelvaNode *removed;

#if 0
            assert(fs_dst->type == SELVA_FIELD_TYPE_REFERENCE);
            assert(fs_dst->edge_constraint.dst_node_type == src->type);
#endif
            removed = del_single_ref(db, &fs_dst->edge_constraint, fields_dst, nfo_dst);
            assert(removed == src);
        } else if (nfo_dst->type == SELVA_FIELD_TYPE_REFERENCES) {
            struct SelvaNodeReferences refs;
            struct SelvaNode *tmp;

#if 0
            assert(fs_dst->type == SELVA_FIELD_TYPE_REFERENCES);
#endif
            memcpy(&refs, nfo2p(fields_dst, nfo_dst), sizeof(refs));
            for (size_t i = 0; i < refs.nr_refs; i++) {
                tmp = refs.refs[i].dst;
                if (tmp == src) {
                    del_multi_ref(db, &fs_dst->edge_constraint, &refs, i);
                    if (tmp->node_id >= idz_unpack(refs.great_idz)) {
                        update_great_idz(&refs);
                    }
                    break;
                }
            }
            memcpy(nfo2p(fields_dst, nfo_dst), &refs, sizeof(refs));
        }
    }
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
                /* TODO realloc on some condition */

                refs.nr_refs--;
                memcpy(vp, &refs, sizeof(refs));
                break;
            }
        }
    }
}

static struct SelvaNodeReferences *clear_references(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    struct SelvaFields *fields = &node->fields;
    struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];
    struct SelvaNodeReferences *refs;

    if (nfo->type != SELVA_FIELD_TYPE_REFERENCES) {
        return NULL;
    }

    refs = nfo2p(fields, nfo);
    assert(((uintptr_t)refs & 7) == 0);
    while (refs->nr_refs > 0) {
        /*
         * Deleting the last ref first is faster because a memmove() is not needed.
         */
        node_id_t dst_node_id = refs->refs[refs->nr_refs - 1].dst->node_id;

        /*
         * Note that we rely on the fact that the refs pointer doesn't change on delete.
         */
        remove_reference(db, node, fs, dst_node_id);
    }

    return refs;
}

__attribute__((nonnull (1)))
static void remove_references(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    struct SelvaNodeReferences *refs = clear_references(db, node, fs);
    if (refs) {
        selva_free(refs->refs - refs->offset);
    }
}

static void remove_weak_references(struct SelvaFields *fields, const struct SelvaFieldSchema *fs)
{
    struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];
    struct SelvaNodeWeakReferences refs;

    memcpy(&refs, nfo2p(fields, nfo), sizeof(refs));

    selva_free(refs.refs - refs.offset);
    memset(nfo, 0, sizeof(refs));
}

static int check_ref_eexists(struct SelvaFields *fields, const struct SelvaFieldSchema *fs, struct SelvaNode *dst)
{
    struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];

    if (!dst) {
        return SELVA_EINVAL;
    }

    if (nfo->type == SELVA_FIELD_TYPE_REFERENCE) {
        struct SelvaNodeReference ref;

        memcpy(&ref, nfo2p(fields, nfo), sizeof(ref));
        if (ref.dst == dst) {
            return SELVA_EEXIST;
        }
    } else if (nfo->type == SELVA_FIELD_TYPE_REFERENCES) {
        struct SelvaNodeReferences refs;
        node_id_t great_id;

        memcpy(&refs, nfo2p(fields, nfo), sizeof(refs));
        great_id = idz_unpack(refs.great_idz);

        if (dst->node_id <= great_id || great_id == 0) {
            for (size_t i = 0; i < refs.nr_refs; i++) {
                struct SelvaNode *tmp = refs.refs[i].dst;

                if (tmp == dst) {
                    return SELVA_EEXIST;
                }
            }
        }
    }

    return 0;
}

static int check_ref_eexists_fast(
        struct SelvaNode * restrict src,
        struct SelvaNode * restrict dst,
        const struct SelvaFieldSchema * restrict fs_src,
        const struct SelvaFieldSchema * restrict fs_dst)
{
    assert(fs_src->type == SELVA_FIELD_TYPE_REFERENCES);

    /*
     * It's cheaper/faster to check from a reference field rather
     * than a references field.
     */
    return (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE)
        ? check_ref_eexists(&dst->fields, fs_dst, src)
        : check_ref_eexists(&src->fields, fs_src, dst);
}

/**
 * Set reference to fields.
 */
int selva_fields_reference_set(
        struct SelvaDb *db,
        struct SelvaNode * restrict src,
        const struct SelvaFieldSchema *fs_src,
        struct SelvaNode * restrict dst,
        struct SelvaNodeReference **ref_out)
{
    struct SelvaFieldSchema *fs_dst;
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

    /*
     * Fail if ref already set.
     * Only one way check is enough.
     */
    err = check_ref_eexists(&src->fields, fs_src, dst);
    if (err) {
        return err;
    }

    /*
     * Remove previous refs.
     */
    remove_reference(db, src, fs_src, 0);
    if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE) {
        remove_reference(db, dst, fs_dst, 0);
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
        ? write_ref(dst, fs_dst, src, NULL)
        : write_refs(dst, fs_dst, -1, src, NULL);
    if (err) {
        db_panic("Failed to write the inverse reference field: %s", selva_strerror(err));
    }

    return 0;
}

static int tail_insert_references(struct SelvaDb *db, const struct SelvaFieldSchema *fs_src, struct SelvaNode * restrict src, struct SelvaNode * restrict dsts[], size_t nr_dsts)
{
    struct SelvaTypeEntry *te_dst;
    struct SelvaFieldSchema *fs_dst;
    node_type_t type_dst;

    assert(fs_src->type == SELVA_FIELD_TYPE_REFERENCES);

    if (nr_dsts == 0) {
        return 0;
    }

    te_dst = selva_get_type_by_node(db, dsts[0]);
    type_dst = te_dst->type;
    if (type_dst != fs_src->edge_constraint.dst_node_type) {
        return SELVA_EINTYPE; /* TODO Is this the error we want? */
    }

    fs_dst = selva_get_fs_by_ns_field(&te_dst->ns, fs_src->edge_constraint.inverse_field);
    if (!fs_dst) {
        return SELVA_EINTYPE;
    }

    for (size_t i = 0; i < nr_dsts; i++) {
        struct SelvaNode *dst = dsts[i];
        int err;

        if (dst->type != type_dst) {
            return SELVA_EINTYPE;
        }

        err = check_ref_eexists_fast(src, dst, fs_src, fs_dst);
        if (err) {
            return err;
        }
    }

    for (size_t i = 0; i < nr_dsts; i++) {
        struct SelvaNode *dst = dsts[i];

        if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE) {
            remove_reference(db, dst, fs_dst, 0);
        }

        write_ref_2way(src, fs_src, -1, dst, fs_dst);
    }

    return 0;
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

static inline void set_smb(struct SelvaMicroBuffer *buffer, const void *value, size_t len)
{
    typeof(buffer->len) buf_len = (typeof(buf_len))len;

    memcpy(&buffer->len, &buf_len, sizeof(buffer->len));
    memcpy(buffer->data, value, buf_len);
}

static int set_field_smb(struct SelvaFields *fields, struct SelvaFieldInfo *nfo, const void *value, size_t len)
{
    struct SelvaMicroBuffer *buffer = nfo2p(fields, nfo);

    set_smb(buffer, value, len);

    return 0;
}

/**
 * Generic set function for SelvaFields that can be used for node fields as well as for edge metadata.
 * @param db Can be NULL if field type is not a strong reference.
 * @param node Can be NULL if field type is not a strong reference.
 */
static int fields_set(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, struct SelvaFields *fields, const void *value, size_t len)
{
    struct SelvaFieldInfo *nfo = ensure_field(node, fields, fs);
    const enum SelvaFieldType type = fs->type;

    switch (type) {
    case SELVA_FIELD_TYPE_NULL:
        break;
        /* TODO Verify len for all types. */
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
        goto copy;
    case SELVA_FIELD_TYPE_WEAK_REFERENCE:
        if (len != sizeof(struct SelvaNodeWeakReference)) {
            return SELVA_EINVAL;
        }
copy:
        memcpy(nfo2p(fields, nfo), value, len);
        break;
    case SELVA_FIELD_TYPE_STRING:
        return set_field_string(fields, fs, nfo, value, len);
        break;
    case SELVA_FIELD_TYPE_TEXT:
        /* Use selva_fields_set_text() */
        return SELVA_ENOTSUP;
    case SELVA_FIELD_TYPE_REFERENCE:
#if 0
        assert(db && node);
#endif
        if (len < sizeof(struct SelvaNode *)) {
            return SELVA_EINVAL;
        }
        return selva_fields_reference_set(db, node, fs, (struct SelvaNode *)value, NULL);
    case SELVA_FIELD_TYPE_REFERENCES:
        if ((len % sizeof(struct SelvaNode **)) != 0) {
            return SELVA_EINVAL;
        }
        return tail_insert_references(db, fs, node, (struct SelvaNode **)value, len / sizeof(struct SelvaNode **));
    case SELVA_FIELD_TYPE_WEAK_REFERENCES:
        if ((len % sizeof(struct SelvaNodeWeakReference)) != 0) {
            return SELVA_EINVAL;
        }

        return set_weak_references(fields, fs, (struct SelvaNodeWeakReference *)value, len / sizeof(struct SelvaNodeWeakReference));
    case SELVA_FIELD_TYPE_MICRO_BUFFER: /* JBOB or MUFFER? */
        return set_field_smb(fields, nfo, value, len);
        break;
    case SELVA_FIELD_TYPE_ALIAS:
        return SELVA_ENOTSUP;
    case SELVA_FIELD_TYPE_ALIASES:
        return SELVA_ENOTSUP;
    }

    return 0;
}

int selva_fields_set(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, const void *value, size_t len)
{
#if 0
    assert(selva_get_fs_by_node(db, node, fs->field) == fs);
#endif
    return fields_set(db, node, fs, &node->fields, value, len);
}

int selva_fields_set_wcrc(struct SelvaDb *, struct SelvaNode *node, const struct SelvaFieldSchema *fs, const void *value, size_t len, uint32_t crc)
{
    struct SelvaFieldInfo *nfo = ensure_field(node, &node->fields, fs);
    const enum SelvaFieldType type = fs->type;

    switch (type) {
    case SELVA_FIELD_TYPE_STRING:
        return set_field_string_crc(&node->fields, fs, nfo, value, len, crc);
    default:
        return SELVA_ENOTSUP;
    }
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

    nfo = ensure_field(node, fields, fs);
    *s = get_mutable_string(fields, fs, nfo, len);

    return 0;
}

static struct selva_string *find_text_by_lang(const struct SelvaTextField *text, enum selva_lang_code lang)
{
    const size_t len = text->len;

    for (size_t i = 0; i < len; i++) {
        if (text->tl[i].lang == lang) {
            return &text->tl[i];
        }
    }

    return NULL;
}

static void del_field_text(struct SelvaFields *fields, struct SelvaFieldInfo *nfo)
{
    struct SelvaTextField *text;

    assert(nfo->type == SELVA_FIELD_TYPE_TEXT);
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

static struct ensure_text_field ensure_text_field(struct SelvaFields *fields, const struct SelvaFieldSchema *fs, enum selva_lang_code lang)
{
    struct SelvaFieldInfo *nfo;
    struct ensure_text_field res = {};

    if (fs->type != SELVA_FIELD_TYPE_TEXT) {
        goto fail;
    }

    nfo = &fields->fields_map[fs->field];
    if (nfo->type == SELVA_FIELD_TYPE_NULL) {
        *nfo = alloc_block(fields, fs);
        res.text = memset(nfo2p(fields, nfo), 0, sizeof(*res.text));
        res.tl = NULL;
    } else if (nfo->type == SELVA_FIELD_TYPE_TEXT) {
        res.text = nfo2p(fields, nfo);
        res.tl = find_text_by_lang(res.text, lang);
    }

fail:
    return res;
}

int selva_fields_set_text(
        struct SelvaDb *,
        struct SelvaNode * restrict node,
        const struct SelvaFieldSchema *fs,
        enum selva_lang_code lang,
        const char *str,
        size_t len)
{
    struct SelvaFields *fields = &node->fields;
    struct ensure_text_field tf;

    if (fs->type != SELVA_FIELD_TYPE_TEXT) {
        return SELVA_EINVAL;
    }

    tf = ensure_text_field(fields, fs, lang);
    if (!tf.text) {
        struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];

        db_panic("Invalid nfo type for %.d:%d.%d: %s (%d) != %s (%d)\n",
                 node->type, node->node_id, fs->field,
                 selva_str_field_type(nfo->type), nfo->type,
                 selva_str_field_type(fs->type), fs->type);
    } else if (tf.tl) {
        /* Never fails in this case. */
        (void)selva_string_replace(tf.tl, str, len);
        tf.tl->lang = lang; /* TODO Is this necessary? */
    } else {
        int err;

        tf.text->tl = selva_realloc(tf.text->tl, ++tf.text->len * sizeof(*tf.text->tl));
        tf.tl = memset(&tf.text->tl[tf.text->len - 1], 0, sizeof(*tf.tl));
        err = selva_string_init(tf.tl, str, len, SELVA_STRING_MUTABLE | SELVA_STRING_CRC);
        if (err) {
            /* TODO Error handling? */
            db_panic("Failed to init a text field");
        }
        tf.tl->lang = lang;
    }

    return 0;
}

int selva_fields_set_text_crc(
        struct SelvaDb *,
        struct SelvaNode * restrict node,
        const struct SelvaFieldSchema *fs,
        enum selva_lang_code lang,
        const char *str,
        size_t len,
        uint32_t crc)
{
    struct SelvaFields *fields = &node->fields;
    struct ensure_text_field tf;

    if (fs->type != SELVA_FIELD_TYPE_TEXT) {
        return SELVA_EINVAL;
    }

    tf = ensure_text_field(fields, fs, lang);
    if (!tf.text) {
        struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];

        db_panic("Invalid nfo type for %.d:%d.%d: %s (%d) != %s (%d)\n",
                 node->type, node->node_id, fs->field,
                 selva_str_field_type(nfo->type), nfo->type,
                 selva_str_field_type(fs->type), fs->type);
    } else if (tf.tl) {
        /* Never fails in this case. */
        (void)selva_string_replace_crc(tf.tl, str, len, crc);
        tf.tl->lang = lang; /* TODO Is this necessary? */
    } else {
        int err;

        tf.text->tl = selva_realloc(tf.text->tl, ++tf.text->len * sizeof(*tf.text->tl));
        tf.tl = memset(&tf.text->tl[tf.text->len - 1], 0, sizeof(*tf.tl));
        err = selva_string_init_crc(tf.tl, str, len, crc, SELVA_STRING_MUTABLE | SELVA_STRING_CRC);
        if (err) {
            /* TODO Error handling? */
            db_panic("Failed to init a text field");
        }
        tf.tl->lang = lang;
    }

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
    if (nfo->type != SELVA_FIELD_TYPE_TEXT) {
        return SELVA_ENOENT;
    }

    text = nfo2p(fields, nfo);
    s = find_text_by_lang(text, lang);
    if (s) {
        const char *res_str;
        size_t res_len;

        res_str = selva_string_to_str(s, &res_len);
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

int selva_fields_references_insert(
        struct SelvaDb *db,
        struct SelvaNode * restrict node,
        const struct SelvaFieldSchema *fs,
        ssize_t index,
        struct SelvaTypeEntry *te_dst,
        struct SelvaNode *restrict dst,
        struct SelvaNodeReference **ref_out)
{
    struct SelvaFieldSchema *fs_dst;
    node_type_t type_dst = te_dst->type;
    int err;

    if (fs->type != SELVA_FIELD_TYPE_REFERENCES ||
        type_dst != dst->type ||
        type_dst != fs->edge_constraint.dst_node_type) {
        return SELVA_EINVAL;
    }

    fs_dst = selva_get_fs_by_ns_field(&te_dst->ns, fs->edge_constraint.inverse_field);
    if (!fs_dst) {
        return SELVA_EINTYPE;
    }

     err = check_ref_eexists_fast(node, dst, fs, fs_dst);
     if (err) {
         return err;
     }

    if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE) {
        remove_reference(db, dst, fs_dst, 0);
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
        ? write_ref(dst, fs_dst, node, NULL)
        : write_refs(dst, fs_dst, -1, node, NULL);
    if (err) {
        db_panic("Failed to write the inverse reference field: %s", selva_strerror(err));
    }

    return 0;
}

void selva_fields_prealloc_refs(struct SelvaNode *node, const struct SelvaFieldSchema *fs, size_t nr_refs_min)
{
    struct SelvaFields *fields = &node->fields;
    struct SelvaFieldInfo *nfo;

    if (unlikely(fs->type != SELVA_FIELD_TYPE_REFERENCES)) {
        db_panic("Invalid type: %s", selva_str_field_type(fs->type));
    }

    nfo = ensure_field(node, fields, fs);

    struct SelvaNodeReferences refs;
    void *vp = nfo2p(fields, nfo);

    if (refs.nr_refs >= nr_refs_min) {
        return;
    }

    size_t new_size = nr_refs_min * sizeof(*refs.refs);

    memcpy(&refs, vp, sizeof(refs));
    refs.refs = selva_realloc(refs.refs, new_size);
    memcpy(vp, &refs, sizeof(refs));
}

int selva_fields_references_insert_tail_wupsert(
        struct SelvaDb *db,
        struct SelvaNode * restrict node,
        const struct SelvaFieldSchema *fs,
        struct SelvaTypeEntry *te_dst,
        const node_id_t ids[],
        size_t nr_ids) {
    struct SelvaFieldSchema *fs_dst;
    node_type_t type_dst = te_dst->type;

    if (fs->type != SELVA_FIELD_TYPE_REFERENCES ||
        type_dst != fs->edge_constraint.dst_node_type) {
        return SELVA_EINVAL;
    }

    if (nr_ids == 0) {
        return 0;
    }

    fs_dst = selva_get_fs_by_ns_field(&te_dst->ns, fs->edge_constraint.inverse_field);
    if (!fs_dst) {
        return SELVA_EINTYPE;
    }

    selva_fields_prealloc_refs(node, fs, nr_ids);

    for (size_t i = 0; i < nr_ids; i++) {
        node_id_t dst_id = ids[i];
        struct SelvaNode *dst = selva_upsert_node(te_dst, dst_id);
        int err;

        if (!dst) {
            /* TODO wat do? */
            continue;
        }

        err = check_ref_eexists_fast(node, dst, fs, fs_dst);
        if (!err) {
            if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE) {
                remove_reference(db, dst, fs_dst, 0);
            }

            write_ref_2way(node, fs, -1, dst, fs_dst);
        }
    }

    return 0;
}

static int get_refs(struct SelvaNodeReferences *refs, struct SelvaFields *fields, const struct SelvaFieldSchema *fs)
{
    struct SelvaFieldInfo *nfo;

    if (fs->type != SELVA_FIELD_TYPE_REFERENCES) {
        return SELVA_EINTYPE;
    }

    nfo = &fields->fields_map[fs->field];
    if (nfo->type != SELVA_FIELD_TYPE_REFERENCES) {
        return SELVA_ENOENT;
    }

    memcpy(refs, nfo2p(fields, nfo), sizeof(*refs));
    return 0;
}

int selva_fields_references_move(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        ssize_t index_old,
        ssize_t index_new)
{
    struct SelvaNodeReferences refs;
    int err;

    err = get_refs(&refs, &node->fields, fs);
    if (err) {
        return err;
    }

    index_old = ary_idx_to_abs(refs.nr_refs, index_old);
    index_new = ary_idx_to_abs(refs.nr_refs, index_new);

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

    err = get_refs(&refs, &node->fields, fs);
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
static void ensure_ref_meta(struct SelvaNode *node, struct SelvaNodeReference *ref, struct EdgeFieldConstraint *efc)
{
    const field_t nr_fields = efc->fields_schema ? efc->fields_schema->nr_fields : 0;

    if (nr_fields > 0 && !ref->meta) {
        reference_meta_create(ref, nr_fields);

        struct SelvaFields *dst_fields = &ref->dst->fields;
        const struct SelvaFieldInfo *dst_nfo = &dst_fields->fields_map[efc->inverse_field];

        /*
         * Share the meta fields with the destination node
         * i.e. set it at the other end of the edge.
         */
        if (dst_nfo->type == SELVA_FIELD_TYPE_REFERENCE) {
            struct SelvaNodeReference dst_ref;

            memcpy(&dst_ref, nfo2p(dst_fields, dst_nfo), sizeof(dst_ref));
            dst_ref.meta = ref->meta;
            memcpy(nfo2p(dst_fields, dst_nfo), &dst_ref, sizeof(dst_ref));
        } else if (dst_nfo->type == SELVA_FIELD_TYPE_REFERENCES) {
            struct SelvaNodeReferences refs;
            struct SelvaNode *tmp;
            node_id_t src_node_id = node->node_id;

            memcpy(&refs, nfo2p(dst_fields, dst_nfo), sizeof(refs));
            for (size_t i = 0; i < refs.nr_refs; i++) {
                tmp = refs.refs[i].dst;
                if (tmp && tmp->node_id == src_node_id) {
                    refs.refs[i].meta = ref->meta;
                    break;
                }
            }
        } else {
            db_panic("Invalid inverse field type: %d", dst_nfo->type);
        }
    }
}

int selva_fields_set_reference_meta(
        struct SelvaNode *node,
        struct SelvaNodeReference *ref,
        struct EdgeFieldConstraint *efc,
        field_t field,
        const void *value, size_t len)
{
    struct SelvaFieldSchema *fs;

    if (!ref->dst) {
        return SELVA_ENOENT;
    }

    if (!efc->fields_schema) {
        return SELVA_EINVAL;
    }

    fs = get_fs_by_fields_schema_field(efc->fields_schema, field);
    if (!fs) {
        return SELVA_EINVAL;
    }
    assert(fs->field == field);

    /*
     * Edge metadata can't contain these types because it would be almost
     * impossible to keep track of the pointers.
     */
    if (fs->type == SELVA_FIELD_TYPE_REFERENCE ||
        fs->type == SELVA_FIELD_TYPE_REFERENCES) {
        return SELVA_ENOTSUP;
    }

    ensure_ref_meta(node, ref, efc);
    return fields_set(NULL, NULL, fs, ref->meta, value, len);
}

int selva_fields_get_reference_meta_mutable_string(
        struct SelvaNode *node,
        struct SelvaNodeReference *ref,
        struct EdgeFieldConstraint *efc,
        field_t field,
        size_t len,
        struct selva_string **s)
{
    struct SelvaFieldSchema *fs;

    fs = get_fs_by_fields_schema_field(efc->fields_schema, field);
    if (!fs) {
        return SELVA_EINTYPE;
    } else if (fs->type != SELVA_FIELD_TYPE_STRING) {
        return SELVA_EINTYPE;
    }

    if (fs->string.fixed_len && len > fs->string.fixed_len) {
        return SELVA_ENOBUFS;
    }

    ensure_ref_meta(node, ref, efc);
    *s = get_mutable_string(ref->meta, fs, ensure_field(NULL, ref->meta, fs), len);

    return 0;
}

struct SelvaFieldsAny selva_fields_get2(struct SelvaFields *fields, field_t field)
{
    struct SelvaFieldsAny any;
    void *p;

    if (field >= fields->nr_fields) {
        any.type = SELVA_FIELD_TYPE_NULL;
    } else {
        const struct SelvaFieldInfo *nfo = &fields->fields_map[field];

        any.type = nfo->type;
        p = nfo2p(fields, nfo);
    }

    switch (any.type) {
    case SELVA_FIELD_TYPE_NULL:
        memset(&any, 0, sizeof(any));
        break;
    case SELVA_FIELD_TYPE_TIMESTAMP:
    case SELVA_FIELD_TYPE_CREATED:
    case SELVA_FIELD_TYPE_UPDATED:
        memcpy(&any.timestamp, p, sizeof(any.timestamp));
        break;
    case SELVA_FIELD_TYPE_NUMBER:
        memcpy(&any.number, p, sizeof(any.number));
        break;
    case SELVA_FIELD_TYPE_INTEGER:
        memcpy(&any.integer, p, sizeof(any.integer));
        break;
    case SELVA_FIELD_TYPE_INT8:
    case SELVA_FIELD_TYPE_UINT8:
        memcpy(&any.uint8, p, sizeof(any.uint8));
        break;
    case SELVA_FIELD_TYPE_INT16:
    case SELVA_FIELD_TYPE_UINT16:
        memcpy(&any.uint32, p, sizeof(any.uint16));
        break;
    case SELVA_FIELD_TYPE_INT32:
    case SELVA_FIELD_TYPE_UINT32:
        memcpy(&any.uint32, p, sizeof(any.uint32));
        break;
    case SELVA_FIELD_TYPE_INT64:
    case SELVA_FIELD_TYPE_UINT64:
        memcpy(&any.uint64, p, sizeof(any.uint64));
        break;
    case SELVA_FIELD_TYPE_BOOLEAN:
        memcpy(&any.boolean, p, sizeof(any.boolean));
        break;
    case SELVA_FIELD_TYPE_ENUM:
        memcpy(&any.enu, p, sizeof(any.enu));
        break;
    case SELVA_FIELD_TYPE_STRING:
        any.string = p;
        if (!(any.string->flags & SELVA_STRING_STATIC)) {
            any.type = SELVA_FIELD_TYPE_NULL;
        }
        break;
    case SELVA_FIELD_TYPE_TEXT:
        /* Prefer selva_fields_get_text() */
        any.text = p;
        break;
    case SELVA_FIELD_TYPE_REFERENCE:
        do {
            struct SelvaNodeReference *ref = (struct SelvaNodeReference *)p;

            /* Verify proper alignment. */
            assert(((uintptr_t)ref & 7) == 0);
            any.reference = ref;
        } while (0);
        break;
    case SELVA_FIELD_TYPE_REFERENCES:
        do {
            struct SelvaNodeReferences *refs = (struct SelvaNodeReferences *)p;

            /* Verify proper alignment. */
            assert(((uintptr_t)refs & 7) == 0);
            any.references = refs;
        } while (0);
        break;
    case SELVA_FIELD_TYPE_WEAK_REFERENCE:
        memcpy(&any.weak_reference, p, sizeof(struct SelvaNodeWeakReference));
        break;
    case SELVA_FIELD_TYPE_WEAK_REFERENCES:
        memcpy(&any.weak_references, p, sizeof(struct SelvaNodeWeakReferences));
        break;
    case SELVA_FIELD_TYPE_MICRO_BUFFER:
        any.smb = (struct SelvaMicroBuffer *)p;
        break;
    case SELVA_FIELD_TYPE_ALIAS:
        /*
         * This would be easy to support but we also expose the
         * alias API also directly.
         */
        break;
    case SELVA_FIELD_TYPE_ALIASES:
        break;
    }

#if 0
    printf("get field %d type %d\n", field, any.type);
#endif
    return any;
}

struct SelvaFieldsAny selva_fields_get(struct SelvaNode *node, field_t field)
{
    return selva_fields_get2(&node->fields, field);
}

struct SelvaNodeReference *selva_fields_get_reference(struct SelvaNode *node, field_t field)
{
    struct SelvaFieldsAny any;

    any = selva_fields_get(node, field);
    return (any.type == SELVA_FIELD_TYPE_REFERENCE) ? any.reference : NULL;
}

struct SelvaNodeReferences *selva_fields_get_references(struct SelvaNode *node, field_t field)
{
    struct SelvaFieldsAny any;

    any = selva_fields_get(node, field);
    return (any.type == SELVA_FIELD_TYPE_REFERENCES) ? any.references : NULL;
}

struct SelvaNodeWeakReference selva_fields_get_weak_reference(struct SelvaFields *fields, field_t field)
{
    struct SelvaFieldsAny any = selva_fields_get2(fields, field);

    return (any.type == SELVA_FIELD_TYPE_WEAK_REFERENCE) ? any.weak_reference : (struct SelvaNodeWeakReference){};
}

struct SelvaNodeWeakReferences selva_fields_get_weak_references(struct SelvaFields *fields, field_t field)
{
    struct SelvaFieldsAny any = selva_fields_get2(fields, field);

    return (any.type == SELVA_FIELD_TYPE_WEAK_REFERENCES) ? any.weak_references : (struct SelvaNodeWeakReferences){};
}

struct SelvaFieldsPointer selva_fields_get_raw2(struct SelvaFields *fields, struct SelvaFieldSchema *fs)
{
    const struct SelvaFieldInfo *nfo;

    if (fs->field >= fields->nr_fields) {
        return (struct SelvaFieldsPointer){};
    }

    nfo = &fields->fields_map[fs->field];

    switch (nfo->type) {
    case SELVA_FIELD_TYPE_NULL:
        return (struct SelvaFieldsPointer){
            .ptr = (uint8_t *)PTAG_GETP(fields->data),
            .off = (nfo->off << 3),
            .len = 0,
        };
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
    case SELVA_FIELD_TYPE_TEXT:
    case SELVA_FIELD_TYPE_REFERENCE:
    case SELVA_FIELD_TYPE_REFERENCES:
    case SELVA_FIELD_TYPE_WEAK_REFERENCE:
    case SELVA_FIELD_TYPE_WEAK_REFERENCES:
        return (struct SelvaFieldsPointer){
#if 0
            .type = nfo->type,
#endif
            .ptr = (uint8_t *)PTAG_GETP(fields->data),
            .off = (nfo->off << 3),
            .len = selva_fields_get_data_size(fs),
        };
    case SELVA_FIELD_TYPE_STRING:
        do {
            const struct selva_string *s = (const struct selva_string *)((uint8_t *)PTAG_GETP(fields->data) + (nfo->off << 3));
            size_t len;
            const char *str = selva_string_to_str(s, &len);
            return (struct SelvaFieldsPointer){
                .ptr = (uint8_t *)str,
                .off = 0,
                .len = len,
            };
        } while (0);
    case SELVA_FIELD_TYPE_MICRO_BUFFER:
        return (struct SelvaFieldsPointer){
#if 0
            .type = nfo->type,
#endif
            .ptr = (uint8_t *)PTAG_GETP(fields->data),
            .off = (nfo->off << 3) + offsetof(struct SelvaMicroBuffer, data),
            .len = selva_fields_get_data_size(fs) - offsetof(struct SelvaMicroBuffer, data),
        };
    case SELVA_FIELD_TYPE_ALIAS:
    case SELVA_FIELD_TYPE_ALIASES:
        return (struct SelvaFieldsPointer){
            .ptr = NULL,
            .off = 0,
            .len = 0,
        };
    }
    db_panic("Invalid type");
}

struct SelvaFieldsPointer selva_fields_get_raw(struct SelvaNode *node, struct SelvaFieldSchema *fs)
{
    return selva_fields_get_raw2(&node->fields, fs);
}

static void del_field_string(struct SelvaFields *fields, struct SelvaFieldInfo *nfo)
{
    struct selva_string *s = nfo2p(fields, nfo);

    if (s->flags & SELVA_STRING_STATIC) {
        if (s->flags & SELVA_STRING_MUTABLE_FIXED) {
            selva_string_replace(s, NULL, 0);
        } else {
            selva_string_free(s);
            memset(s, 0, sizeof(*s));
        }
    }
}

static int fields_del(struct SelvaDb *db, struct SelvaNode *node, struct SelvaFields *fields, const struct SelvaFieldSchema *fs)
{
    struct SelvaFieldInfo *nfo;

    if (fs->field >= fields->nr_fields) {
        return SELVA_ENOENT;
    }

    nfo = &fields->fields_map[fs->field];

    switch (nfo->type) {
    case SELVA_FIELD_TYPE_NULL:
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
        assert(node);
        remove_reference(db, node, fs, 0);
        break;
    case SELVA_FIELD_TYPE_REFERENCES:
        assert(node);
        remove_references(db, node, fs);
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

int selva_fields_del(struct SelvaDb *db, struct SelvaNode *node, struct SelvaFieldSchema *fs)
{
    struct SelvaFields *fields = &node->fields;

    return fields_del(db, node, fields, fs);
}

static void reference_meta_del(struct SelvaDb *db, const struct EdgeFieldConstraint *efc, struct SelvaNodeReference *ref, field_t field)
{
    struct SelvaFields *fields = ref->meta;
    const struct SelvaFieldSchema *fs;

    if (!fields) {
        return;
    }

    fs = get_fs_by_fields_schema_field(efc->fields_schema, field);
    if (!fs) {
        return;
    }

    fields_del(db, NULL, fields, fs);
}

int selva_fields_del_ref(struct SelvaDb *db, struct SelvaNode *node, field_t field, node_id_t dst_node_id)
{
    struct SelvaTypeEntry *type = selva_get_type_by_node(db, node);
    struct SelvaFieldSchema *fs = selva_get_fs_by_ns_field(&type->ns, field);
    struct SelvaFieldsAny any;

    if (fs->type != SELVA_FIELD_TYPE_REFERENCES) {
        return SELVA_EINTYPE;
    }

    assert(fs);
    any = selva_fields_get2(&node->fields, field);
    if (any.type != SELVA_FIELD_TYPE_REFERENCES || !any.references) {
        return SELVA_ENOENT;
    }

    remove_reference(db, node, fs, dst_node_id);
    return 0;
}

void selva_fields_clear_references(struct SelvaDb *db, struct SelvaNode *node, struct SelvaFieldSchema *fs)
{
    (void)clear_references(db, node, fs);
}

void selva_fields_init(const struct SelvaFieldsSchema *schema, struct SelvaFields *fields)
{
    fields->nr_fields = schema->nr_fields;
    fields->data_len = schema->field_map_template.fixed_data_size;
    fields->data = (fields->data_len > 0) ? selva_calloc(1, fields->data_len) : NULL; /* No need to tag yet. */
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
    for (field_t i = 0; i < fields->nr_fields; i++) {
        fields->fields_map[i] = (struct SelvaFieldInfo){ 0 };
    }

    fields->nr_fields = 0;
    fields->data_len = 0;
    selva_free(PTAG_GETP(fields->data));
    fields->data = NULL;
}

void selva_fields_destroy(struct SelvaDb *db, struct SelvaNode *node)
{
    const field_t nr_fields = node->fields.nr_fields;

    for (field_t field = 0; field < nr_fields; field++) {
        if (node->fields.fields_map[field].type != SELVA_FIELD_TYPE_NULL) {
            int err;

            struct SelvaFieldSchema *fs = selva_get_fs_by_ns_field(&selva_get_type_by_node(db, node)->ns, field);
            if (unlikely(!fs)) {
                db_panic("No field schema found");
            }

            err = selva_fields_del(db, node, fs);
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
        if (fields->fields_map[field].type != SELVA_FIELD_TYPE_NULL) {
            reference_meta_del(db, efc, ref, field);
        }
    }

    destroy_fields(fields);
}

static inline void hash_ref(XXH3_state_t *hash_state, const struct SelvaNodeReference *ref)
{
    XXH3_128bits_update(hash_state, &ref->dst->node_id, sizeof(ref->dst->node_id));
    /* TODO meta */
}

selva_hash128_t selva_fields_hash(const struct SelvaFieldsSchema *schema, const struct SelvaFields *fields)
{
    const field_t nr_fields = schema->nr_fields;
    XXH3_state_t *hash_state = XXH3_createState();

    XXH3_128bits_reset(hash_state);

    for (field_t field = 0; field < nr_fields; field++) {
        const struct SelvaFieldInfo *nfo = &fields->fields_map[field];
        const struct SelvaFieldSchema *fs = &schema->field_schemas[field];
        const void *p = nfo2p(fields, nfo);

        switch (nfo->type) {
        case SELVA_FIELD_TYPE_NULL:
            /* Also NULL must cause a change in the hash. */
            XXH3_128bits_update(hash_state, 0, 1);
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
        case SELVA_FIELD_TYPE_MICRO_BUFFER:
            XXH3_128bits_update(hash_state, p, selva_fields_get_data_size(fs));
            break;
        case SELVA_FIELD_TYPE_TEXT:
            do {
                const struct SelvaTextField *text = p;

                for (size_t i = 0; i < text->len; i++) {
                    uint32_t crc = selva_string_get_crc(&text->tl[i]);
                    XXH3_128bits_update(hash_state, &crc, sizeof(crc));
                }
            } while (0);
            break;
        case SELVA_FIELD_TYPE_REFERENCE:
            hash_ref(hash_state, p);
            break;
        case SELVA_FIELD_TYPE_REFERENCES:
            do {
                const struct SelvaNodeReferences *refs = p;

                for (size_t i = 0; i < refs->nr_refs; i++) {
                    hash_ref(hash_state, &refs->refs[i]);
                }
            } while (0);
            break;
        case SELVA_FIELD_TYPE_WEAK_REFERENCES:
            do {
                const struct SelvaNodeWeakReferences *refs = p;

                XXH3_128bits_update(hash_state, refs->refs, refs->nr_refs * sizeof(*refs->refs));
            } while (0);
            break;
        case SELVA_FIELD_TYPE_STRING:
            do {
                const struct selva_string *s = p;
                uint32_t crc = selva_string_get_crc(s);
                XXH3_128bits_update(hash_state, &crc, sizeof(crc));
            } while (0);
            break;
        case SELVA_FIELD_TYPE_ALIAS:
        case SELVA_FIELD_TYPE_ALIASES:
            /* FIXME Hash alias? */
            fprintf(stderr, "Alias not hashed at field: %d\n", field);
            break;
        }
    }

    XXH128_hash_t res = XXH3_128bits_digest(hash_state);
    XXH3_freeState(hash_state);

    return (selva_hash128_t)res.low64 | (selva_hash128_t)res.high64 << 64;
}
