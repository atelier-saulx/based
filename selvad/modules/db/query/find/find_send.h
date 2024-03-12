/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct SelvaHierarchy;
struct SelvaHierarchyNode;
struct SelvaObject;
struct finalizer;
struct selva_string;

int find_send_node_fields(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        struct SelvaHierarchy *hierarchy,
        const struct SelvaHierarchyTraversalMetadata *traversal_metadata,
        struct SelvaHierarchyNode *node,
        struct SelvaObject *fields,
        struct selva_string *excluded_fields)
    __attribute__((access(read_only, 3), access(read_only, 5), access(read_only, 7), access(read_only, 8), access(read_only, 10)));

int find_send_array_object_fields(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        struct SelvaObject *obj,
        struct SelvaObject *fields)
    __attribute__((access(read_only, 3), access(read_only, 4), access(read_only, 5)));

int send_node_merge(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        const struct SelvaHierarchyNode *node,
        enum SelvaMergeStrategy merge_strategy,
        struct selva_string *obj_path,
        struct SelvaObject *fields)
    __attribute__((access(read_only, 3), access(read_only, 6), access(read_only, 7)));
