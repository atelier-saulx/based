/*
 * Copyright (c) 2024-2025 SAULX
 *
 * SPDX-License-Identifier: MIT
 */

#include <stdlib.h>
#include "jemalloc_selva.h"
#include "selva/selva_lang.h"

static locale_t loc;

void setup(void)
{
#if __linux__
    /*
     * This might not be the name of the locale in your system tho.
     * Indeed, the selva locale would be en_US.UTF-8 but it's really hard to
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
    return selva_mbstrans(loc, s, strlen(s), wctrans_l(trs, loc));
}

PU_TEST(test_mbstrans_fi)
{
    loc = newlocale_any((const char *[]){ "fi_FI.utf8", "fi_FI.utf-8", "fi_FI.UTF8", "fi_FI.UTF-8", nullptr });
    if (loc) {
        char *dst;

        dst = trans(loc, "ÖöHhels", "");
        pu_assert_not_nullptr("", dst);
        pu_assert_str_equal("", dst, "ÖöHhels");
        free(dst);

        dst = trans(loc, "ÖöHhels", "tolower");
        pu_assert_not_nullptr("", dst);
        pu_assert_str_equal("", dst, "ööhhels");
        free(dst);

        dst = trans(loc, "ÖöHhels", "toupper");
        pu_assert_not_nullptr("", dst);
        pu_assert_str_equal("", dst, "ÖÖHHELS");
        free(dst);
    }

    return nullptr;
}

PU_TEST(test_mbstrans_tr)
{
    loc = newlocale_any((const char *[]){ "tr_TR.utf8", "tr_TR.utf-8", "tr_TR.UTF8", "tr_TR.UTF-8", nullptr });
    if (loc) {
        char *dst;

        dst = trans(loc, "İstanbul", "");
        pu_assert_not_nullptr("", dst);
        pu_assert_str_equal("", dst, "İstanbul");
        free(dst);

        dst = trans(loc, "İstanbul", "tolower");
        pu_assert_not_nullptr("", dst);
        pu_assert_str_equal("", dst, "istanbul");
        free(dst);

        dst = trans(loc, "İstanbul", "toupper");
        pu_assert_not_nullptr("", dst);
        pu_assert_str_equal("", dst, "İSTANBUL");
        free(dst);

        dst = trans(loc, "İstanbul", "toupper");
        pu_assert_not_nullptr("", dst);
        pu_assert_str_equal("", dst, "İSTANBUL");
        free(dst);
    }

    return nullptr;
}

PU_TEST(test_mbstrans_en)
{
    loc = newlocale_any((const char *[]){ "en_US.utf8", "en_US.utf-8", "en_US.UTF8", "en_US.UTF-8", "en_GB.utf8", "en_GB.utf-8", "en_GB.UTF8", "en_GB.UTF-8", nullptr });
    if (loc) {
        char *dst;

        dst = trans(loc, "İstanbul", "");
        pu_assert_not_nullptr("", dst);
        pu_assert_str_equal("", dst, "İstanbul");
        free(dst);

        dst = trans(loc, "İstanbul", "tolower");
        pu_assert_not_nullptr("", dst);
        pu_assert_str_equal("", dst, "istanbul");
        free(dst);

        dst = trans(loc, "İstanbul", "toupper");
        pu_assert_not_nullptr("", dst);
        pu_assert_str_equal("", dst, "İSTANBUL");
        free(dst);

        dst = trans(loc, "İstanbul", "toupper");
        pu_assert_not_nullptr("", dst);
        pu_assert_str_equal("", dst, "İSTANBUL");
        free(dst);
    }

    return nullptr;
}

PU_TEST(test_mbstrans_jp)
{
    loc = newlocale_any((const char *[]){ "ja_JP.utf8", "ja_JP.utf-8", "ja_JP.UTF8", "ja_JP.UTF-8", nullptr });
    if (loc) {
        char *dst;

        dst = trans(loc, "カタカナ", "");
        pu_assert_not_nullptr("", dst);
        pu_assert_str_equal("", dst, "カタカナ");
        free(dst);

#ifdef __linux__
        dst = trans(loc, "カタカナ", "tojhira");
        pu_assert_not_nullptr("", dst);
        pu_assert_str_equal("", dst, "かたかな");
        free(dst);

        dst = trans(loc, "かたかな", "tojkata");
        pu_assert_not_nullptr("", dst);
        pu_assert_str_equal("", dst, "カタカナ");
        free(dst);
#endif
    }

    return nullptr;
}


PU_TEST(test_mbstrans_ar)
{
    loc = newlocale_any((const char *[]){ "ar_QA.utf8", "ar_QA.utf-8", "ar_QA.UTF8", "ar_QA.UTF-8", nullptr });
    if (loc) {
        char *dst;

        dst = trans(loc, "نَرْقُص.", "");
        pu_assert_not_nullptr("", dst);
        pu_assert_str_equal("", dst, "نَرْقُص.");
        free(dst);

        dst = trans(loc, "نَرْقُص.", "toupper");
        pu_assert_not_nullptr("", dst);
        pu_assert_str_equal("", dst, "نَرْقُص.");
        free(dst);
    }

    return nullptr;
}

static int call_mbscmp(const char *s1, const char *s2, wctrans_t trans, locale_t loc)
{
    return selva_mbscmp(s1, strlen(s1), s2, strlen(s2), trans, loc);
}

static int call_mbsstrstr(const char *s1, const char *s2, wctrans_t trans, locale_t loc)
{
    const char *res = selva_mbsstrstr(s1, strlen(s1), s2, strlen(s2), trans, loc);

    return res ? res - s1 : -1;
}

PU_TEST(test_mbscmp)
{
    setlocale(LC_CTYPE, "fi_FI.utf8");
    setlocale(LC_CTYPE, "fi_FI.UTF-8");
    loc = newlocale_any((const char *[]){ "fi_FI.utf8", "fi_FI.utf-8", "fi_FI.UTF8", "fi_FI.UTF-8", nullptr });
    if (loc) {
        wctrans_t trans = wctrans_l("tolower", loc);
        int res;

        res = call_mbscmp("abc", "abc", trans, loc);
        pu_assert_equal("", res, 0);

        res = call_mbscmp("abcd", "abc", trans, loc);
        pu_assert_equal("", res, 100);

        res = call_mbscmp("ööää", "ööää", trans, loc);
        pu_assert_equal("", res, 0);

        res = call_mbscmp("ööää", "ööäa", trans, loc);
        pu_assert_equal("", res, 131);

        res = call_mbscmp("öÖÄä", "öÖäÄ", trans, loc);
        pu_assert_equal("", res, 0);

        res = call_mbscmp("ka\xcc\x84śī", "k\xc4\x81śī", trans, loc);
        pu_assert_equal("", res, -160); /* RFE Ideally this would be normalized and the result would be 0 */

        freelocale(loc);
        loc = nullptr;
    }

    loc = newlocale_any((const char *[]){ "de_DE.utf8", "de_DE.utf-8", "de_DE.UTF8", "de_DE.UTF-8", nullptr });
    if (loc) {
        wctrans_t trans;
        int res;

        trans = wctrans_l("tolower", loc);
        res = call_mbscmp("straße", "STRASSE", trans, loc);
        pu_assert_equal("", res, 108);

        /* RFE */
        trans = wctrans_l("toupper", loc);
        res = call_mbscmp("straße", "STRASSE", trans, loc);
        pu_assert_equal("", res, 140);

        /*
         * > Traditionally, ⟨ß⟩ did not have a capital form, although some type
         * > designers introduced de facto capitalized variants. In 2017, the
         * > Council for German Orthography officially adopted a capital, ⟨ẞ⟩,
         * > as an acceptable variant in German orthography, ending a long
         * > orthographic debate.
         * - Wikipedia
         *
         * This is not supported by the locale(s) in macOS as of 2024.
         */
#if __linux__
        trans = wctrans_l("tolower", loc);
        res = call_mbscmp("ß", "ẞ", trans, loc);
        pu_assert_equal("if this fails then your locale is probably pre-2017", res, 0);

        trans = wctrans_l("tolower", loc);
        res = call_mbscmp("ß", "ẞ", trans, loc);
        pu_assert_equal("if this fails then your locale is probably pre-2017", res, 0);
#endif

        freelocale(loc);
        loc = nullptr;
    }

    return nullptr;
}

