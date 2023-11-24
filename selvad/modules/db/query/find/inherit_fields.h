/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef _SELVA_INHERIT_FIELDS_H_
#define _SELVA_INHERIT_FIELDS_H_

struct SelvaHierarchy;
struct SelvaObjectAny;
struct selva_server_response_out;
struct selva_string;

/**
 * Inherit a field value for given node_id.
 * @param hierarchy is a pointer to the hierarchy.
 * @param lang an optional lang list.
 * @param node_id is the starting node_id.
 * @param types is a list of types allowed for inherit.
 * @param nr_types is the number of ids in `types`.
 * @param field_name_str is a pointer to the field name.
 * @param field_name_len is the size of `field_name_str`.
 * @param[out] res is used to return the field value.
 */
int Inherit_FieldValue(
        struct SelvaHierarchy *hierarchy,
        struct selva_string *lang,
        const Selva_NodeId node_id,
        const Selva_NodeType *types,
        size_t nr_types,
        const char *field_name_str,
        size_t field_name_len,
        struct SelvaObjectAny *res);

/**
 * Send a field value to the client in the find command format.
 */
int Inherit_SendFieldFind(
        struct selva_server_response_out *resp,
        SelvaHierarchy *hierarchy,
        struct selva_string *lang,
        const struct SelvaHierarchyNode *node,
        struct SelvaObject *obj,
        const char *full_field_str,
        size_t full_field_len,
        const char *field_str,
        size_t field_len);

/**
 * Inherit fields and send them to the client in the find command format.
 * @param hierarchy is a pointer to the hierarchy.
 * @param lang an optional lang list.
 * @param node_id is the starting node_id.
 * @param types_field_names is an array of pointers to field names. Format: `^ty:field`
 * @param Returns the number of fields sent.
 */
void Inherit_SendFields(
        struct selva_server_response_out *resp,
        struct SelvaHierarchy *hierarchy,
        struct selva_string *lang,
        const Selva_NodeId node_id,
        struct selva_string **types_field_names,
        size_t nr_field_names);

#endif /* _SELVA_INHERIT_FIELDS_H_ */
