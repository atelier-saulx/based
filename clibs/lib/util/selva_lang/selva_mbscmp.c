/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stdio.h>
#include <string.h>
#include <wchar.h>
#include <wctype.h>
#include <locale.h>
#if defined(__APPLE__)
#include <xlocale.h>
#endif
#include "util/selva_lang.h"

static size_t readsym(wchar_t *wc, const char *mbs_str, size_t mbs_len, mbstate_t *ps, wctrans_t trans, locale_t loc)
{
    wchar_t tmp;
    size_t nbytes;

#if defined(__APPLE__)
    nbytes = mbrtowc_l(&tmp, mbs_str, mbs_len, ps, loc);
#else
    nbytes = mbrtowc(&tmp, mbs_str, mbs_len, ps);
#endif
    if (nbytes == 0 || nbytes == (size_t)-1 || nbytes == (size_t)-2) {
        /* End or Error */
        return 0;
    }

    *wc = towctrans_l(tmp, trans, loc);
    return nbytes;
}

int selva_mbscmp(const char *mbs1_str, size_t mbs1_len, const char *mbs2_str, size_t mbs2_len, wctrans_t trans, locale_t loc)
{
    const char *s1 = mbs1_str;
    const char *s2 = mbs2_str;
    size_t left1 = mbs1_len;
    size_t left2 = mbs2_len;
    mbstate_t ps1, ps2;

    memset(&ps1, 0, sizeof(ps1));
    memset(&ps2, 0, sizeof(ps2));

    while (true) {
        wchar_t wc1 = 0;
        wchar_t wc2 = 0;
        const size_t nbytes1 = readsym(&wc1, s1, left1, &ps1, trans, loc);
        const size_t nbytes2 = readsym(&wc2, s2, left2, &ps2, trans, loc);

        if (!wc1 && !wc2) {
            return 0;
        }
        const ssize_t diff = wc1 - wc2;
        if (diff) {
            return diff;
        }

        s1 += nbytes2;
        left1 -= nbytes1;
        s2 += nbytes2;
        left2 -= nbytes2;
    }
}
