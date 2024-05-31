/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef _SELVA_SET_H_
#define _SELVA_SET_H_

#include "tree.h"

struct selva_string;

/**
 * Type of SelvaSet.
 */
enum SelvaSetType {
    SELVA_SET_TYPE_STRING = 0,
    SELVA_SET_TYPE_DOUBLE = 1,
    SELVA_SET_TYPE_LONGLONG = 2,
    SELVA_SET_NR_TYPES,
};

struct SelvaObject;

struct SelvaSetElement {
    union {
        struct selva_string *value_string;
        double value_d;
        long long value_ll;
    };
    RB_ENTRY(SelvaSetElement) _entry;
};

RB_HEAD(SelvaSetString, SelvaSetElement);
RB_HEAD(SelvaSetDouble, SelvaSetElement);
RB_HEAD(SelvaSetLongLong, SelvaSetElement);

struct SelvaSet {
    enum SelvaSetType type;
    unsigned int size;
    union {
        struct SelvaSetString head_string;
        struct SelvaSetDouble head_d;
        struct SelvaSetLongLong head_ll;
    };
};

RB_PROTOTYPE(SelvaSetString, SelvaSetElement, _entry, SelvaSet_CompareString)
RB_PROTOTYPE(SelvaSetDouble, SelvaSetElement, _entry, SelvaSet_CompareDouble)
RB_PROTOTYPE(SelvaSetLongLong, SelvaSetElement, _entry, SelvaSet_CompareLongLong)
void SelvaSet_Destroy(struct SelvaSet *head);
void SelvaSet_DestroyElement(struct SelvaSetElement *el);

static inline int SelvaSet_isValidType(enum SelvaSetType type) {
    return type >= 0 && type < SELVA_SET_NR_TYPES;
}

/**
 * Get the number of elements in the SelvaSet.
 */
static inline unsigned int SelvaSet_Size(const struct SelvaSet *set) {
    return set->size;
}

/**
 * Initialize a SelvaSet.
 */
static inline void SelvaSet_Init(struct SelvaSet *set, enum SelvaSetType type) {
    set->type = type;
    set->size = 0;

    switch (type) {
    case SELVA_SET_TYPE_STRING:
        RB_INIT(&set->head_string);
        break;
    case SELVA_SET_TYPE_DOUBLE:
        RB_INIT(&set->head_d);
        break;
    case SELVA_SET_TYPE_LONGLONG:
        RB_INIT(&set->head_ll);
        break;
    default:
        /*
         * This should never happen and there is no sane way to recover from an
         * insanely dumb bug, so it's better to abort and fix the bug rather
         * than actually actively checking for this at runtime.
         *
         * We use __builtin_trap() here to avoid requiring a header file for
         * abort(). Typically we use abort() in places where we are pretty
         * certain that there is an ongoing memory corruption and it would be
         * potentially dangerous to run any clean up or save. In this case
         * it's not as certain as usually but if the caller used
         * SelvaSet_isValidType() before calling this function then we can be
         * quite sure that there is something nasty going on somewhere.
         */
        __builtin_trap();
    }
}

int SelvaSet_AddString(struct SelvaSet *set, struct selva_string *s);
int SelvaSet_AddDouble(struct SelvaSet *set, double d);
int SelvaSet_AddLongLong(struct SelvaSet *set, long long l);
#define SelvaSet_Add(set, x) _Generic((x), \
        struct selva_string *: SelvaSet_AddString, \
        double: SelvaSet_AddDouble, \
        long long: SelvaSet_AddLongLong, \
        )((set), (x))

/**
 * Look for a string equal to s in the SelvaSet set.
 * @returns Returns a pointer to a selva_string stored in set if found;
 *          Otherwise a NULL pointer is returned.
 */
struct selva_string *SelvaSet_FindString(struct SelvaSet *set, struct selva_string *s);

int SelvaSet_HasString(struct SelvaSet *set, struct selva_string *s);
int SelvaSet_HasDouble(struct SelvaSet *set, double d);
int SelvaSet_HasLongLong(struct SelvaSet *set, long long ll);
#define SelvaSet_Has(set, x) _Generic((x), \
        struct selva_string *: SelvaSet_HasString, \
        double: SelvaSet_HasDouble, \
        long long: SelvaSet_HasLongLong, \
        )((set), (x))

struct SelvaSetElement *SelvaSet_RemoveString(struct SelvaSet *set, const struct selva_string *s);
struct SelvaSetElement *SelvaSet_RemoveDouble(struct SelvaSet *set, double d);
struct SelvaSetElement *SelvaSet_RemoveLongLong(struct SelvaSet *set, long long ll);
#define SelvaSet_Remove(set, x) _Generic((x), \
        struct selva_string *: SelvaSet_RemoveString, \
        const struct selva_string *: SelvaSet_RemoveString, \
        double: SelvaSet_RemoveDouble, \
        long long: SelvaSet_RemoveLongLong, \
        )((set), (x))

#define SELVA_SET_STRING_FOREACH(el, set) \
    RB_FOREACH(el, SelvaSetString, &(set)->head_string)

#define SELVA_SET_STRING_FOREACH_SAFE(el, set, tmp) \
    RB_FOREACH_SAFE(el, SelvaSetString, &(set)->head_string, tmp)

#define SELVA_SET_DOUBLE_FOREACH(el, set) \
    RB_FOREACH(el, SelvaSetDouble, &(set)->head_d)

#define SELVA_SET_DOUBLE_FOREACH_SAFE(el, set, tmp) \
    RB_FOREACH_SAFE(el, SelvaSetDouble, &(set)->head_d, tmp)

#define SELVA_SET_LONGLONG_FOREACH(el, set) \
    RB_FOREACH(el, SelvaSetLongLong, &(set)->head_ll)

#define SELVA_SET_LONGLONG_FOREACH_SAFE(el, set, tmp) \
    RB_FOREACH_SAFE(el, SelvaSetLongLong, &(set)->head_ll, tmp)

/**
 * Move elements from src to dst.
 * Only elements that are currently missing from dst are moved.
 * @param res should be an empty set initialized with the right type.
 */
int SelvaSet_Merge(struct SelvaSet *dst, struct SelvaSet *src);

/**
 * Take an union of the given sets.
 * The elements are cloned and selva_strings are duplicated.
 * The last argument of this function must be NULL.
 * @param res should be an empty set initialized with the right type.
 *            `res` must not be a pointer to one of the source sets.
 */
int SelvaSet_Union(struct SelvaSet *res, ...) __sentinel;

#endif /* _SELVA_SET_H_ */
