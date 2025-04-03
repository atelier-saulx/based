/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <string.h>
#include "selva/selva_lang.h"

const char *selva_mbsstrstr(const char *mbs1_str, size_t mbs1_len, const char *mbs2_str, size_t mbs2_len, wctrans_t trans, locale_t loc)
{
    const char *s1 = mbs1_str;
    size_t left1 = mbs1_len;
    mbstate_t ps1;
    wchar_t wc1;
    size_t nbytes1 = 0;

    memset(&ps1, 0, sizeof(ps1));

    do {
        s1 += nbytes1;
        left1 -= nbytes1;

        if (!selva_mbscmp(s1, min(left1, mbs2_len), mbs2_str, mbs2_len, trans, loc)) {
            return s1;
        }

        wc1 = 0;
        nbytes1 = selva_mbstowc(&wc1, s1, left1, &ps1, trans, loc);
    } while (wc1);

    return nullptr;
}
