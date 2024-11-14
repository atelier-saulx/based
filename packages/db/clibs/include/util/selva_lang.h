/*
 * Copyright (c) 2022, 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef SELVA_LANG_H
#define SELVA_LANG_H

#if defined(__APPLE__) && __MACH__
#include <xlocale.h>
#endif
#include <locale.h>
#include <wchar.h>
#include <wctype.h>
#include "cdefs.h"
#include "selva_lang_code.h"

#define SELVA_LANG_NAME_MAX 4ul

struct selva_lang {
    enum selva_lang_code code;
    __nonstring char name[SELVA_LANG_NAME_MAX];
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

locale_t selva_lang_getlocale2(struct selva_langs *langs, enum selva_lang_code lang);

/**
 * Transform a multibyte string.
 * At least the following transforms are supported:
 * - "" none
 * - "toupper"
 * - "tolower"
 * - "tojhira" when lang is "jp"
 * - "tojkata" when lang is "jp"
 */
char *selva_mbstrans(locale_t loc, const char *src, size_t len, wctrans_t trans);

/**
 * Read a symbol from a multibyte string.
 * @param wc symbol read from mbs_str.
 * @returns bytes consumed from mbs_str.
 */
size_t selva_mbstowc(wchar_t *wc, const char *mbs_str, size_t mbs_len, mbstate_t *ps, wctrans_t trans, locale_t loc);

/**
 * Compare two multibyte strings by transforming each character.
 * At least the following transforms are supported:
 * - "" none
 * - "toupper"
 * - "tolower"
 * - "tojhira" when lang is "jp"
 * - "tojkata" when lang is "jp"
 * Unicode normalization and flattening is not supported.
 */
int selva_mbscmp(const char *mbs1_str, size_t mbs1_len, const char *mbs2_str, size_t mbs2_len, wctrans_t trans, locale_t loc);

const char *selva_mbsstrstr(const char *mbs1_str, size_t mbs1_len, const char *mbs2_str, size_t mbs2_len, wctrans_t trans, locale_t loc);

/**
 * Constructs a value of type wctrans_t that describes a LC_CTYPE category of wide character mapping.
 * - "" none
 * - "toupper"
 * - "tolower"
 * - "tojhira" when lang is "jp"
 * - "tojkata" when lang is "jp"
 */
static inline wctrans_t selva_wctrans(const char *class_str, size_t class_len, locale_t loc)
{
    char charclass[16] = {};

    if (likely(class_len < sizeof(charclass))) {
        __builtin_memcpy(charclass, class_str, class_len);
    }

    return wctrans_l(charclass, loc);
}

#endif /* SELVA_LANG_H */
