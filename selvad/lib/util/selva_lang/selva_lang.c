/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <errno.h>
#include <stdlib.h>
#include <string.h>
#include "cdefs.h"
#include "jemalloc.h"
#include "selva_error.h"
#include "util/selva_lang.h"

struct selva_lang {
    __nonstring char name[LANG_NAME_MAX];
    locale_t locale;
};

struct selva_langs {
    uint8_t size;
    uint8_t len;
    locale_t fallback;
    struct selva_lang langs[] __counted_by(len);
};

static int lang_compare(const struct selva_lang *a, const struct selva_lang *b)
{
    return memcmp(a->name, b->name, LANG_NAME_MAX);
}

struct selva_langs *selva_lang_create(size_t n)
{
    struct selva_langs *langs = selva_calloc(1, sizeof(*langs) + n * sizeof(struct selva_lang));

    langs->size = n;

    return langs;
}

static int selva_lang_insert(struct selva_langs *langs, const char *lang, locale_t loc)
{
    ssize_t l = 0;
    ssize_t r = (ssize_t)langs->len - 1;
    struct selva_lang *arr = langs->langs;
    struct selva_lang find;

    strncpy(find.name, lang, LANG_NAME_MAX);

    while (l <= r) {
        ssize_t m = (l + r) / 2;

        assert((ssize_t)m < (ssize_t)langs->len || langs->len == 0);

        const int rc = lang_compare(&find, arr + m);
        if (rc > 0) {
            l = m + 1;
        } else if (rc < 0) {
            r = m - 1;
        } else {
            return SELVA_EEXIST;
        }
    }

    if ((size_t)l >= langs->size) {
        return SELVA_ENOBUFS;
    }

    if (langs->len > 0 && l <= (ssize_t)(langs->len - 1)) {
        memmove(arr + l + 1, arr + l, sizeof(struct selva_lang) * (langs->len - l));
    }
    memcpy(arr[l].name, find.name, LANG_NAME_MAX);
    arr[l].locale = loc;
    langs->len++;

    return 0;
}

int selva_lang_add(struct selva_langs *langs, const char *lang, const char *locale_name)
{
    locale_t loc;
    int err;

    loc = newlocale(LC_ALL_MASK, locale_name, 0);
    if (!loc) {
        if (errno == EINVAL) {
            err = SELVA_EINVAL;
        } else if (errno == ENOENT) {
            err = SELVA_ENOENT;
        } else if (errno == ENOMEM) {
            err = SELVA_ENOMEM;
        } else {
            err = SELVA_EGENERAL;
        }

        return err;
    }

    err = selva_lang_insert(langs, lang, loc);
    if (err) {
        freelocale(loc);
        return err;
    }

    return 0;
}

static int wrap_lang_compare(const void *a, const void *b)
{
    return lang_compare(a, b);
}

static struct selva_lang *find_slang(struct selva_langs *langs, const char *lang_str, size_t lang_len)
{
    struct selva_lang find;

    memset(find.name, '\0', sizeof(find.name));
    memcpy(find.name, lang_str, min(lang_len, sizeof(find.name)));

    return (struct selva_lang *)bsearch(&find, langs->langs, langs->len, sizeof(struct selva_lang), wrap_lang_compare);
}

int selva_lang_set_fallback(struct selva_langs *langs, const char *lang_str, size_t lang_len)
{
    struct selva_lang *slang = find_slang(langs, lang_str, lang_len);

    if (!slang) {
        return SELVA_ENOENT;
    }

    langs->fallback = slang->locale;
    return 0;
}

void selva_lang_foreach(struct selva_langs *langs, void (*cb)(void *ctx, const char *name, locale_t loc), void *ctx)
{
    for (size_t i = 0; i < langs->len; i++) {
        struct selva_lang *slang = &langs->langs[i];
        char name[LANG_NAME_MAX + 1] = {};

        assert(slang->locale);
        memcpy(name, slang->name, sizeof(slang->name));
        cb(ctx, name, slang->locale);
    }
}

locale_t selva_lang_getlocale(struct selva_langs *langs, const char *lang_str, size_t lang_len)
{
    struct selva_lang *slang = lang_len > 0 ? find_slang(langs, lang_str, lang_len) : NULL;
    if (slang) {
        return slang->locale;
    } else {
        assert(langs->fallback);
        return langs->fallback;
    }
}