PU_TEST(test_mbsstrstr)
{
    setlocale(LC_CTYPE, "fi_FI.utf8");
    setlocale(LC_CTYPE, "fi_FI.UTF-8");
    loc = newlocale_any((const char *[]){ "fi_FI.utf8", "fi_FI.utf-8", "fi_FI.UTF8", "fi_FI.UTF-8", nullptr });
    if (loc) {
        wctrans_t trans = wctrans_l("tolower", loc);
        int res;

        res = call_mbsstrstr("Linux Lanux", "Lanu", trans, loc);
        pu_assert_equal("", res, 6);

        res = call_mbsstrstr("abcdef", "xyz", trans, loc);
        pu_assert_equal("", res, -1);

        res = call_mbsstrstr("Miroslav Ladislav Vitouš (s. 6. joulukuuta 1947 Prahassa) on tšekkoslovakialainen jazzbasisti. Hän aloitti viulunsoiton kuusivuotiaana, pianonsoiton 10-vuotiaana sekä kontrabassonsoiton neljätoistavuotiaana.", "tšekkoslovakialainen", trans, loc);
        pu_assert_equal("", res, 62);

        res = call_mbsstrstr("Kakka on babylonialaisessa ja akkadilaisessa mytologiassa esiintyvä alempiin jumaliin kuuluva lähettiläsjumala.", "ALEMPI", trans, loc);
        pu_assert_equal("", res, 69);

        res = call_mbsstrstr("The word “aaaloha” is a Hawaiian term that holds deep cultural and spiritual significance.", "aaloha", trans, loc);
        pu_assert_equal("", res, 13);

        res = call_mbsstrstr("abba abbo", "abbo", trans, loc);
        pu_assert_equal("", res, 5);

        freelocale(loc);
        loc = nullptr;
    }

    return nullptr;
}
