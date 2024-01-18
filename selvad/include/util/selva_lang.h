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

#define LANG_NAME_MAX 4ul

struct selva_lang;
struct selva_langs;

struct selva_langs *selva_lang_create(size_t n);

int selva_lang_set_fallback(struct selva_langs *langs, const char *lang_str, size_t lang_len);

int selva_lang_add(struct selva_langs *langs, const char *lang, const char *locale_name);

void selva_lang_foreach(struct selva_langs *langs, void (*cb)(void *ctx, const char *name, locale_t loc), void *ctx);

/**
 * Get locale for a lang string.
 * @param lang_str is a pointer to the language name.
 * @param lang_len is the length of lang_str excluding any possible nul-character(s).
 * @returns a POSIX locale.
 */
locale_t selva_lang_getlocale(struct selva_langs *langs, const char *lang_str, size_t lang_len);

char *mbstrans(locale_t loc, const char *src, size_t len, wctrans_t trans);

#endif /* SELVA_LANG_H */
