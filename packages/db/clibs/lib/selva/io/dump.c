#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include "selva_error.h"
#include "selva.h"
#include "../db.h"
#include "../io.h"

static void save_fs(struct SelvaFieldSchema *fs)
{
    /* TODO */
}

static void save_ns(struct SelvaNodeSchema *ns)
{
    for (field_t i = 0; i < ns->nr_fields; i++) {
        save_fs(&ns->field_schemas[i]);
    }
}

static void save_nodes(struct SelvaNodeIndex *nodes)
{
    struct SelvaNode *node;

    RB_FOREACH(node, SelvaNodeIndex, nodes) {
        /* TODO */
    }
}

static void save_aliases(struct SelvaAliases *aliases)
{
    struct SelvaAlias *alias;

    RB_FOREACH(alias, SelvaAliasesByName, &aliases->alias_by_name) {
        /* TODO */
    }
}

static void save_type(struct SelvaTypeEntry *te)
{
    // TODO save_type_code
    save_ns(&te->ns);
    save_nodes(&te->nodes);
    save_aliases(&te->aliases);
}

static void save_types(SVector *types)
{
    struct SVectorIterator it;
    struct SelvaTypeEntry *type;

    SVector_ForeachBegin(&it, types);
    while ((type = vecptr2SelvaTypeEntry(SVector_Foreach(&it)))) {
        save_type(type);
    }
}

static void save_db(struct SelvaDb *db)
{
    save_types(&db->type_list);
    // save_expiring();
}

int io_dump_save_async(struct SelvaDb *db, const char *filename)
{
    pid_t pid;

    pid = fork();
    if (pid == 0) {
        printf("hello world\n");

        save_db(db);

        quick_exit(EXIT_SUCCESS);
    } else if (pid < 0) {
        return SELVA_EGENERAL;
    }

    return 0;
}
