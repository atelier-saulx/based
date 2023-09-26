/*
 * Copyright (c) 2022-2023 SAULX
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
        struct selva_string **inherit_fields,
        size_t nr_inherit_fields,
        struct selva_string *excluded_fields);
int find_send_array_object_fields(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        struct SelvaObject *obj,
        struct SelvaObject *fields);
int send_node_merge(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        const struct SelvaHierarchyNode *node,
        enum SelvaMergeStrategy merge_strategy,
        struct selva_string *obj_path,
        struct SelvaObject *fields);
