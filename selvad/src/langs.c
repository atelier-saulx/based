/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include "selva_error.h"
#include "selva_log.h"
#include "util/selva_lang.h"
#include "selva_langs.h"
#include "../tunables.h"

struct selva_langs *selva_langs;

#if (__APPLE__)
#define FORALL_LANGS(apply) \
    apply(af, af_ZA) \
    apply(am, am_ET) \
    apply(be, be_BY) \
    apply(bg, bg_BG) \
    apply(ca, ca_ES) \
    apply(cs, cs_CZ) \
    apply(da, da_DK) \
    apply(de, de_DE) \
    apply(el, el_GR) \
    apply(en, en_GB) \
    apply(es, es_ES) \
    apply(et, et_EE) \
    apply(eu, eu_ES) \
    apply(fi, fi_FI) \
    apply(fr, fr_FR) \
    apply(he, he_IL) \
    apply(hr, hr_HR) \
    apply(hu, hu_HU) \
    apply(hy, hy_AM) \
    apply(is, is_IS) \
    apply(it, it_IT) \
    apply(ja, ja_JP) \
    apply(kk, kk_KZ) \
    apply(ko, ko_KR) \
    apply(lt, lt_LT) \
    apply(nl, nl_NL) \
    apply(pl, pl_PL) \
    apply(pt, pt_PT) \
    apply(ro, ro_RO) \
    apply(ru, ru_RU) \
    apply(sk, sk_SK) \
    apply(sl, sl_SI) \
    apply(sv, sv_SE) \
    apply(tr, tr_TR) \
    apply(uk, uk_UA) \
    apply(zh, zh_CN)
#elif (__linux__)
#define FORALL_LANGS(apply) \
    apply(af, af_ZA) \
    apply(am, am_ET) \
    apply(be, be_BY) \
    apply(bg, bg_BG) \
    apply(ca, ca_ES) \
    apply(cs, cs_CZ) \
    apply(da, da_DK) \
    apply(de, de_DE) \
    apply(el, el_GR) \
    apply(en, en_GB) \
    apply(es, es_ES) \
    apply(et, et_EE) \
    apply(eu, eu_ES) \
    apply(fi, fi_FI) \
    apply(fr, fr_FR) \
    apply(gsw, gsw_CH) \
    apply(he, he_IL) \
    apply(hr, hr_HR) \
    apply(hu, hu_HU) \
    apply(hy, hy_AM) \
    apply(is, is_IS) \
    apply(it, it_IT) \
    apply(ja, ja_JP) \
    apply(kk, kk_KZ) \
    apply(ko, ko_KR) \
    apply(lt, lt_LT) \
    apply(nb, nb_NO) \
    apply(nl, nl_NL) \
    apply(nn, nn_NO) \
    apply(pl, pl_PL) \
    apply(pt, pt_PT) \
    apply(ro, ro_RO) \
    apply(ru, ru_RU) \
    apply(sk, sk_SK) \
    apply(sl, sl_SI) \
    apply(sr, sr_RS) \
    apply(sv, sv_SE) \
    apply(tr, tr_TR) \
    apply(uk, uk_UA) \
    apply(zh, zh_CN)
#else
#define FORALL_LANGS(apply) \
    apply(en, en_GB)
#endif

static void load_lang(const char *lang, const char *locale_name) {
    int err;

    err = selva_lang_add(selva_langs, lang, locale_name);
    if (err) {
        SELVA_LOG(SELVA_LOGL_ERR, "Loading locale %s for lang %s failed. err: \"%s\"",
                locale_name, lang,
                selva_strerror(err));
    }
}

#define LOAD_LANG(lang, loc_lang) \
    load_lang(#lang, #loc_lang ".UTF-8");

#define COUNT_LANGS(lang, loc_lang) \
    + 1

int load_langs(void)
{
    selva_langs = selva_lang_create(FORALL_LANGS(COUNT_LANGS));
    FORALL_LANGS(LOAD_LANG)
    return selva_lang_set_fallback(selva_langs, FALLBACK_LANG, sizeof(FALLBACK_LANG) - 1);
}
