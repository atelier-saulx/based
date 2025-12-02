# Copyright (c) 2022, 2024-2025 SAULX
# SPDX-License-Identifier: MIT

SUPPORTED_LOCALES := \
	C \
	ab_GE \
	aa_DJ \
	af_ZA \
	ak_GH \
	sq_AL \
	am_ET \
	ar_AE \
	an_ES \
	hy_AM \
	as_IN \
	ayc_PE \
	az_AZ \
	eu_ES \
	be_BY \
	bn_BD \
	bi_VU \
	bs_BA \
	br_FR \
	bg_BG \
	my_MM \
	ca_ES \
	km_KH \
	ce_RU \
	zh_CN \
	cv_RU \
	kw_GB \
	co_FR \
	hr_HR \
	cs_CZ \
	da_DK \
	dv_MV \
	nl_NL \
	dz_BT \
	en_GB \
	et_EE \
	fo_FO \
	fi_FI \
	fr_FR \
	ff_SN \
	gd_GB \
	gl_ES \
	de_DE \
	gsw_CH \
	el_GR \
	kl_GL \
	gu_IN \
	ht_HT \
	ha_NG \
	he_IL \
	hi_IN \
	hu_HU \
	is_IS \
	ig_NG \
	id_ID \
	ia_FR \
	iu_CA \
	ik_CA \
	ga_IE \
	it_IT \
	ja_JP \
	kn_IN \
	ks_IN \
	kk_KZ \
	rw_RW \
	ko_KR \
	ku_TR \
	ky_KG \
	lo_LA \
	la_VT \
	lv_LV \
	lb_LU \
	li_NL \
	ln_CD \
	lt_LT \
	mk_MK \
	mg_MG \
	ms_MY \
	ml_IN \
	mt_MT \
	gv_GB \
	mi_NZ \
	ro_RO \
	mn_MN \
	ne_NP \
	se_NO \
	nn_NO \
	nb_NO \
	oc_FR \
	or_IN \
	om_ET \
	os_RU \
	pa_IN \
	ps_AF \
	fa_IR \
	pl_PL \
	pt_PT \
	quz_PE \
	rm_CH \
	ru_RU \
	sm_WS \
	sa_IN \
	sc_IT \
	sr_RS \
	sd_IN \
	si_LK \
	sk_SK \
	sl_SI \
	so_SO \
	st_ZA \
	nr_ZA \
	es_ES \
	sw_KE \
	ss_ZA \
	sv_SE \
	tl_PH \
	tg_TJ \
	ta_IN \
	tt_RU \
	te_IN \
	th_TH \
	bo_CN \
	ti_ET \
	to_TO \
	ts_ZA \
	tn_ZA \
	tr_TR \
	tk_TM \
	ug_CN \
	uk_UA \
	ur_PK \
	uz_UZ \
	ve_ZA \
	vi_VN \
	wa_BE \
	cy_GB \
	fy_NL \
	wo_SN \
	xh_ZA \
	yi_US \
	yo_NG \
	zu_ZA

LOCPATH ?= ../dist/locale
LOCALES := $(patsubst %,%.UTF-8,$(SUPPORTED_LOCALES))
LOCALE_RES := $(addprefix $(LOCPATH)/,$(LOCALES))

export I18NPATH = ./localedata

all: | .make-prerequisites $(LOCALE_RES)

.make-prerequisites:
	@mkdir -p $(LOCPATH)

$(LOCALE_RES): $(shell find localedata -type f)
	localedef -c --no-archive --no-hard-links -f UTF-8 -i $(subst .UTF-8,,$(notdir $@)) $@

clean:
	$(RM) -r cache
