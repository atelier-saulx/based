/*
 * Copyright (c) 2022-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <errno.h>
#include <stdio.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <langinfo.h>
#include "db_panic.h"
#include "jemalloc_selva.h"
#include "selva_error.h"
#include "selva/selva_lang.h"

#define FALLBACK_LANG "en" /* TODO make configurable at runtime */

#if __linux__
#define LOC_ID_SOURCE _NL_IDENTIFICATION_SOURCE
#else
#define LOC_ID_SOURCE CODESET
#endif

#if (__APPLE__)
#define FORALL_LANGS(apply) \
    apply(af, af_ZA) \
    apply(am, am_ET) \
    apply(ar, ar_AE) \
    apply(be, be_BY) \
    apply(bg, bg_BG) \
    apply(ca, ca_ES) \
    apply(cs, cs_CZ) \
    apply(da, da_DK) \
    apply(de, de_DE) \
    apply(gsw, de_CH) \
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
    apply(av, ru_RU) /* TODO missing locale */ \
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
    apply(aa, aa_DJ) \
    apply(ab, ab_GE) \
    apply(af, af_ZA) \
    apply(ak, ak_GH) \
    apply(sq, sq_AL) \
    apply(am, am_ET) \
    apply(ar, ar_AE) \
    apply(an, an_ES) \
    apply(hy, hy_AM) \
    apply(as, as_IN) \
    apply(av, ru_RU) /* TODO missing locale */ \
    apply(ae, gu_IN) /* TODO missing locale */ \
    apply(ay, ayc_PE) \
    apply(az, az_AZ) \
    apply(eu, eu_ES) \
    apply(be, be_BY) \
    apply(bn, bn_BD) \
    apply(bi, bi_VU) \
    apply(bs, bs_BA) \
    apply(br, br_FR) \
    apply(bg, bg_BG) \
    apply(my, my_MM) \
    apply(ca, ca_ES) \
    apply(km, km_KH) \
    apply(ce, ce_RU) \
    apply(zh, zh_CN) \
    apply(cv, cv_RU) \
    apply(kw, kw_GB) \
    apply(co, co_FR) \
    apply(hr, hr_HR) \
    apply(cs, cs_CZ) \
    apply(da, da_DK) \
    apply(dv, dv_MV) \
    apply(nl, nl_NL) \
    apply(dz, dz_BT) \
    apply(en, en_GB) \
    apply(et, et_EE) \
    apply(fo, fo_FO) \
    apply(fi, fi_FI) \
    apply(fr, fr_FR) \
    apply(ff, ff_SN) \
    apply(gd, gd_GB) \
    apply(gl, gl_ES) \
    apply(de, de_DE) \
    apply(gsw, gsw_CH) \
    apply(el, el_GR) \
    apply(kl, kl_GL) \
    apply(gu, gu_IN) \
    apply(ht, ht_HT) \
    apply(ha, ha_NG) \
    apply(he, he_IL) \
    apply(hi, hi_IN) \
    apply(hu, hu_HU) \
    apply(is, is_IS) \
    apply(ig, ig_NG) \
    apply(id, id_ID) \
    apply(ia, ia_FR) \
    apply(iu, iu_CA) \
    apply(ik, ik_CA) \
    apply(ga, ga_IE) \
    apply(it, it_IT) \
    apply(ja, ja_JP) \
    apply(kn, kn_IN) \
    apply(ks, ks_IN) \
    apply(kk, kk_KZ) \
    apply(rw, rw_RW) \
    apply(ko, ko_KR) \
    apply(ku, ku_TR) \
    apply(ky, ky_KG) \
    apply(lo, lo_LA) \
    apply(la, la_VT) \
    apply(lv, lv_LV) \
    apply(lb, lb_LU) \
    apply(li, li_NL) \
    apply(ln, ln_CD) \
    apply(lt, lt_LT) \
    apply(mk, mk_MK) \
    apply(mg, mg_MG) \
    apply(ms, ms_MY) \
    apply(ml, ml_IN) \
    apply(mt, mt_MT) \
    apply(gv, gv_GB) \
    apply(mi, mi_NZ) \
    apply(ro, ro_RO) \
    apply(mn, mn_MN) \
    apply(ne, ne_NP) \
    apply(se, se_NO) \
    apply(no, nb_NO) \
    apply(nb, nb_NO) \
    apply(nn, nn_NO) \
    apply(oc, oc_FR) \
    apply(or, or_IN) \
    apply(om, om_ET) \
    apply(os, os_RU) \
    apply(pa, pa_IN) \
    apply(ps, ps_AF) \
    apply(fa, fa_IR) \
    apply(pl, pl_PL) \
    apply(pt, pt_PT) \
    apply(qu, quz_PE) \
    apply(rm, rm_CH) \
    apply(ru, ru_RU) \
    apply(sm, sm_WS) \
    apply(sa, sa_IN) \
    apply(sc, sc_IT) \
    apply(sr, sr_RS) \
    apply(sd, sd_IN) \
    apply(si, si_LK) \
    apply(sk, sk_SK) \
    apply(sl, sl_SI) \
    apply(so, so_SO) \
    apply(st, st_ZA) \
    apply(nr, nr_ZA) \
    apply(es, es_ES) \
    apply(sw, sw_KE) \
    apply(ss, ss_ZA) \
    apply(sv, sv_SE) \
    apply(tl, tl_PH) \
    apply(tg, tg_TJ) \
    apply(ta, ta_IN) \
    apply(tt, tt_RU) \
    apply(te, te_IN) \
    apply(th, th_TH) \
    apply(bo, bo_CN) \
    apply(ti, ti_ET) \
    apply(to, to_TO) \
    apply(ts, ts_ZA) \
    apply(tn, tn_ZA) \
    apply(tr, tr_TR) \
    apply(tk, tk_TM) \
    apply(ug, ug_CN) \
    apply(uk, uk_UA) \
    apply(ur, ur_PK) \
    apply(uz, uz_UZ) \
    apply(ve, ve_ZA) \
    apply(vi, vi_VN) \
    apply(wa, wa_BE) \
    apply(cy, cy_GB) \
    apply(fy, fy_NL) \
    apply(wo, wo_SN) \
    apply(xh, xh_ZA) \
    apply(yi, yi_US) \
    apply(yo, yo_NG) \
    apply(zu, zu_ZA) \
    apply(ka, ka_GE) \
    apply(cnr, sr_ME) /* TODO missing locale */
