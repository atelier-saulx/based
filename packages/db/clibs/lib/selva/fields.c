/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stdio.h> /* TODO REMOVE */
#include <string.h>
#include "jemalloc.h"
#include "util/align.h"
#include "util/ptag.h"
#include "util/selva_string.h"
#include "selva_error.h"
#include "db_panic.h"
#include "db.h"
#include "selva/fields.h"

/**
 * Don't allow mutiple edges from the same field between two nodes.
 * Enabling this will make changing SELVA_FIELD_TYPE_REFERENCES fields extremely
 * slow.
 */
#if 0
#define FIELDS_NO_DUPLICATED_EDGES
#endif

#if 0
#define selva_malloc            malloc
#define selva_calloc            calloc
#define selva_realloc           realloc
#define selva_free              free
#define selva_sallocx(p, v)     0
#endif

static void destroy_fields(struct SelvaFields *fields);
static void reference_meta_create(struct SelvaNodeReference *ref, size_t nr_fields);
static void reference_meta_destroy(struct SelvaNodeReference *ref);

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
    [SELVA_FIELD_TYPE_UINT8] = sizeof(uint8_t),
    [SELVA_FIELD_TYPE_UINT32] = sizeof(uint32_t),
    [SELVA_FIELD_TYPE_UINT64] = sizeof(uint64_t),
    [SELVA_FIELD_TYPE_BOOLEAN] = sizeof(int8_t),
    [SELVA_FIELD_TYPE_ENUM] = sizeof(uint8_t),
    [SELVA_FIELD_TYPE_STRING] = sizeof(struct selva_string),
    [SELVA_FIELD_TYPE_TEXT] = 0, /* TODO */
    [SELVA_FIELD_TYPE_REFERENCE] = sizeof(struct SelvaNodeReference),
    [SELVA_FIELD_TYPE_REFERENCES] = sizeof(struct SelvaNodeReferences),
    [SELVA_FIELD_TYPE_WEAK_REFERENCE] = sizeof(struct SelvaNodeWeakReference),
    [SELVA_FIELD_TYPE_WEAK_REFERENCES] = sizeof(struct SelvaNodeWeakReferences),
    [SELVA_FIELD_TYPE_MICRO_BUFFER] = sizeof(struct SelvaMicroBuffer),
};

