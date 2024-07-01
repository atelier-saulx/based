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
#include "selva.h"
#include "db.h"
#include "fields.h"

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

const size_t selva_field_data_size[17] = {
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
    [SELVA_FIELD_TYPE_STRING] = sizeof(struct selva_string *),
    [SELVA_FIELD_TYPE_TEXT] = 0, /* TODO */
    [SELVA_FIELD_TYPE_REFERENCE] = sizeof(struct SelvaNodeReference),
    [SELVA_FIELD_TYPE_REFERENCES] = sizeof(struct SelvaNodeReferences),
    [SELVA_FIELD_TYPE_WEAK_REFERENCE] = sizeof(struct SelvaNodeWeakReference),
    [SELVA_FIELD_TYPE_WEAK_REFERENCES] = sizeof(struct SelvaNodeWeakReferences),
};

static struct SelvaFieldInfo alloc_block(struct SelvaFields *fields, enum SelvaFieldType type)
{
    char *data = (char *)PTAG_GETP(fields->data);
    size_t off = fields->data_len;
    size_t new_size = ALIGNED_SIZE(off + selva_field_data_size[type], SELVA_FIELDS_DATA_ALIGN);

    /* TODO Handle the rare case where we run out of space that can be reprented by data_len */

    if (!data || selva_sallocx(data, 0) < new_size) {
        fields->data = PTAG(selva_realloc(data, new_size), PTAG_GETTAG(fields->data));
    }
    fields->data_len = new_size;

    assert((off & 0x7) == 0);
    return (struct SelvaFieldInfo){
        .type = type,
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

static void set_value_string(struct SelvaFields *fields, struct SelvaFieldInfo *nfo, const char *str, size_t len)
{
    struct selva_string *string = selva_string_create(str, len, 0);

    memcpy(nfo2p(fields, nfo), &string, sizeof(struct selva_string *));
}

/**
 * Write a ref to the fields data.
 * Note that this function doesn't touch the destination node.
 * TODO meta
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
        *nfo = alloc_block(fields, type);
        memset(nfo2p(fields, nfo), 0,
               (type == SELVA_FIELD_TYPE_REFERENCE) ? sizeof(struct SelvaNodeReference) : sizeof(struct SelvaNodeReferences));
    } else if (nfo->type != type) {
        return SELVA_EINVAL;
    }

    if (type == SELVA_FIELD_TYPE_REFERENCE) {
        static_assert(offsetof(struct SelvaNodeReference, dst) == 0);
        /* TODO comment out */
        assert(!memcmp(nfo2p(fields, nfo), &(struct SelvaNode *){NULL}, sizeof(struct SelvaNode *)));
        memcpy(nfo2p(fields, nfo), (void *)&dst, sizeof(struct SelvaNode *));
    } else { // type == SELVA_FIELD_TYPE_REFERENCES
        struct SelvaNodeReferences refs;
        void *vp = nfo2p(fields, nfo);

        memcpy(&refs, vp, sizeof(refs));

        if (refs.offset > 0) {
            memmove(refs.refs - refs.offset, refs.refs, refs.nr_refs * sizeof(*refs.refs));
            refs.offset = 0;
        }

        refs.refs = selva_realloc(refs.refs, ++refs.nr_refs * sizeof(*refs.refs));
        refs.refs[refs.nr_refs - 1] = (struct SelvaNodeReference){
            .dst = dst,
        };

        memcpy(vp, &refs, sizeof(refs));
    }

    return 0;
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

    reference_meta_destroy(&ref); /* TODO This should be shared both ways */

    return ref.dst;
}

