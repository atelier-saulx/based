/*
 * Copyright (c) 2024 SAULX
 *
 * Licensed under the MIT License.
 * https://opensource.org/licenses/MIT
 * SPDX-License-Identifier: MIT
 */

#include <arm_neon.h>
#include <ctype.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>
#include "jemalloc.h"
#include "selva/selva_lang.h"
#include "print_ready.h"
#include "util/timestamp.h"
#include "selva/strsearch.h"

#define LEV_MAX 40

static int32_t min3(int32_t a, int32_t b, int32_t c)
{
    return min(a, min(b, c));
}

static int32_t levenshtein_u8(const char * restrict s, size_t m, const char * restrict t, size_t n)
{
    if (m == 0) return n;
    if (n == 0) return m;
    if (n > LEV_MAX - 1 || m > LEV_MAX - 1) {
        return INT_MAX;
    }

    int32_t v[2][LEV_MAX];
    int32_t *v0 = v[0];
    int32_t *v1 = v[1];

    for (size_t i = 0; i <= n; i++) v0[i] = i;

    for (size_t i = 0; i < m; i++) {
        v1[0] = i + 1;

        for (size_t j = 0; j < n; j++) {
            v1[j + 1] = min3(v0[j + 1] + 1, v1[j] + 1, v0[j] + (s[i] != t[j]));
        }

        int32_t *tmp = v0;
        v0 = v1;
        v1 = tmp;
    }

    return v0[n];
}

static int32_t levenshtein_mbs(locale_t loc, wctrans_t trans, const char * restrict s, size_t m, const wchar_t * restrict t, size_t n)
{
    if (m == 0) return n;
    if (n == 0) return m;
    if (n > LEV_MAX - 1 || m > LEV_MAX - 1) {
        return INT_MAX;
    }

    int32_t v[2][LEV_MAX];
    int32_t *v0 = v[0];
    int32_t *v1 = v[1];
    mbstate_t ps;

    memset(&ps, 0, sizeof(ps));
    for (size_t i = 0; i <= n; i++) v0[i] = i;
    for (size_t i = 0; i < m;) {
        wchar_t wc1;
        const size_t nbytes1 = selva_mbstowc(&wc1, s + i, m - i, &ps, trans, loc);

        v1[0] = i + 1;

        for (size_t j = 0; j < n; j++) {
            v1[j + 1] = min3(v0[j + 1] + 1, v1[j] + 1, v0[j] + (wc1 != t[j]));
        }

        int32_t *tmp = v0;
        v0 = v1;
        v1 = tmp;
        i += nbytes1;
    }

    return v0[n];
}

/*
 * Copyright (c) 2024 SAULX
 * Copyright (c) 2019 Olli Vanhoja <olli.vanhoja@alumni.helsinki.fi>
 * Copyright (c) 2014, 2015 Olli Vanhoja <olli.vanhoja@cs.helsinki.fi>
 * Copyright (c) 1988 Regents of the University of California.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the University nor the names of its contributors
 *    may be used to endorse or promote products derived from this software
 *    without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE REGENTS AND CONTRIBUTORS ``AS IS'' AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED.  IN NO EVENT SHALL THE REGENTS OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
 * OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 * OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
 * SUCH DAMAGE.
 */
static const char * strtok2(const char * s, const char * delim, const char ** lasts)
{
    const char * spanp;
    int c;
    int sc;
    const char * tok;

    /* s may be NULL */
    if (!(delim && lasts) || (s == NULL && (s = *lasts) == NULL)) {
        return NULL;
    }

    /*
     * Skip (span) leading delimiters (s += strspn(s, delim), sort of).
     */
cont:
    c = (int)(*s++);
    for (spanp = delim; (sc = *spanp++) != 0;) {
        if (c == sc) {
            goto cont;
        }
    }

    if (c == 0) {       /* no non-delimiter characters */
        *lasts = NULL;
        return NULL;
    }
    tok = s - 1;

    /*
     * Scan token (scan for delimiters: s += strcspn(s, delim), sort of).
     * Note that delim must have one NUL; we stop if we see that, too.
     */
    for (;;) {
        c = (int)(*s++);
        spanp = delim;
        do {
            if ((sc = *spanp++) == c) {
                if (c == 0) {
                    s = NULL;
                }
                *lasts = s;
                return (tok);
            }
        } while (sc != 0);
    }
    /* NOTREACHED */
}

static size_t make_wneedle(locale_t loc, wctrans_t trans, wchar_t wneedle[const LEV_MAX], const char *needle, size_t needle_len)
{
    mbstate_t ps;
    size_t i = 0, j = 0;

    memset(&ps, 0, sizeof(ps));
    while (i < needle_len) {
        i += selva_mbstowc(wneedle + j++, needle + i, needle_len - i, &ps, trans, loc);
    }
    wneedle[j] = '\0';

    return j;
}

bool strsearch_has(locale_t loc, wctrans_t trans, const char *text, const char *needle, size_t needle_len, int good, int bad)
{
    const char *sep = " \n";
    const char *word;
    const char *brkt;
    int32_t d = INT_MAX;

    if (needle_len > LEV_MAX - 1) {
        return INT_MAX;
    }

    if (!loc) {
        for (word = strtok2(text, sep, &brkt);
             word;
             word = strtok2(NULL, sep, &brkt)) {
            int32_t d2 = levenshtein_u8(word, strcspn(word, sep), needle, needle_len);
            d = min(d, d2);
            if (d <= (int32_t)good) {
                break;
            }
        }
    } else {
        wchar_t wneedle[LEV_MAX];
        size_t wneedle_len = make_wneedle(loc, trans, wneedle, needle, needle_len);

        for (word = strtok2(text, sep, &brkt);
             word;
             word = strtok2(NULL, sep, &brkt)) {
            int32_t d2 = levenshtein_mbs(loc, trans, word, strcspn(word, sep), wneedle, wneedle_len);
            d = min(d, d2);
            if (d <= (int32_t)good) {
                break;
            }
        }
    }

    return d < (int32_t)bad;
}

#if 0
#include <stdio.h>
__constructor static void test(void)
{
    locale_t loc = newlocale(LC_ALL_MASK, "fi_FI", 0);
    wctrans_t trans = wctrans_l("tolower", loc);
    FILE *fp = fopen("test/shared/bible.txt", "r");
    long fsize;

    if (!fp) {
        abort();
    }
    fseek(fp, 0, SEEK_END);
    fsize = ftell(fp);
    fseek(fp, 0, SEEK_SET);
    char *book = malloc(fsize + 1);
    fread(book, fsize, 1, fp);
    fclose(fp);
    book[fsize] = 0;
#if 0
    const char book[] = "Not a very long book really good tho";
#endif

    static const char * const patterns[] = { "fod", "god", "G0d", "good", "GOD", "göd", "thuogh", "eegrergerg", "{{{{{{{{" };
    struct timespec ts_start, ts_end;
    ts_monotime(&ts_start);
    for (size_t i = 0; i < num_elem(patterns); i++) {
        const char *pattern = patterns[i];
        fprintf(stderr, "pattern: %s | ", pattern);
        fprintf(stderr, "%d\n", strsearch_has(loc, trans, book, pattern, strlen(pattern), 1, 3));
    }
    ts_monotime(&ts_end);
    print_ready("search", &ts_start, &ts_end, "");
}
#endif