size_t selva_fields_get_data_size(const struct SelvaFieldSchema *fs)
{
    const enum SelvaFieldType type = fs->type;

    if (type == SELVA_FIELD_TYPE_STRING) {
        return sizeof(struct selva_string) + SELVA_STRING_STATIC_BUF_SIZE(fs->string.fixed_len);
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

    /* TODO Handle the rare case where we run out of space that can be reprented by data_len */

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

static inline void *nfo2p(struct SelvaFields *fields, const struct SelvaFieldInfo *nfo)
{
    char *data = (char *)PTAG_GETP(fields->data);

    void *p = data + (nfo->off << 3);

    if (unlikely((char *)p > data + fields->data_len)) {
        db_panic("Invalid field data access");
    }

    return p;
}

/**
 * Get a mutable string in fields at fs/nfo.
 */
static struct selva_string *get_mutable_string(struct SelvaFields *fields, const struct SelvaFieldSchema *fs, struct SelvaFieldInfo *nfo, size_t len)
{
    struct selva_string *s = nfo2p(fields, nfo);

    assert(((uintptr_t)s & 7) == 0);
    assert(s);

    if (!(s->flags & SELVA_STRING_STATIC)) { /* Previously initialized. */
        if (fs->string.fixed_len == 0) {
            selva_string_init(s, NULL, len, SELVA_STRING_MUTABLE);
        } else {
            assert(len < fs->string.fixed_len);
            selva_string_init(s, NULL, fs->string.fixed_len, SELVA_STRING_MUTABLE_FIXED);
        }
    }

    return s;
}

static void set_field_string(struct SelvaFields *fields, const struct SelvaFieldSchema *fs, struct SelvaFieldInfo *nfo, const char *str, size_t len)
{
    struct selva_string *s = get_mutable_string(fields, fs, nfo, len);

    (void)selva_string_replace(s, str, len);
}

/**
 * Write a ref to the fields data.
 * Note that this function doesn't touch the destination node.
 */
static int write_ref(struct SelvaNode * restrict node, const struct SelvaFieldSchema *fs, struct SelvaNode * restrict dst)
{
    struct SelvaFields *fields = &node->fields;
    const enum SelvaFieldType type = fs->type;
    const field_t field = fs->field;
    struct SelvaFieldInfo *nfo;

    assert(type == SELVA_FIELD_TYPE_REFERENCE || type == SELVA_FIELD_TYPE_REFERENCES);

    nfo = &fields->fields_map[field];
    if (nfo->type == SELVA_FIELD_TYPE_NULL) {
        size_t field_len = (type == SELVA_FIELD_TYPE_REFERENCE) ? sizeof(struct SelvaNodeReference) : sizeof(struct SelvaNodeReferences);

        *nfo = alloc_block(fields, fs);
        memset(nfo2p(fields, nfo), 0, field_len);
    } else if (nfo->type != type) {
        return SELVA_EINVAL;
    }

    if (type == SELVA_FIELD_TYPE_REFERENCE) {
        struct SelvaNodeReference ref = {
            .dst = dst,
        };
        void *vp = nfo2p(fields, nfo);

        static_assert(offsetof(struct SelvaNodeReference, dst) == 0);
        assert(!memcmp(vp, &(struct SelvaNode *){NULL}, sizeof(struct SelvaNode *)));

        memcpy(vp, &ref, sizeof(ref));
    } else { // type == SELVA_FIELD_TYPE_REFERENCES
        struct SelvaNodeReferences refs;
        void *vp = nfo2p(fields, nfo);

        memcpy(&refs, vp, sizeof(refs));

        /*
         * Get rid of any offset first.
         * If offset > 0 then refs is also allocated.
         */
        if (refs.offset > 0) {
            memmove(refs.refs - refs.offset, refs.refs, refs.nr_refs * sizeof(*refs.refs));
            refs.refs -= refs.offset;
            refs.offset = 0;
        }

        /*
         * Then add the new reference.
         */
        refs.refs = selva_realloc(refs.refs, ++refs.nr_refs * sizeof(*refs.refs));
        refs.refs[refs.nr_refs - 1] = (struct SelvaNodeReference){
            .dst = dst,
        };

        memcpy(vp, &refs, sizeof(refs));
    }

    return 0;
}

static void write_ref_2way(
        struct SelvaNode * restrict src,  const struct SelvaFieldSchema *fs_src,
        struct SelvaNode * restrict dst, const struct SelvaFieldSchema *fs_dst)
{
    int err;

    err = write_ref(src, fs_src, dst);
    if (err) {
        db_panic("Failed to write ref: %s", selva_strerror(err));
    }

    err = write_ref(dst, fs_dst, src);
    if (err) {
        db_panic("Failed to write the inverse reference field: %s", selva_strerror(err));
    }
}

/**
 * Clear single ref value.
 * @returns the original value.
 */
static struct SelvaNode *del_single_ref(struct SelvaFields *fields, struct SelvaFieldInfo *nfo)
{
    void *vp = nfo2p(fields, nfo);
    struct SelvaNodeReference ref;

    memcpy(&ref, vp, sizeof(ref));
    memset(vp, 0, sizeof(struct SelvaNode *));
    reference_meta_destroy(&ref);

    return ref.dst;
}

/**
 * This is only a helper for remove_reference().
 */
static void del_multi_ref(struct SelvaNodeReferences *refs, size_t i)
{
    if (!refs->refs) {
        return;
    }

    reference_meta_destroy(&refs->refs[i]);

    if (i < refs->nr_refs - 1) {
        if (i == 0) {
            /*
             * Head removal can be done by offsetting the pointer.
             */
            refs->offset++;
            refs->refs++;
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

/**
 * Delete a reference field edge.
 * The caller must invalidate pointers in ref if relevant.
 * Clears both ways.
 * @param orig_dst should be given if fs_src is of type SELVA_FIELD_TYPE_REFERENCES.
 */
static void remove_reference(struct SelvaNode *src, const struct SelvaFieldSchema *fs_src, node_id_t orig_dst)
{
    struct SelvaFields *fields_src = &src->fields;
    struct SelvaFieldInfo *nfo_src = &fields_src->fields_map[fs_src->field];
    struct SelvaNode *dst = NULL;

    if (nfo_src->type == SELVA_FIELD_TYPE_REFERENCE) {
        dst = del_single_ref(fields_src, nfo_src);
    } else if (nfo_src->type == SELVA_FIELD_TYPE_REFERENCES) {
        struct SelvaNodeReferences refs;
        struct SelvaNode *tmp;

        memcpy(&refs, nfo2p(fields_src, nfo_src), sizeof(refs));
        for (size_t i = 0; i < refs.nr_refs; i++) {
            tmp = refs.refs[i].dst;
            if (tmp && tmp->node_id == orig_dst) {
                del_multi_ref(&refs, i);
                memcpy(nfo2p(fields_src, nfo_src), &refs, sizeof(refs));
                dst = tmp;
                break;
            }
        }
    }

    /*
     * Clear from the other end.
     */
    if (dst) {
        struct SelvaFields *fields_dst = &dst->fields;
        struct SelvaFieldInfo *nfo_dst;

        assert(fs_src->edge_constraint.inverse_field < fields_dst->nr_fields);
        nfo_dst = &fields_dst->fields_map[fs_src->edge_constraint.inverse_field];

        if (nfo_dst->type == SELVA_FIELD_TYPE_REFERENCE) {
            struct SelvaNode *tmp;

            tmp = del_single_ref(fields_dst, nfo_dst);
            assert(tmp == src);
        } else if (nfo_dst->type == SELVA_FIELD_TYPE_REFERENCES) {
            struct SelvaNodeReferences refs;
            struct SelvaNode *tmp;

            memcpy(&refs, nfo2p(fields_dst, nfo_dst), sizeof(refs));
            for (size_t i = 0; i < refs.nr_refs; i++) {
                tmp = refs.refs[i].dst;
                if (tmp == src) {
                    del_multi_ref(&refs, i);
                    break;
                }
            }
            memcpy(nfo2p(fields_dst, nfo_dst), &refs, sizeof(refs));
        }
    }
}

static void remove_weak_reference(struct SelvaNode *src, const struct SelvaFieldSchema *fs_src, node_id_t orig_dst)
{
    struct SelvaFields *fields = &src->fields;
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

__attribute__((nonnull (1)))
static void remove_references(struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    struct SelvaFieldsAny any;

    any = selva_fields_get2(&node->fields, fs->field);
    if (!(any.type == SELVA_FIELD_TYPE_REFERENCES && any.references)) {
        /* TODO Log error? */
        return;
    }

    while (any.references->nr_refs > 0) {
        /*
         * Deleting the last ref first is faster because a memmove() is not needed.
         */
        node_id_t dst_node_id = any.references->refs[any.references->nr_refs - 1].dst->node_id;

        /*
         * Note that we rely on the fact that the refs pointer doesn't change on delete.
         */
        remove_reference(node, fs, dst_node_id);
    }

    selva_free(any.references->refs - any.references->offset);
}

static void remove_weak_references(struct SelvaNode *node, const struct SelvaFieldSchema *fs)
{
    struct SelvaFields *fields = &node->fields;
    struct SelvaFieldInfo *nfo = &fields->fields_map[fs->field];
    struct SelvaNodeWeakReferences refs;

    memcpy(&refs, nfo2p(fields, nfo), sizeof(refs));

    selva_free(refs.refs - refs.offset);
    memset(nfo, 0, sizeof(refs));
}

/**
 * Set reference to fields.
 */
static int set_reference(struct SelvaDb *db, const struct SelvaFieldSchema *fs_src, struct SelvaNode * restrict src, struct SelvaNode * restrict dst)
{
    struct SelvaTypeEntry *type_dst;
    struct SelvaFieldSchema *fs_dst;

    assert(fs_src->type == SELVA_FIELD_TYPE_REFERENCE);

    if (!dst || src == dst) {
        return SELVA_EINVAL;
    }

    type_dst = selva_get_type_by_node(db, dst);
    if (type_dst->type != fs_src->edge_constraint.dst_node_type) {
        return SELVA_EINTYPE; /* TODO Is this the error we want? */
    }

    fs_dst = selva_get_fs_by_ns_field(&type_dst->ns, fs_src->edge_constraint.inverse_field);
    if (!fs_dst) {
        return SELVA_EINTYPE;
    }

    remove_reference(src, fs_src, 0); /* Remove the previous reference if set. */
#ifdef FIELDS_NO_DUPLICATED_EDGES
    remove_reference(dst, fs_dst, src->node_id);
#else
    if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE) {
        remove_reference(dst, fs_dst, 0);
    }
#endif
    write_ref_2way(src, fs_src, dst, fs_dst);

    return 0;
}

static int set_references(struct SelvaDb *db, const struct SelvaFieldSchema *fs_src, struct SelvaNode * restrict src, struct SelvaNode * restrict dsts[], size_t nr_dsts)
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

        if (dst->type != type_dst) {
            return SELVA_EINTYPE;
        }

#ifdef FIELDS_NO_DUPLICATED_EDGES
        remove_reference(src, fs_src, dst->node_id);
        remove_reference(dst, fs_dst, src->node_id);
#else
        if (fs_dst->type == SELVA_FIELD_TYPE_REFERENCE) {
            remove_reference(dst, fs_dst, 0);
        }
#endif
        write_ref_2way(src, fs_src, dst, fs_dst);
    }

    return 0;
}

static int set_weak_references(const struct SelvaFieldSchema *fs_src, struct SelvaNode * restrict src, struct SelvaNodeWeakReference dsts[], size_t nr_dsts)
{
    struct SelvaFieldInfo *nfo = &src->fields.fields_map[fs_src->field];
    void *vp = nfo2p(&src->fields, nfo);
    struct SelvaNodeWeakReferences refs;

    assert(fs_src->type == SELVA_FIELD_TYPE_WEAK_REFERENCES);

    if (nr_dsts == 0) {
        return 0;
    }

    memcpy(&refs, vp, sizeof(refs));

    /*
     * Get rid of any offset first.
     * If offset > 0 then refs is also allocated.
     */
    if (refs.offset > 0) {
        memmove(refs.refs - refs.offset, refs.refs, refs.nr_refs * sizeof(*refs.refs));
        refs.refs -= refs.offset;
        refs.offset = 0;
    }

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
static int fields_set(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, struct SelvaFields *fields, const void *value, size_t len)
{
    struct SelvaFieldInfo *nfo;
    const enum SelvaFieldType type = fs->type;

    nfo = &fields->fields_map[fs->field];
    if (nfo->type == SELVA_FIELD_TYPE_NULL) {
        *nfo = alloc_block(fields, fs);
    } else if (nfo->type != fs->type) {
        return SELVA_EINVAL;
    }

    switch (type) {
    case SELVA_FIELD_TYPE_NULL:
        break;
    case SELVA_FIELD_TYPE_TIMESTAMP:
    case SELVA_FIELD_TYPE_CREATED:
    case SELVA_FIELD_TYPE_UPDATED:
    case SELVA_FIELD_TYPE_NUMBER:
    case SELVA_FIELD_TYPE_INTEGER:
    case SELVA_FIELD_TYPE_UINT8:
    case SELVA_FIELD_TYPE_UINT32:
    case SELVA_FIELD_TYPE_UINT64:
    case SELVA_FIELD_TYPE_BOOLEAN:
    case SELVA_FIELD_TYPE_ENUM:
        /*
         * Presumable we want to only use weak refs for edge references that can't use
         * the normal refs.
         */
    case SELVA_FIELD_TYPE_WEAK_REFERENCE:
        /* TODO Verify len */
        memcpy(nfo2p(fields, nfo), value, len);
        break;
    case SELVA_FIELD_TYPE_STRING:
        if (fs->string.fixed_len && len > fs->string.fixed_len) {
            return SELVA_ENOBUFS;
        }
        set_field_string(fields, fs, nfo, value, len);
        break;
    case SELVA_FIELD_TYPE_TEXT:
        /* TODO Implement text fields */
        return SELVA_ENOTSUP;
    case SELVA_FIELD_TYPE_REFERENCE:
        assert(db && node);
        if (len < sizeof(struct SelvaNode *)) {
            return SELVA_EINVAL;
        }
        return set_reference(db, fs, node, (struct SelvaNode *)value);
    case SELVA_FIELD_TYPE_REFERENCES:
        if ((len % sizeof(struct SelvaNode **)) != 0) {
            return SELVA_EINVAL;
        }
        return set_references(db, fs, node, (struct SelvaNode **)value, len / sizeof(struct SelvaNode **));
    case SELVA_FIELD_TYPE_WEAK_REFERENCES:
        if ((len % sizeof(struct SelvaNodeWeakReference)) != 0) {
            return SELVA_EINVAL;
        }

        set_weak_references(fs, node, (struct SelvaNodeWeakReference *)value, len / sizeof(struct SelvaNodeWeakReference));
    case SELVA_FIELD_TYPE_MICRO_BUFFER: /* JBOB or MUFFER? */
        do {
            struct SelvaMicroBuffer *buffer = nfo2p(fields, nfo);
            typeof(buffer->len) buf_len = (typeof(buf_len))len;

            memcpy(&buffer->len, &buf_len, sizeof(buffer->len));
            memcpy(buffer->data, value, buf_len);
        } while (0);
    }

    return 0;
}

int selva_fields_set(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, const void *value, size_t len)
{
    // printf("hello! %d len %zu \n", fs->type, len);
    return fields_set(db, node, fs, &node->fields, value, len);
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

    nfo = &fields->fields_map[fs->field];
    if (nfo->type == SELVA_FIELD_TYPE_NULL) {
        *nfo = alloc_block(fields, fs);
    } else if (nfo->type != fs->type) {
        return SELVA_EINVAL;
    }

    *s = get_mutable_string(fields, fs, nfo, len);
    return 0;
}

/**
 * Create meta if it's not initialized yet.
 */
static void ensure_ref_meta(struct SelvaNode *node, struct SelvaNodeReference *ref, struct EdgeFieldConstraint *efc)
{
    const field_t nr_fields = efc->nr_fields;

    if (!ref->meta) {

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

    if (field >= efc->nr_fields) {
        return SELVA_EINVAL;
    } else if (!ref->dst) {
        return SELVA_ENOENT;
    }

    fs = &efc->field_schemas[field];
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
    struct SelvaFieldInfo *nfo;

    if (field >= efc->nr_fields) {
        return SELVA_EINVAL;
    }

    fs = &efc->field_schemas[field];
    if (fs->type != SELVA_FIELD_TYPE_STRING) {
        return SELVA_EINTYPE;
    }

    if (fs->string.fixed_len && len > fs->string.fixed_len) {
        return SELVA_ENOBUFS;
    }

    ensure_ref_meta(node, ref, efc);
    struct SelvaFields *fields = ref->meta;

    nfo = &fields->fields_map[fs->field];
    if (nfo->type == SELVA_FIELD_TYPE_NULL) {
        *nfo = alloc_block(fields, fs);
    } else if (nfo->type != fs->type) {
        return SELVA_EINVAL;
    }

    *s = get_mutable_string(ref->meta, fs, nfo, len);
    return 0;
}

struct SelvaFieldsAny selva_fields_get2(struct SelvaFields *fields, field_t field)
{
    struct SelvaFieldsAny any;
    const struct SelvaFieldInfo *nfo;
    void *p;

    if (field >= fields->nr_fields) {
        any.type = SELVA_FIELD_TYPE_NULL;
    } else {
        nfo = &fields->fields_map[field];
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
    case SELVA_FIELD_TYPE_UINT8:
        memcpy(&any.uint8, p, sizeof(any.uint8));
        break;
    case SELVA_FIELD_TYPE_UINT32:
        memcpy(&any.uint32, p, sizeof(any.uint32));
        break;
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
        /* TODO */
        any.type = SELVA_FIELD_TYPE_NULL;
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
    }

    return any;
}

struct SelvaFieldsAny selva_fields_get(struct SelvaNode *node, field_t field)
{
    return selva_fields_get2(&node->fields, field);
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

static int fields_del(struct SelvaDb *db, struct SelvaNode *node, struct SelvaFields *fields, field_t field)
{
    struct SelvaFieldInfo *nfo;
    struct SelvaFieldSchema *fs = selva_get_fs_by_ns_field(&selva_get_type_by_node(db, node)->ns, field);

    if (field >= fields->nr_fields) {
        return SELVA_ENOENT;
    }

    nfo = &fields->fields_map[field];

    switch (nfo->type) {
    case SELVA_FIELD_TYPE_NULL:
    case SELVA_FIELD_TYPE_TIMESTAMP:
    case SELVA_FIELD_TYPE_CREATED:
    case SELVA_FIELD_TYPE_UPDATED:
    case SELVA_FIELD_TYPE_NUMBER:
    case SELVA_FIELD_TYPE_INTEGER:
    case SELVA_FIELD_TYPE_UINT8:
    case SELVA_FIELD_TYPE_UINT32:
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
        /* TODO Text fields */
        break;
    case SELVA_FIELD_TYPE_REFERENCE:
        remove_reference(node, fs, 0);
        break;
    case SELVA_FIELD_TYPE_REFERENCES:
        remove_references(node, fs);
        break;
    case SELVA_FIELD_TYPE_WEAK_REFERENCE:
        remove_weak_reference(node, fs, 0);
        break;
    case SELVA_FIELD_TYPE_WEAK_REFERENCES:
        remove_weak_references(node, fs);
        break;
    }

    memset(nfo2p(fields, nfo), 0, selva_fields_get_data_size(fs));

    return 0;
}

int selva_fields_del(struct SelvaDb *db, struct SelvaNode *node, field_t field)
{
    struct SelvaFields *fields = &node->fields;

    return fields_del(db, node, fields, field);
}

static int reference_meta_del(struct SelvaNodeReference *ref, field_t field)
{
    struct SelvaFields *fields = ref->meta;

    if (!fields) {
        return SELVA_ENOENT;
    }

    return fields_del(NULL, NULL, fields, field);
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

    remove_reference(node, fs, dst_node_id);
    return 0;
}

void selva_fields_init(const struct SelvaTypeEntry *type, struct SelvaNode *node)
{
    node->fields.nr_fields = type->ns.nr_fields;
    node->fields.data_len = type->field_map_template.fixed_data_size;
    node->fields.data = (node->fields.data_len > 0) ? selva_calloc(1, node->fields.data_len) : NULL; /* No need to tag yet. */
    memcpy(node->fields.fields_map, type->field_map_template.buf, type->field_map_template.len);
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
}

void selva_fields_destroy(struct SelvaDb *db, struct SelvaNode *node)
{
    const field_t nr_fields = node->fields.nr_fields;

    for (field_t field = 0; field < nr_fields; field++) {
        if (node->fields.fields_map[field].type != SELVA_FIELD_TYPE_NULL) {
            int err;

            err = selva_fields_del(db, node, field);
            if (unlikely(err)) {
                db_panic("Failed to remove a field: %s", selva_strerror(err));
            }

        }
    }

    destroy_fields(&node->fields);
}

static void reference_meta_create(struct SelvaNodeReference *ref, size_t nr_fields)
{
    struct SelvaFields *fields = selva_calloc(1, sizeof(*fields) + nr_fields * sizeof(struct SelvaFieldInfo));
    fields->nr_fields = nr_fields;

    share_fields(fields);
    ref->meta = fields;
}

static void reference_meta_destroy(struct SelvaNodeReference *ref)
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
            int err;

            err = reference_meta_del(ref, field);
            if (unlikely(err)) {
                db_panic("Failed to remove a meta fields: %s", selva_strerror(err));
            }
        }
    }

    destroy_fields(fields);
}
