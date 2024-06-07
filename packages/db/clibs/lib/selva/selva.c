/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include "selva_error.h"
#include "selva.h"
#include "db.h"
#include "update.h"

static struct SelvaDb *dbs[2];

#define CHECK_DB_ID(id) \
    do { \
        if ((size_t)(id) >= num_elem(dbs) || !dbs[(id)]) { \
            return SELVA_ENOENT; \
        } \
    } while (0)

int selva_db_create(void)
{
    for (size_t i = 0; i < num_elem(dbs); i++) {
        if (!dbs[i]) {
            dbs[i] = db_create();
            return i;
        }
    }

    return SELVA_ENOBUFS;
}

int selva_db_delete(int db_id)
{
    CHECK_DB_ID(db_id);

    db_destroy(dbs[db_id]);
    return 0;
}

int selva_db_schema_update(int db_id, char *schema_buf, size_t schema_len)
{
    CHECK_DB_ID(db_id);

    return db_schema_update(dbs[db_id], schema_buf, schema_len);
}

int selva_db_update(int db_id, node_type_t type, node_id_t node_id, char *buf, size_t len)
{
    CHECK_DB_ID(db_id);
    struct SelvaDb *db = dbs[db_id];
    struct SelvaTypeEntry *te;
    struct SelvaNode *node;

    te = db_get_type_by_index(db, type);
    if (!te) {
        return SELVA_EINTYPE;
    }

    node = db_get_node(db, te, node_id, true);
    assert(node);

    return update(db, te, node, buf, len);
}
