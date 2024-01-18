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
    apply(ab, ab_GE) \
    apply(aa, aa_DJ) \
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
    apply(zu, zu_ZA)
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
