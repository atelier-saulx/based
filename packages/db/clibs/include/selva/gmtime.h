/**
 *******************************************************************************
 * @file    gmtime.h
 * @author  Olli Vanhoja
 * @brief   Calendar calculations.
 * @section LICENSE
 * Copyright (c) 2025 Saulx
 * SPDX-License-Identifier: MIT
 *******************************************************************************
 */

#pragma once
#include <stdint.h>
#include "selva/_export.h"

#define SELVA_TM_SUNDAY       0
#define SELVA_TM_MONDAY       1
#define SELVA_TM_TUESDAY      2
#define SELVA_TM_WEDNESDAY    3
#define SELVA_TM_THURSDAY     4
#define SELVA_TM_FRIDAY       5
#define SELVA_TM_SATURDAY     6

#define SELVA_TM_JANUARY      0
#define SELVA_TM_FEBRUARY     1
#define SELVA_TM_MARCH        2
#define SELVA_TM_APRIL        3
#define SELVA_TM_MAY          4
#define SELVA_TM_JUNE         5
#define SELVA_TM_JULY         6
#define SELVA_TM_AUGUST       7
#define SELVA_TM_SEPTEMBER    8
#define SELVA_TM_OCTOBER      9
#define SELVA_TM_NOVEMBER     10
#define SELVA_TM_DECEMBER     11

#define SELVA_EPOCH_YEAR      1970

/**
 * Gregorian Calendar.
 */
struct selva_tm {
    int32_t tm_sec;     /*!< Seconds [0,60]. */
    int32_t tm_min;     /*!< Minutes [0,59]. */
    int32_t tm_hour;    /*!< Hour [0,23]. */
    int32_t tm_mday;    /*!< Day of month [1,31]. */
    int32_t tm_mon;     /*!< Month of year [0,11]. */
    int32_t tm_year;    /*!< Year. */
    int32_t tm_wday;    /*!< Day of week [0,6] (Sunday =0). */
    int32_t tm_yday;    /*!< Day of year [0,365]. */
    bool tm_yleap;      /*!< Is leap year. */
};

/**
 * ISO-8601 Week Date.
 */
struct selva_iso_week {
    int32_t iso_year; /*!< ISO year. */
    int32_t iso_week; /*!< ISO week [1,54]. */
};

static inline int32_t selva_gmtime_wday2iso_wday(int32_t wday)
{
    /* Same as (tm.tm_wday + 6) % 7 + 1 but fewer instructions. */
    return wday ? wday : 7;
}

/**
 * Calculate struct selva_tm from ts and tmz in Gregorian calendar.
 * @param ts in ms.
 * @param tmz in minutes.
 */
SELVA_EXPORT
void selva_gmtime(struct selva_tm *result, int64_t ts, int64_t tmz);

/**
 * Calculate Gregorian year from ts and tmz.
 * @param ts in ms.
 * @param tmz in minutes.
 * @returns Gregorian year.
 */
SELVA_EXPORT
int32_t selva_gmtime_year(int64_t ts, int64_t tmz);

/**
 * Calculate Gregorian month from ts and tmz.
 * @param ts in ms.
 * @param tmz in minutes.
 * @returns Gregorian month of year [0,11].
 */
SELVA_EXPORT
int32_t selva_gmtime_mon(int64_t ts, int64_t tmz);

/**
 * Calculate Gregorian day of year from ts and tmz.
 * @param ts in ms.
 * @param tmz in minutes.
 * @returns Gregorian day of year [0,365].
 */
SELVA_EXPORT
int32_t selva_gmtime_yday(int64_t ts, int64_t tmz);

/**
 * Calculate Gregorian day of week from ts and tmz.
 * @param ts in ms.
 * @param tmz in minutes.
 * @returns Gregorian day of week [0,6] (Sunday =0).
 */
SELVA_EXPORT
int32_t selva_gmtime_wday(int64_t ts, int64_t tmz);

/**
 * Calculate Gregorian day of month from ts and tmz.
 * @param ts in ms.
 * @param tmz in minutes.
 * @returns Gregorian day of month [1,31].
 */
SELVA_EXPORT
int32_t selva_gmtime_mday(int64_t ts, int64_t tmz);

/**
 * Calculate hour from ts and tmz.
 * @param ts in ms.
 * @param tmz in minutes.
 * @returns Hour [0, 23].
 */
SELVA_EXPORT
int32_t selva_gmtime_hour(int64_t ts, int64_t tmz);

/**
 * Calculate the ISO-8601 week date from ts and tmz.
 * @param ts in ms.
 * @param tmz in minutes.
 * @returns wyear.
 */
SELVA_EXPORT
struct selva_iso_week *selva_gmtime_iso_wyear(struct selva_iso_week *wyear, int64_t ts, int64_t tmz);