static void del_multi_ref(struct SelvaNodeReferences *refs, size_t i)
{
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
 * Clears both ways.
 * TODO meta
 * @param orig_dst should be given if fs_src is of type SELVA_FIELD_TYPE_REFERENCES.
 */
static void remove_reference(const struct SelvaFieldSchema *fs_src, struct SelvaNode * restrict src, node_id_t orig_dst)
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
    } else {
        /* Nothing to do. */
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

/**
 * Set reference to fields.
 */
static int set_reference(struct SelvaDb *db, const struct SelvaFieldSchema *fs_src, struct SelvaNode * restrict src, struct SelvaNode * restrict dst)
{
    struct SelvaTypeEntry *type_dst;
    struct SelvaFieldSchema *fs_dst;
    int err;

    if (src == dst) {
        return SELVA_EINVAL;
    }

    type_dst = db_get_type_by_node(db, dst);
    if (type_dst->type != fs_src->edge_constraint.dst_node_type) {
        return SELVA_EINTYPE; /* TODO Is this the error we want? */
    }

    fs_dst = db_get_fs_by_ns_field(&type_dst->ns, fs_src->edge_constraint.inverse_field);
    if (!fs_dst) {
        return SELVA_EINTYPE;
    }

    /*
     * Remove the previous reference if set.
     */
    remove_reference(fs_src, src, 0);

    err = write_ref(src, fs_src, dst);
    if (err) {
        return 0;
    }

    err = write_ref(dst, fs_dst, src);
    if (err) {
        db_panic("Failed");
    }

    return err;
}

/**
 * Set weak reference to fields.
 */
static int set_weak_reference(const struct SelvaFieldSchema *fs, struct SelvaFields *fields, struct SelvaNode * restrict dst)
{
    struct SelvaFieldInfo *nfo;
    struct SelvaNodeWeakReference weak_ref = {
        .dst_type = dst->type,
        .dst_id = dst->node_id,
    };

    nfo = &fields->fields_map[fs->field];
    if (nfo->type == SELVA_FIELD_TYPE_NULL) {
        *nfo = alloc_block(fields, SELVA_FIELD_TYPE_REFERENCE);
    } else if (nfo->type != SELVA_FIELD_TYPE_REFERENCE) {
        return SELVA_EINVAL;
    }

    static_assert(offsetof(struct SelvaNodeReference, dst) == 0);
    memcpy(nfo2p(fields, nfo), &weak_ref, sizeof(weak_ref));
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
        *nfo = alloc_block(fields, type);
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
        memcpy(nfo2p(fields, nfo), value, len);
        break;
    case SELVA_FIELD_TYPE_STRING:
        set_value_string(fields, nfo, value, len);
        break;
    case SELVA_FIELD_TYPE_TEXT:
        /* TODO */
        break;
    case SELVA_FIELD_TYPE_REFERENCE:
        assert(db && node);
        return set_reference(db, fs, node, (struct SelvaNode *)value);
    case SELVA_FIELD_TYPE_REFERENCES:
        /* TODO */
    case SELVA_FIELD_TYPE_WEAK_REFERENCE:
        /*
         * Presumable we want to only use weak refs for edge references that can't use
         * the normal refs.
         */
        return set_weak_reference(fs, fields, (struct SelvaNode *)value);
    case SELVA_FIELD_TYPE_WEAK_REFERENCES:
        /* TODO */
        break;
    }

    return SELVA_ENOTSUP;
}

int selva_fields_set(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, const void *value, size_t len)
{
    return fields_set(db, node, fs, &node->fields, value, len);
}

/**
 * @param fs field schema of the edge meta field.
 */
static int reference_meta_set(struct SelvaNodeReference *ref, struct EdgeFieldConstraint *efc, const struct SelvaFieldSchema *fs, const void *value, size_t len)
{
    if (fs->type == SELVA_FIELD_TYPE_REFERENCE ||
        fs->type == SELVA_FIELD_TYPE_REFERENCES) {
        /*
         * Edge metadata can't contain these types because it would be almost
         * impossible to keep track of the pointers.
         */
        return SELVA_ENOTSUP;
    }

    /*
     * Create meta if it's not initialized yet.
     * TODO How to share this with the other end?
     */
    if (!ref->meta) {
        const field_t nr_fields = efc->nr_fields;
        if (nr_fields == 0 || fs->field > nr_fields) {
            return SELVA_EINVAL;
        }
        reference_meta_create(ref, nr_fields);
    }

    return fields_set(NULL, NULL, fs, ref->meta, value, len);
}