#else
#define FORALL_LANGS(apply) \
    apply(en, en_GB)
#endif

#define COUNT_LANGS(lang, loc_lang) \
    + 1

#define LANG_CODE_SZLF(lang, loc_lang) \
    #lang "\n"

#define LANG_ENTRY(lang, loc_lang) \
    [selva_lang_ ## lang] = { \
        .code = selva_lang_ ## lang, \
        .name = #lang, \
        .loc_name = #loc_lang, \
    },

struct selva_lang {
    enum selva_lang_code code;
    __nonstring char name[SELVA_LANG_NAME_MAX];
    const char loc_name[8];
    locale_t locale;
    struct {
        wctrans_t none;
        wctrans_t toupper;
        wctrans_t tolower; /* sutegana/youon support for ja. */
        wctrans_t tojhira;
        wctrans_t tojkata;
    } trans;
};

static void langs_log(const struct selva_lang *lang, int err);

static struct selva_langs {
    size_t len;
    locale_t fallback;
    void (*err_cb)(const struct selva_lang *lang, int err);
    struct selva_lang langs[] __counted_by(len);
} selva_langs = {
    .len = FORALL_LANGS(COUNT_LANGS),
    .err_cb = langs_log,
    .langs = {
        FORALL_LANGS(LANG_ENTRY)
    },
};

const char selva_lang_all_str[] = FORALL_LANGS(LANG_CODE_SZLF);
const size_t selva_lang_all_len = sizeof(selva_lang_all_str) - 1;

static int lang_compare(const struct selva_lang *a, const struct selva_lang *b)
{
    return memcmp(a->name, b->name, SELVA_LANG_NAME_MAX);
}

static int wrap_lang_compare(const void *a, const void *b)
{
    return lang_compare(a, b);
}

static struct selva_lang *find_slang(const char *lang_str, size_t lang_len)
{
    struct selva_lang find;

    memset(find.name, '\0', sizeof(find.name));
    memcpy(find.name, lang_str, min(lang_len, sizeof(find.name)));

    return (struct selva_lang *)bsearch(&find, selva_langs.langs, selva_langs.len, sizeof(struct selva_lang), wrap_lang_compare);
}

static int load_lang(struct selva_lang *lang)
{
    char locale_name[40];
    locale_t loc;
    int err;

    assert(!lang->locale);

    snprintf(locale_name, sizeof(locale_name), "%s.UTF-8", lang->loc_name);

    /*
     * Note: This leaks some memory: https://sourceware.org/bugzilla/show_bug.cgi?id=25770
     */
    loc = newlocale(LC_ALL_MASK, locale_name, 0);
    if (!loc) {
        if (errno == EINVAL) {
            err = SELVA_EINVAL;
        } else if (errno == ENOENT) {
            err = SELVA_ENOENT;
        } else if (errno == ENOMEM) {
            err = SELVA_ENOMEM;
        } else {
            err = SELVA_EGENERAL;
        }

        lang->locale = nullptr;
        return err;
    }

    lang->locale = loc;
    lang->trans.none = wctrans_l("", loc);
    lang->trans.toupper = wctrans_l("toupper", loc);
    lang->trans.tolower = wctrans_l("tolower", loc);
    if (unlikely(lang->code == selva_lang_ja)) {
        lang->trans.tojhira = wctrans_l("tojhira", loc);
        lang->trans.tojkata = wctrans_l("tojkata", loc);
    } else {
        lang->trans.tojhira = wctrans_l("", loc);
        lang->trans.tojkata = wctrans_l("", loc);
    }

    return 0;
}

