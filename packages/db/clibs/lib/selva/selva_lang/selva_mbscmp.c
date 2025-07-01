/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stdio.h>
#include <string.h>
#include "selva/selva_lang.h"

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
        const size_t nbytes1 = selva_mbstowc(&wc1, s1, left1, &ps1, trans, loc);
        const size_t nbytes2 = selva_mbstowc(&wc2, s2, left2, &ps2, trans, loc);

        if (!wc1 && !wc2) {
            return 0;
        }
        const ssize_t diff = wc1 - wc2;
        if (diff) {
            return diff;
        }

        s1 += nbytes1;
        left1 -= nbytes1;
        s2 += nbytes2;
        left2 -= nbytes2;
    }
}
