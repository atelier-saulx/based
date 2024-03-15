/*
 * Copyright (c) 2023-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stdint.h>

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wmultichar"
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wmultichar"
enum data_record_type {
	/* Fixed size */
	DATA_RECORD_int8 = htobe16('a\0'),
	DATA_RECORD_int16_be = htobe16('b\0'),
	DATA_RECORD_int16_le = htobe16('c\0'),
	DATA_RECORD_int32_be = htobe16('d\0'),
	DATA_RECORD_int32_le = htobe16('e\0'),
	DATA_RECORD_int64_be = htobe16('f\0'),
	DATA_RECORD_int64_le = htobe16('g\0'),
	DATA_RECORD_uint8 = htobe16('h\0'),
	DATA_RECORD_uint16_be = htobe16('i\0'),
	DATA_RECORD_uint16_le = htobe16('j\0'),
	DATA_RECORD_uint32_be = htobe16('k\0'),
	DATA_RECORD_uint32_le = htobe16('l\0'),
	DATA_RECORD_uint64_be = htobe16('m\0'),
	DATA_RECORD_uint64_le = htobe16('n\0'),
	DATA_RECORD_float_be = htobe16('o\0'),
	DATA_RECORD_float_le = htobe16('p\0'),
	DATA_RECORD_double_be = htobe16('q\0'),
	DATA_RECORD_double_le = htobe16('r\0'),
	/* Variable size */
	DATA_RECORD_int_be = htobe16('s\0'),
	DATA_RECORD_int_le = htobe16('t\0'),
	DATA_RECORD_uint_be = htobe16('u\0'),
	DATA_RECORD_uint_le = htobe16('v\0'),
	DATA_RECORD_cstring = htobe16('w\0'),
	/* Virtual */
	DATA_RECORD_record = htobe16('z\0'),
	/* Pointer types */
	DATA_RECORD_int8_p = htobe16('pa'),
	DATA_RECORD_int16_be_p = htobe16('pb'),
	DATA_RECORD_int16_le_p = htobe16('pc'),
	DATA_RECORD_int32_be_p = htobe16('pd'),
	DATA_RECORD_int32_le_p = htobe16('pe'),
	DATA_RECORD_int64_be_p = htobe16('pf'),
	DATA_RECORD_int64_le_p = htobe16('pg'),
	DATA_RECORD_uint8_p = htobe16('ph'),
	DATA_RECORD_uint16_be_p = htobe16('pi'),
	DATA_RECORD_uint16_le_p = htobe16('pj'),
	DATA_RECORD_uint32_be_p = htobe16('pk'),
	DATA_RECORD_uint32_le_p = htobe16('pl'),
	DATA_RECORD_uint64_be_p = htobe16('pm'),
	DATA_RECORD_uint64_le_p = htobe16('pn'),
	DATA_RECORD_float_be_p = htobe16('po'),
	DATA_RECORD_float_le_p = htobe16('pp'),
	DATA_RECORD_double_be_p = htobe16('pq'),
	DATA_RECORD_double_le_p = htobe16('pr'),
	/* Variable size pointer types */
	DATA_RECORD_cstring_p = htobe16('pw'),
	DATA_RECORD_record_p = htobe16('pz'),
};
#pragma clang diagnostic pop
#pragma GCC diagnostic pop

/**
 * C typing for the output of compRecordDef2buffer().
 */
struct data_record_def {
    struct data_record_def_field_type {
        /**
         * Offset in the record.
         */
        uint32_t offset;
        /**
         * Size of of the type in bytes.
         */
        uint32_t size;
        /**
         * Number of elements in a fixed array.
         */
        uint32_t arr_size;
        /**
         * Type code.
         */
        uint8_t type[2];
        /**
         * Name of the field.
         */
        char name[50];
    } field_list[0];
};

static_assert(sizeof(struct data_record_def_field_type) == 64);

static inline void data_record_fixup_cstring_p(const void *data_region, const char **pp, size_t len)
{
    uintptr_t base = (uintptr_t)data_region;
    const char *p = *pp;

    *pp = (len && p) ? base + p : NULL;
}

static inline int data_record_in_mem_range(const void *p, const void *start, size_t size)
{
    return (ptrdiff_t)p >= (ptrdiff_t)start && (ptrdiff_t)p < (ptrdiff_t)start + (ptrdiff_t)size;
}

static inline int data_record_is_valid_cstring_p(const void *data_region, size_t data_region_size, const char *p, size_t len)
{
    return (!p && len == 0) ||
           (data_record_in_mem_range(p, data_region, data_region_size) &&
            data_record_in_mem_range(p + len - 1, data_region, data_region_size));
}

#define DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    (_rec)->_field##_len = le64toh((_rec)->_field##_len); \
    data_record_fixup_cstring_p((_data), &((_rec)->_field##_str), ((_rec)->_field##_len)); \
    if (!data_record_is_valid_cstring_p((_data), (_data_size), ((_rec)->_field##_str), ((_rec)->_field##_len))) return SELVA_EINVAL;

#define DATA_RECORD_FIXUP_CSTRING_P_2(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_3(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_2(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_4(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_3(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_5(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_4(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_6(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_5(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_7(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_6(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_8(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_7(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_9(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_8(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_10(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_9(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_11(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_10(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_12(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_11(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_13(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_12(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_14(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_13(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_15(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_14(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_16(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_15(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_17(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_16(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_18(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_17(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_19(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_18(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_20(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_19(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_21(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_20(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_22(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_21(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_23(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_22(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_24(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_23(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_25(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_24(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_26(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_25(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_27(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_26(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_28(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_27(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_29(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_28(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_30(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_29(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_31(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_30(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_32(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_31(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_33(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_32(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_34(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_33(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_35(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_34(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_36(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_35(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_37(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_36(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_38(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_37(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_39(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_38(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_40(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_39(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_41(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_40(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_42(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_41(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_43(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_42(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_44(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_43(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_45(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_44(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_46(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_45(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_47(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_46(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_48(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_47(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_49(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_48(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_50(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_49(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_51(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_50(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_52(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_51(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_53(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_52(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_54(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_53(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_55(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_54(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_56(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_55(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_57(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_56(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_58(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_57(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_59(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_58(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_60(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_59(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_61(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_60(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_62(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_61(_rec, _data, _data_size, __VA_ARGS__)

#define DATA_RECORD_FIXUP_CSTRING_P_63(_rec, _data, _data_size, _field, ...) \
    DATA_RECORD_FIXUP_CSTRING_P_1(_rec, _data, _data_size, _field) \
    DATA_RECORD_FIXUP_CSTRING_P_62(_rec, _data, _data_size, __VA_ARGS__)

/**
 * Fix cstring_p pointers in a data-record.
 * @param _rec is a pointer to the record struct.
 * @param _rec_size is the total size of the record.
 * @param ... are the cstring_p field names.
 */
#define DATA_RECORD_FIXUP_CSTRING_P(_rec, _data, _data_size, ...) \
    CONCATENATE(DATA_RECORD_FIXUP_CSTRING_P_, UTIL_NARG(__VA_ARGS__))((_rec), (_data), (_data_size), __VA_ARGS__)