int selva_lang_set_fallback(const char *lang_str, size_t lang_len)
{
    struct selva_lang *slang = find_slang(lang_str, lang_len);

    if (!slang) {
        return SELVA_ENOENT;
    }

    if (!slang->locale) {
        int err = load_lang(slang);
        if (err) {
            return err;
        }
    }

    selva_langs.fallback = slang->locale;
    return 0;
}

locale_t selva_lang_getlocale(const char *lang_str, size_t lang_len)
{
    struct selva_lang *slang = lang_len > 0 ? find_slang(lang_str, lang_len) : nullptr;
    if (slang) {
        if (!slang->locale) {
            int err = load_lang(slang);
            if (err) {
                selva_langs.err_cb(slang, err);
                goto fallback;
            }
        }

        return slang->locale;
    } else {
fallback:
        assert(selva_langs.fallback);
        return selva_langs.fallback;
    }
}

static struct selva_lang *get_selva_lang(enum selva_lang_code lang)
{
    struct selva_lang *slang = &selva_langs.langs[lang];

    if (!slang->locale) {
        int err = load_lang(slang);
        if (err) {
            selva_langs.err_cb(slang, err);
            return nullptr;
        }
    }

    return slang;
}

locale_t selva_lang_getlocale2(enum selva_lang_code lang)
{
    if (lang < selva_langs.len && selva_langs.langs[lang].code == lang) {
        struct selva_lang *slang = get_selva_lang(lang);

        return slang ? slang->locale : selva_langs.fallback;
    } else {
        assert(selva_langs.fallback);
        return selva_langs.fallback;
    }
}

wctrans_t selva_lang_wctrans(enum selva_lang_code lang, enum selva_langs_trans trans)
{
    struct selva_lang *slang = get_selva_lang(lang);

    switch (trans) {
    case SELVA_LANGS_TRANS_TOUPPER:
        return slang->trans.toupper;
    case SELVA_LANGS_TRANS_TOLOWER:
        return slang->trans.tolower;
    case SELVA_LANGS_TRANS_TOJHIRA:
        return slang->trans.tojhira;
    case SELVA_LANGS_TRANS_TOJKATA:
        return slang->trans.tojkata;
    default:
        return slang->trans.none;
    }
}

static void langs_log(const struct selva_lang *lang, int err)
{
    fprintf(stderr, "Loading locale %s for lang %s failed. err: \"%s\"",
            lang->loc_name, lang->name,
            selva_strerror(err));
}

__unused static void check_selva_c_loc(void)
{
    locale_t loc;

    /*
     * Note: This leaks some memory: https://sourceware.org/bugzilla/show_bug.cgi?id=25770
     */
    loc = newlocale(LC_ALL_MASK, "C.UTF-8", 0);
    if (!loc) {
        int err;

        if (errno == EINVAL) {
            err = SELVA_EINVAL;
        } else if (errno == ENOENT) {
            err = SELVA_ENOENT;
        } else if (errno == ENOMEM) {
            err = SELVA_ENOMEM;
        } else {
            err = SELVA_EGENERAL;
        }

        fprintf(stderr, "WARN: Using system default locales (%s)\n", selva_strerror(err));
        return;
    }

    char *loc_source = nl_langinfo_l(LOC_ID_SOURCE, loc);
    if (strcmp(loc_source, "selva") != 0) {
        fprintf(stderr, "WARN: Using system default locales\n");
    }

    (void)freelocale(loc);
}

__constructor static void load_langs(void)
{
    int err;

#if __linux__
    check_selva_c_loc();
#endif
    qsort(selva_langs.langs, selva_langs.len, sizeof(struct selva_lang), wrap_lang_compare);
    err = selva_lang_set_fallback(FALLBACK_LANG, sizeof(FALLBACK_LANG) - 1);
    if (err) {
        db_panic("Failed to load the fallback locale (%s): %s", FALLBACK_LANG, selva_strerror(err));
    }
}

__destructor static void unload_langs(void)
{
    size_t len = selva_langs.len;

    for (size_t i = 0; i < len; i++) {
        locale_t loc = selva_langs.langs[i].locale;

        if (loc) {
            (void)freelocale(loc);
        }
    }
}
