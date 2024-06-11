/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include "selva_error.h"
#include "selva.h"
#include "db.h"
#include "update.h"

struct SelvaDb *selva_db_create(void)
{
    return db_create();
}

void selva_db_destroy(struct SelvaDb *db)
{
    db_destroy(db);
}

int selva_db_schema_update(struct SelvaDb *db, const char *schema_buf, size_t schema_len)
{
    return db_schema_update(db, schema_buf, schema_len);
}

int selva_db_update(struct SelvaDb *db, node_type_t type, node_id_t node_id, const char *buf, size_t len)
{
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
