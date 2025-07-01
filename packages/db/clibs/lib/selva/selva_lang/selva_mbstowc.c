/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <string.h>
#include "selva/selva_lang.h"

size_t selva_mbstowc(wchar_t *wc, const char *mbs_str, size_t mbs_len, mbstate_t *ps, wctrans_t trans, locale_t loc)
{
    wchar_t tmp;
    size_t nbytes;

    if (mbs_len == 0) {
        return 0;
    }

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