int selva_fields_get(struct SelvaNode *node, field_t field, struct SelvaFieldsAny *any)
{
    struct SelvaFields *fields = &node->fields;
    const struct SelvaFieldInfo *nfo;
    void *p;

    if (field >= fields->nr_fields) {
        return SELVA_ENOENT;
    }

    nfo = &fields->fields_map[field];
    any->type = nfo->type;
    p = nfo2p(fields, nfo);

    switch (nfo->type) {
    case SELVA_FIELD_TYPE_NULL:
        memset(any, 0, sizeof(*any));
        break;
    case SELVA_FIELD_TYPE_TIMESTAMP:
    case SELVA_FIELD_TYPE_CREATED:
    case SELVA_FIELD_TYPE_UPDATED:
        memcpy(&any->timestamp, p, sizeof(any->timestamp));
        break;
    case SELVA_FIELD_TYPE_NUMBER:
        memcpy(&any->number, p, sizeof(any->number));
        break;
    case SELVA_FIELD_TYPE_INTEGER:
        memcpy(&any->integer, p, sizeof(any->integer));
        break;
    case SELVA_FIELD_TYPE_UINT8:
        memcpy(&any->uint8, p, sizeof(any->uint8));
        break;
    case SELVA_FIELD_TYPE_UINT32:
        memcpy(&any->uint32, p, sizeof(any->uint32));
        break;
    case SELVA_FIELD_TYPE_UINT64:
        memcpy(&any->uint64, p, sizeof(any->uint64));
        break;
    case SELVA_FIELD_TYPE_BOOLEAN:
        memcpy(&any->boolean, p, sizeof(any->boolean));
        break;
    case SELVA_FIELD_TYPE_ENUM:
        memcpy(&any->enu, p, sizeof(any->enu));
        break;
    case SELVA_FIELD_TYPE_STRING:
        memcpy(&any->string, p, sizeof(struct selva_string *));
        if (!any->string) {
            any->type = SELVA_FIELD_TYPE_NULL;
        }
        break;
    case SELVA_FIELD_TYPE_TEXT:
    case SELVA_FIELD_TYPE_REFERENCE:
        do {
            struct SelvaNodeReference *ref = (struct SelvaNodeReference *)p;

            assert(((uintptr_t)ref & 7) == 0);
            any->reference = ref;
        } while (0);
        break;
    case SELVA_FIELD_TYPE_REFERENCES:
        do {
            struct SelvaNodeReferences *refs = (struct SelvaNodeReferences *)p;

            assert(((uintptr_t)refs & 7) == 0);
            any->references = refs;
        } while (0);
        break;
    case SELVA_FIELD_TYPE_WEAK_REFERENCE:
    case SELVA_FIELD_TYPE_WEAK_REFERENCES:
        /* TODO */
        return SELVA_ENOTSUP;
    }

    return 0;
}

static int reference_meta_get(struct SelvaNodeReference *ref, field_t field, struct SelvaFieldsAny *any)
{
    struct SelvaFields *fields = ref->meta;
    const struct SelvaFieldInfo *nfo;
    void *p;

    if (!fields || field >= fields->nr_fields) {
        return SELVA_ENOENT;
    }

    nfo = &fields->fields_map[field];
    any->type = nfo->type;
    p = nfo2p(fields, nfo);

    switch (nfo->type) {
    case SELVA_FIELD_TYPE_NULL:
        memset(any, 0, sizeof(*any));
        break;
    case SELVA_FIELD_TYPE_TIMESTAMP:
    case SELVA_FIELD_TYPE_CREATED:
    case SELVA_FIELD_TYPE_UPDATED:
        memcpy(&any->timestamp, p, sizeof(any->timestamp));
        break;
    case SELVA_FIELD_TYPE_NUMBER:
        memcpy(&any->number, p, sizeof(any->number));
        break;
    case SELVA_FIELD_TYPE_INTEGER:
        memcpy(&any->integer, p, sizeof(any->integer));
        break;
    case SELVA_FIELD_TYPE_UINT8:
        memcpy(&any->uint8, p, sizeof(any->uint8));
        break;
    case SELVA_FIELD_TYPE_UINT32:
        memcpy(&any->uint32, p, sizeof(any->uint32));
        break;
    case SELVA_FIELD_TYPE_UINT64:
        memcpy(&any->uint64, p, sizeof(any->uint64));
        break;
    case SELVA_FIELD_TYPE_BOOLEAN:
        memcpy(&any->boolean, p, sizeof(any->boolean));
        break;
    case SELVA_FIELD_TYPE_ENUM:
        memcpy(&any->enu, p, sizeof(any->enu));
        break;
    case SELVA_FIELD_TYPE_STRING:
        memcpy(&any->string, p, sizeof(struct selva_string *));
        if (!any->string) {
            any->type = SELVA_FIELD_TYPE_NULL;
        }
        break;
    case SELVA_FIELD_TYPE_TEXT:
        /* TODO */
    case SELVA_FIELD_TYPE_REFERENCE:
        /* TODO */
    case SELVA_FIELD_TYPE_REFERENCES:
        /* TODO */
    case SELVA_FIELD_TYPE_WEAK_REFERENCE:
        /* TODO */
    case SELVA_FIELD_TYPE_WEAK_REFERENCES:
        /* TODO */
        break;
    }

    return 0;
}

static void del_field_string(struct SelvaFields *fields, struct SelvaFieldInfo *nfo)
{
    struct selva_string *s;

    memcpy(&s, nfo2p(fields, nfo), sizeof(struct selva_string *));
    selva_string_free(s);
}

