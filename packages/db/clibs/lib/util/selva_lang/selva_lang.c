/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "jemalloc.h"
#include "selva_error.h"
#include "util/selva_lang.h"

static int lang_compare(const struct selva_lang *a, const struct selva_lang *b)
{
    return memcmp(a->name, b->name, SELVA_LANG_NAME_MAX);
}

static int wrap_lang_compare(const void *a, const void *b)
{
    return lang_compare(a, b);
}

void selva_langs_sort(struct selva_langs *langs)
{
    qsort(langs->langs, langs->len, sizeof(struct selva_lang), wrap_lang_compare);
}

static struct selva_lang *find_slang(struct selva_langs *langs, const char *lang_str, size_t lang_len)
{
    struct selva_lang find;

    memset(find.name, '\0', sizeof(find.name));
    memcpy(find.name, lang_str, min(lang_len, sizeof(find.name)));

    return (struct selva_lang *)bsearch(&find, langs->langs, langs->len, sizeof(struct selva_lang), wrap_lang_compare);
}

static int load_lang(struct selva_lang *lang)
{
    char locale_name[40];
    locale_t loc;
    int err;

    assert(!lang->locale);

    snprintf(locale_name, sizeof(locale_name), "%s.UTF-8", lang->loc_name);

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

    lang->locale = loc;
    return 0;
}

int selva_lang_set_fallback(struct selva_langs *langs, const char *lang_str, size_t lang_len)
{
    struct selva_lang *slang = find_slang(langs, lang_str, lang_len);

    if (!slang) {
        return SELVA_ENOENT;
    }

    if (!slang->locale) {
        int err = load_lang(slang);
        if (err) {
            return err;
        }
    }

    langs->fallback = slang->locale;
    return 0;
}

locale_t selva_lang_getlocale(struct selva_langs *langs, const char *lang_str, size_t lang_len)
{
    struct selva_lang *slang = lang_len > 0 ? find_slang(langs, lang_str, lang_len) : NULL;
    if (slang) {
        if (!slang->locale) {
            int err = load_lang(slang);
            if (err) {
                langs->err_cb(slang, err);
                goto fallback;
            }
        }
        return slang->locale;
    } else {
fallback:
        assert(langs->fallback);
        return langs->fallback;
    }
}
