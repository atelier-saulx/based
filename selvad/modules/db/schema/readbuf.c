#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include "endian.h"
#include "selva_error.h"
#include "selva_object.h"
#include "schema.h"

static ssize_t read2obj_eintype(struct SelvaObject *, char *, size_t, const char *, size_t)
{
    return SELVA_EINTYPE;
}

static ssize_t schema_readbuf_timestamp(struct SelvaObject *obj, char * restrict field_name_str, size_t field_name_len, const char * restrict buf, size_t size)
{
    uint64_t ts;
    int err;

    static_assert(sizeof(ts) == 8);
    if (size < sizeof(ts)) {
        return SELVA_EINVAL;
    }

    memcpy(&ts, buf, sizeof(ts));
    err = SelvaObject_SetLongLongStr(obj, field_name_str, field_name_len, letoh(ts));

    return err ?: sizeof(ts);
}

static ssize_t schema_readbuf_number(struct SelvaObject *obj, char * restrict field_name_str, size_t field_name_len, const char * restrict buf, size_t size)
{
    int err;

    if (size < 8) {
        return SELVA_EINVAL;
    }

    err = SelvaObject_SetDoubleStr(obj, field_name_str, field_name_len, ledoubletoh(buf));

    return err ?: 8;
}

static ssize_t schema_readbuf_integer(struct SelvaObject *obj, char * restrict field_name_str, size_t field_name_len, const char * restrict buf, size_t size)
{
    int32_t v;
    int err;

    if (size < sizeof(v)) {
        return SELVA_EINVAL;
    }

    memcpy(&v, buf, sizeof(v));
    err = SelvaObject_SetLongLongStr(obj, field_name_str, field_name_len, letoh(v));

    return err ?: sizeof(v);
}

static ssize_t schema_readbuf_boolean(struct SelvaObject *obj, char * restrict field_name_str, size_t field_name_len, const char * restrict buf, size_t size)
{
    long long v;
    int err;

    if (size < 1) {
        return SELVA_EINVAL;
    }

    v = *buf;
    err = SelvaObject_SetLongLongStr(obj, field_name_str, field_name_len, v);

    return err ?: 1;
}

static ssize_t schema_readbuf_reference(struct SelvaObject *obj, char * restrict field_name_str, size_t field_name_len, const char * restrict buf, size_t size)
{
    if (size < 4) {
        return SELVA_EINVAL;
    }

    return SELVA_ENOTSUP; /* TODO reference */
}

static ssize_t schema_readbuf_string(struct SelvaObject *obj, char * restrict field_name_str, size_t field_name_len, const char * restrict buf, size_t size)
{
    if (size < 8) {
        return SELVA_EINVAL;
    }

    return SELVA_ENOTSUP; /* TODO String */
}

static ssize_t schema_readbuf_references(struct SelvaObject *obj, char * restrict field_name_str, size_t field_name_len, const char * restrict buf, size_t size)
{
    if (size < 8) {
        return SELVA_EINVAL;
    }

    return SELVA_ENOTSUP; /* TODO references */
}

const struct readbuf_types {
    enum schema_type type;
    char name[11];
    ssize_t (*read2obj)(struct SelvaObject *obj, char * restrict field_name_str, size_t field_name_len, const char * restrict buf, size_t size);
} __designated_init schema_types[] = {
    {
        .type = 0,
        .name = "reserved",
        .read2obj = read2obj_eintype,
    },
    {
        .type = SCHEMA_TIMESTAMP,
        .name = "timestamp",
        .read2obj = schema_readbuf_timestamp,
    },
    {
        .type = SCHEMA_CREATED,
        .name = "created",
        .read2obj = schema_readbuf_timestamp,
    },
    {
        .type = SCHEMA_UPDATED,
        .name = "updated",
        .read2obj = schema_readbuf_timestamp,
    },
    {
        .type = SCHEMA_NUMBER,
        .name = "number",
        .read2obj = schema_readbuf_number,
    },
    {
        .type = SCHEMA_INTEGER,
        .name = "integer",
        .read2obj = schema_readbuf_integer,
    },
    {
        .type = SCHEMA_BOOLEAN,
        .name = "boolean",
        .read2obj = schema_readbuf_boolean,
    },
    {
        .type = SCHEMA_REFERENCE,
        .name = "reference",
        .read2obj = schema_readbuf_reference,
    },
    {
        .type = SCHEMA_ENUM,
        .name = "enum",
        .read2obj = schema_readbuf_integer,
    },
    {
        .type = SCHEMA_STRING,
        .name = "string",
        .read2obj = schema_readbuf_string,
    },
    {
        .type = SCHEMA_REFERENCES,
        .name = "references",
        .read2obj = schema_readbuf_references,
    },
};

int schema_readbuf(struct SelvaHierarchyNode *node, const char *buf, size_t size)
{
    size_t left = size;
    while (left) {
        enum schema_type type;
        ssize_t res;

        memcpy(&type, buf, sizeof(type));
        buf++;
        left -= sizeof(type);
        if (!(type > 0 && type < num_elem(schema_types))) {
            return SELVA_EINTYPE;
        }

        res = schema_types[type].read2obj(SelvaHierarchy_GetNodeObject(node), field_name_str, field_name_len, buf, left);
        if (res < 0) {
            return (int)res;
        } else {
            buf += res;
            left -= res;
        }
    }

    return 0;
}