int selva_fields_del(struct SelvaDb *db, struct SelvaNode *node, field_t field)
{
    struct SelvaFields *fields = &node->fields;
    struct SelvaFieldInfo *nfo;

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
        /* NOP */
        break;
    case SELVA_FIELD_TYPE_STRING:
        del_field_string(fields, nfo);
        break;
    case SELVA_FIELD_TYPE_TEXT:
        /* TODO */
        break;
    case SELVA_FIELD_TYPE_REFERENCE:
        do {
            struct SelvaTypeEntry *type = db_get_type_by_node(db, node);
            struct SelvaFieldSchema *fs = db_get_fs_by_ns_field(&type->ns, field);

            remove_reference(fs, node, 0);
        } while (0);
        break;
    case SELVA_FIELD_TYPE_REFERENCES:
        do {
            struct SelvaTypeEntry *type = db_get_type_by_node(db, node);
            struct SelvaFieldSchema *fs = db_get_fs_by_ns_field(&type->ns, field);
            struct SelvaFieldsAny any;
            int err;

            assert(fs);
            err = selva_fields_get(node, field, &any);
            if (err || !any.references) {
                return err;
            }

            while (any.references->nr_refs > 0) {
                /*
                 * Deleting the last ref first is faster because a memmove() is not needed.
                 */
                node_id_t dst_node_id = any.references->refs[any.references->nr_refs - 1].dst->node_id;

                remove_reference(fs, node, dst_node_id);
            }

            selva_free(any.references->refs - any.references->offset);
        } while (0);
        break;
    case SELVA_FIELD_TYPE_WEAK_REFERENCE:
        /* TODO */
    case SELVA_FIELD_TYPE_WEAK_REFERENCES:
        /* TODO */
        break;
    }

    /* TODO Should a main string field always have a string? */
    memset(nfo2p(fields, nfo), 0, selva_field_data_size[field]);

    return 0;
}

static int reference_meta_del(struct SelvaNodeReference *ref, field_t field)
{
    struct SelvaFields *fields = ref->meta;
    struct SelvaFieldInfo *nfo;

    assert(fields);

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
        /* NOP */
        break;
    case SELVA_FIELD_TYPE_STRING:
        del_field_string(fields, nfo);
        break;
    case SELVA_FIELD_TYPE_TEXT:
        /* TODO */
        break;
    case SELVA_FIELD_TYPE_REFERENCE:
        /* TODO */
        break;
    case SELVA_FIELD_TYPE_REFERENCES:
        /* TODO */
        break;
    case SELVA_FIELD_TYPE_WEAK_REFERENCE:
    case SELVA_FIELD_TYPE_WEAK_REFERENCES:
        /* TODO */
        break;
    }

    memset(nfo2p(fields, nfo), 0, selva_field_data_size[field]);

    return 0;
}

int selva_fields_del_ref(struct SelvaDb *db, struct SelvaNode * restrict node, field_t field, node_id_t dst_node_id)
{
    struct SelvaTypeEntry *type = db_get_type_by_node(db, node);
    struct SelvaFieldSchema *fs = db_get_fs_by_ns_field(&type->ns, field);
    struct SelvaFieldsAny any;
    int err;

    if (fs->type != SELVA_FIELD_TYPE_REFERENCES) {
        return SELVA_EINTYPE;
    }

    assert(fs);
    err = selva_fields_get(node, field, &any);
    if (err || any.type != SELVA_FIELD_TYPE_REFERENCES || !any.references) {
        return err;
    }

    remove_reference(fs, node, dst_node_id);
    return 0;
}

void selva_fields_init(const struct SelvaTypeEntry *type, struct SelvaNode * restrict node)
{
    node->fields.nr_fields = type->ns.nr_fields;
    node->fields.data_len = type->field_map_template.main_data_size;
    node->fields.data = (node->fields.data_len > 0) ? selva_calloc(1, node->fields.data_len) : NULL; /* No need to tag yet. */
    memcpy(node->fields.fields_map, type->field_map_template.buf, type->field_map_template.len);
}

static void share_fields(struct SelvaFields *fields)
{
    void *data = fields->data;

    if (PTAG_GETTAG(data)) {
        db_panic("fields is already shared");
    }

    fields->data = PTAG(data, 1);
}

static void destroy_fields(struct SelvaFields *fields)
{
    void *data = PTAG_GETP(fields->data);

    /*
     * If data is marked as shared we unshare it now and return immediately.
     */
    if (PTAG_GETTAG(fields->data)) {
        fields->data = PTAG(data, 0);
        return;
    }

    /*
     * Clear fields map.
     */
    for (field_t i = 0; i < fields->nr_fields; i++) {
        fields->fields_map[i] = (struct SelvaFieldInfo){ 0 };
    }

    fields->nr_fields = 0;
    fields->data_len = 0;
    selva_free(data);
}

void selva_fields_destroy(struct SelvaDb *db, struct SelvaNode * restrict node)
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

    ref->meta = fields;
}

static void reference_meta_destroy(struct SelvaNodeReference *ref)
{
    if (!ref->meta) {
        return;
    }

    struct SelvaFields *fields = ref->meta;
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
