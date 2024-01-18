/*
 * Copyright (c) 2024 SAULX
 *
 * SPDX-License-Identifier: MIT
 */

#include <stdlib.h>
#include <punit.h>
#include "jemalloc.h"
#include "util/selva_lang.h"

static locale_t loc;

void setup(void)
{
#if __linux__
    /*
     * This might not be the name of the locale in your system tho.
     * Indeed, the selva locale would be en_US.UTF-8 but it's really hard  to
     * read it here.
     */
    setlocale(LC_CTYPE, "en_US.utf8");
    setlocale(LC_CTYPE, "en_US.UTF-8");
#endif
}

void teardown(void)
{
    if (loc) {
        freelocale(loc);
    }
    /* Haha, not gonna reset the locale for you. */
}

static locale_t newlocale_any(const char *names[])
{
    const char *name;
    locale_t loc = 0;

    while (!loc && (name = *names++)) {
        loc = newlocale(LC_ALL_MASK, name, 0);
    }

    return loc;
}

static char *trans(locale_t loc, const char *s, const char *trs)
{
    return mbstrans(loc, s, strlen(s), wctrans_l(trs, loc));
}

PU_TEST(test_mbstrans_fi)
{
    loc = newlocale_any((const char *[]){ "fi_FI.utf8", "fi_FI.utf-8", "fi_FI.UTF8", "fi_FI.UTF-8", NULL });
    if (loc) {
        char *dst;

        dst = trans(loc, "ÖöHhels", "");
        pu_assert_not_null("", dst);
        pu_assert_str_equal("", dst, "ÖöHhels");
        free(dst);

        dst = trans(loc, "ÖöHhels", "tolower");
        pu_assert_not_null("", dst);
        pu_assert_str_equal("", dst, "ööhhels");
        free(dst);

        dst = trans(loc, "ÖöHhels", "toupper");
        pu_assert_not_null("", dst);
        pu_assert_str_equal("", dst, "ÖÖHHELS");
        free(dst);
    }

    return NULL;
}

PU_TEST(test_mbstrans_tr)
{
    loc = newlocale_any((const char *[]){ "tr_TR.utf8", "tr_TR.utf-8", "tr_TR.UTF8", "tr_TR.UTF-8", NULL });
    if (loc) {
        char *dst;

        dst = trans(loc, "İstanbul", "");
        pu_assert_not_null("", dst);
        pu_assert_str_equal("", dst, "İstanbul");
        free(dst);

        dst = trans(loc, "İstanbul", "tolower");
        pu_assert_not_null("", dst);
        pu_assert_str_equal("", dst, "istanbul");
        free(dst);

        dst = trans(loc, "İstanbul", "toupper");
        pu_assert_not_null("", dst);
        pu_assert_str_equal("", dst, "İSTANBUL");
        free(dst);

        dst = trans(loc, "İstanbul", "toupper");
        pu_assert_not_null("", dst);
        pu_assert_str_equal("", dst, "İSTANBUL");
        free(dst);
    }

    return NULL;
}

PU_TEST(test_mbstrans_en)
{
    loc = newlocale_any((const char *[]){ "en_US.utf8", "en_US.utf-8", "en_US.UTF8", "en_US.UTF-8", "en_GB.utf8", "en_GB.utf-8", "en_GB.UTF8", "en_GB.UTF-8", NULL });
    if (loc) {
        char *dst;

        dst = trans(loc, "İstanbul", "");
        pu_assert_not_null("", dst);
        pu_assert_str_equal("", dst, "İstanbul");
        free(dst);

        dst = trans(loc, "İstanbul", "tolower");
        pu_assert_not_null("", dst);
        pu_assert_str_equal("", dst, "istanbul");
        free(dst);

        dst = trans(loc, "İstanbul", "toupper");
        pu_assert_not_null("", dst);
        pu_assert_str_equal("", dst, "İSTANBUL");
        free(dst);

        dst = trans(loc, "İstanbul", "toupper");
        pu_assert_not_null("", dst);
        pu_assert_str_equal("", dst, "İSTANBUL");
        free(dst);
    }

    return NULL;
}

PU_TEST(test_mbstrans_jp)
{
    loc = newlocale_any((const char *[]){ "ja_JP.utf8", "ja_JP.utf-8", "ja_JP.UTF8", "ja_JP.UTF-8", NULL });
    if (loc) {
        char *dst;

        dst = trans(loc, "カタカナ", "");
        pu_assert_not_null("", dst);
        pu_assert_str_equal("", dst, "カタカナ");
        free(dst);

#ifdef __linux__
        dst = trans(loc, "カタカナ", "tojhira");
        pu_assert_not_null("", dst);
        pu_assert_str_equal("", dst, "かたかな");
        free(dst);

        dst = trans(loc, "かたかな", "tojkata");
        pu_assert_not_null("", dst);
        pu_assert_str_equal("", dst, "カタカナ");
        free(dst);
#endif
    }

    return NULL;
}


PU_TEST(test_mbstrans_ar)
{
    loc = newlocale_any((const char *[]){ "ar_QA.utf8", "ar_QA.utf-8", "ar_QA.UTF8", "ar_QA.UTF-8", NULL });
    if (loc) {
        char *dst;

        dst = trans(loc, "نَرْقُص.", "");
        pu_assert_not_null("", dst);
        pu_assert_str_equal("", dst, "نَرْقُص.");
        free(dst);

        dst = trans(loc, "نَرْقُص.", "toupper");
        pu_assert_not_null("", dst);
        pu_assert_str_equal("", dst, "نَرْقُص.");
        free(dst);
    }

    return NULL;
}
