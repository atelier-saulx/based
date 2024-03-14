/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct SelvaHierarchy;
struct SelvaHierarchySchema;
struct selva_io;

void SelvaHierarchy_DestroySchema(struct SelvaHierarchySchema *schema);
void SelvaHierarchy_SetDefaultSchema(struct SelvaHierarchy *hierarchy);
int SelvaHierarchy_SchemaLoad(struct selva_io *io, int encver, struct SelvaHierarchy *hierarchy);
void SelvaHierarchy_SchemaSave(struct selva_io *io, struct SelvaHierarchy *hierarchy);
