/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct FindCommand_Args;
struct SVector;
struct SelvaHierarchy;
struct SelvaHierarchyNode;
struct finalizer;
struct selva_server_response_out;
struct selva_string;

struct SelvaNodeSendParam {
    /*
     * Order-by information is needed if the sorting is made in the
     * postprocessing step, i.e. when the args->result SVector isn't
     * sorted.
     */
    enum SelvaResultOrder order; /*!< Result order. */
    const struct selva_string *order_field; /*!< Order by field name; Otherwise NULL. */

    /**
     * Merge strategy.
     * A merge is executed if this field is set to other than MERGE_STRATEGY_NONE.
     */
    enum SelvaMergeStrategy merge_strategy;
    struct selva_string *merge_path;

    /**
     * Field names.
     * If set the callback should return the value of these fields instead of
     * node IDs.
     *
     * fields selected in cmd args:
     * ```
     * {
     *   '0': ['field1', 'field2'],
     *   '1': ['field3', 'field4'],
     * }
     * ```
     *
     * merge && no fields selected in cmd args:
     * {
     * }
     *
     * and the final callback will use this as a scratch space to mark which
     * fields have been already sent.
     */
    struct SelvaObject *fields;

    /**
     * Fields that should be excluded when `fields` contains a wildcard.
     * The list should delimit the excluded fields in the following way:
     * ```
     * field1\nfield2\n
     * ```
     * NULL if not used.
     */
    struct selva_string *excluded_fields;

    /**
     * Field names expression context for `fields_expression`.
     */
    struct rpn_ctx *fields_rpn_ctx;

    /**
     * Field names expression.
     * Another way to select which fields should be returned to the client is
     * using an RPN expression that returns a set on field names.
     * If this is set then fields and excluded_fields should be NULL.
     */
    struct rpn_expression *fields_expression;
};

/**
 * Type of a function to process each node in a query.
 */
typedef int (*SelvaFind_ProcessNode)(
        struct SelvaHierarchy *hierarchy,
        const struct SelvaHierarchyTraversalMetadata *traversal_metadata,
        struct FindCommand_Args *args,
        struct SelvaHierarchyNode *node);
/**
 * Type of a function to process each object in a query when traversing an array of objects.
 */
typedef int (*SelvaFind_ProcessObject)(
        struct FindCommand_Args *args,
        struct SelvaObject *obj);
/**
 * Post processing callback in a query.
 */
typedef void (*SelvaFind_Postprocess)(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct SelvaHierarchy *hierarchy,
        struct selva_string *lang,
        ssize_t offset,
        ssize_t limit,
        struct SelvaNodeSendParam *args,
        struct SVector *result);

struct FindCommand_Args {
    struct finalizer *fin;
    struct selva_server_response_out *resp;
    struct selva_string *lang;

    ssize_t *nr_nodes; /*!< Number of nodes in the result. */
    ssize_t skip; /*!< Start processing from nth node. */
    ssize_t offset; /*!< Start processing from nth node. */
    ssize_t *limit; /*!< Limit the number of result. */

    struct rpn_ctx *rpn_ctx;
    const struct rpn_expression *filter;

    struct SelvaNodeSendParam send_param;

#if 0
    enum SelvaResultOrder order; /*!< Result order. */
#endif
    struct SVector *result; /*!< Results of the find for postprocessing. Wrapped in TraversalOrderItem structs if sorting is requested. */

    struct Selva_SubscriptionMarker *marker; /*!< Used by FindInSub. */

    /* Accounting */
    size_t acc_take; /*!< Numer of nodes selected during the traversal. */
    size_t acc_tot; /*!< Total number of nodes visited during the traversal. */

    /*
     * Process callbacks.
     * While we'll only see either nodes or objects we don't necessarily know
     * which one it will be before we are in query_traverse().
     * E.g. SELVA_HIERARCHY_TRAVERSAL_FIELD makes the decission based on the
     * what is resolved from the given field path.
     */
    SelvaFind_ProcessNode process_node;
    SelvaFind_ProcessObject process_obj;
};

/**
 * See skip in FindCommand_Args.
 */
static inline int find_process_skip(struct FindCommand_Args *args)
{
    const int take = (args->skip > 0) ? !args->skip-- : 1;

    return take;
}

/**
 * See offset in FindCommand_Args.
 */
static inline int find_process_offset(struct FindCommand_Args *args)
{
    const int take = (args->offset > 0) ? !args->offset-- : 1;

    return take;
}

int find_parse_fields(
        struct finalizer *fin,
        const struct selva_string *raw_in,
        struct SelvaObject **fields_out,
        struct selva_string **excluded_fields_out
)
    __attribute__((access(read_only, 2), access(write_only, 3), access(write_only, 4)));

int find_fields_contains(struct SelvaObject *fields, const char *field_name_str, size_t field_name_len)
    __attribute__((access(read_only, 1), access(read_only, 2, 3)));
