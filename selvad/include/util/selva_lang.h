/*
 * Copyright (c) 2022, 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef SELVA_LANG_H
#define SELVA_LANG_H

#if __APPLE__ && __MACH__
#include <xlocale.h>
#endif
#include <locale.h>
#include <wctype.h>
#include "cdefs.h"

#define LANG_NAME_MAX 4ul

struct selva_lang {
    __nonstring char name[LANG_NAME_MAX];
    const char loc_name[8];
    locale_t locale;
};

struct selva_langs {
    size_t len;
    locale_t fallback;
    void (*err_cb)(const struct selva_lang *lang, int err);
    struct selva_lang langs[] __counted_by(len);
};

/**
 * Sort a selva_langs struct so that it can be used with selva_lang_getlocale().
 */
void selva_langs_sort(struct selva_langs *langs);

int selva_lang_set_fallback(struct selva_langs *langs, const char *lang_str, size_t lang_len);

/**
 * Get locale for a lang string.
 * @param lang_str is a pointer to the language name.
 * @param lang_len is the length of lang_str excluding any possible nul-character(s).
 * @returns a POSIX locale.
 */
locale_t selva_lang_getlocale(struct selva_langs *langs, const char *lang_str, size_t lang_len);

char *mbstrans(locale_t loc, const char *src, size_t len, wctrans_t trans);

#endif /* SELVA_LANG_H */
