/*
 * Copyright (c) 2022, 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stddef.h>
#if defined(__APPLE__) && __MACH__
#include <xlocale.h>
#endif
#include <locale.h>
#include <wchar.h>
#include <wctype.h>
#include "selva/_export.h"
#include "selva_lang_code.h"

#define SELVA_LANG_NAME_MAX 4ul

struct libdeflate_decompressor;
struct libdeflate_block_state;

SELVA_EXPORT
extern const char selva_lang_all_str[];

SELVA_EXPORT
extern const size_t selva_lang_all_len;

int selva_lang_set_fallback(const char *lang_str, size_t lang_len);

/**
 * Get locale for a lang string.
 * @param lang_str is a pointer to the language name.
 * @param lang_len is the length of lang_str excluding any possible nul-character(s).
 * @returns a POSIX locale.
 */
SELVA_EXPORT
locale_t selva_lang_getlocale(const char *lang_str, size_t lang_len);

SELVA_EXPORT
locale_t selva_lang_getlocale2(enum selva_lang_code lang);

/* TODO rename these */
enum selva_langs_trans {
    SELVA_LANGS_TRANS_NONE = 0,
    SELVA_LANGS_TRANS_TOUPPER,
    SELVA_LANGS_TRANS_TOLOWER,
    SELVA_LANGS_TRANS_TOJHIRA, /*!< When lang is selva_lang_ja. */
    SELVA_LANGS_TRANS_TOJKATA, /*!< When lang is selva_lang_ja. */
};

SELVA_EXPORT
wctrans_t selva_lang_wctrans(enum selva_lang_code lang, enum selva_langs_trans trans);

/**
 * Transform a multibyte string.
 * @returns a selva_malloc'd c-string.
 */
SELVA_EXPORT
char *selva_mbstrans(locale_t loc, const char *src, size_t len, wctrans_t trans);

/**
 * Read a symbol from a multibyte string.
 * @param wc symbol read from mbs_str.
 * @returns bytes consumed from mbs_str.
 */
SELVA_EXPORT
size_t selva_mbstowc(wchar_t *wc, const char *mbs_str, size_t mbs_len, mbstate_t *ps, wctrans_t trans, locale_t loc);

/**
 * Compare two multibyte strings by transforming each character.
 * Unicode normalization and flattening is not supported.
 */
SELVA_EXPORT
int selva_mbscmp(const char *mbs1_str, size_t mbs1_len, const char *mbs2_str, size_t mbs2_len, wctrans_t trans, locale_t loc);

SELVA_EXPORT
int selva_deflate_mbscmp(
        struct libdeflate_decompressor *decompressor,
        struct libdeflate_block_state *state,
        const char *in_buf, size_t in_len,
        const char *mbs2_str, size_t mbs2_len,
        wctrans_t trans, locale_t loc);

SELVA_EXPORT
const char *selva_mbsstrstr(const char *mbs1_str, size_t mbs1_len, const char *mbs2_str, size_t mbs2_len, wctrans_t trans, locale_t loc);

SELVA_EXPORT
bool selva_deflate_mbsstrstr(
        struct libdeflate_decompressor *decompressor,
        struct libdeflate_block_state *state,
        const char *in_buf, size_t in_len,
        const void *needle_buf, size_t needle_len,
        wctrans_t trans, locale_t loc);

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
