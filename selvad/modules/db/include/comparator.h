/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef COMPARATOR
#define COMPARATOR

/**
 * Compare two c-strings.
 */
int SelvaSVectorComparator_Cstring(const void ** restrict ap, const void ** restrict bp)
    __attribute__((pure, access(read_only, 1), access(read_only, 2)));

/**
 * Compare two Selva_NodeIds.
 */
int SelvaSVectorComparator_NodeId(const void ** restrict ap, const void ** restrict bp)
    __attribute__((pure, access(read_only, 1), access(read_only, 2)));

/**
 * Compare two selva_strings.
 */
int SelvaSVectorComparator_String(const void ** restrict ap, const void ** restrict bp)
    __attribute__((access(read_only, 1), access(read_only, 2)));

/**
 * Compare two Selva Hierarchy nodes.
 */
int SelvaSVectorComparator_Node(const void ** restrict a, const void ** restrict b)
    __attribute__((access(read_only, 1), access(read_only, 2)));

#endif /* COMPARATOR */
