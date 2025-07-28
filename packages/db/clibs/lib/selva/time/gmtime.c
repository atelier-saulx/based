/*
 * Copyright (c) 2025 SAULX
 * Copyright (c) 2014 - 2016 Olli Vanhoja <olli.vanhoja@cs.helsinki.fi>
 * Copyright (c) 1987 Regents of the University of California.
 * This file may be freely redistributed provided that this
 * notice remains attached.
 */

#include <stdint.h>
#include "selva/gmtime.h"

#define SECS_PER_MIN    60
#define MINS_PER_HOUR   60
#define HOURS_PER_DAY   24
#define DAYS_PER_WEEK   7
#define DAYS_PER_NYEAR  365
#define DAYS_PER_LYEAR  366
#define SECS_PER_HOUR   (SECS_PER_MIN * MINS_PER_HOUR)
#define SECS_PER_DAY    ((long) SECS_PER_HOUR * HOURS_PER_DAY)
#define MONS_PER_YEAR   12

#define TM_SUNDAY       0
#define TM_MONDAY       1
#define TM_TUESDAY      2
#define TM_WEDNESDAY    3
#define TM_THURSDAY     4
#define TM_FRIDAY       5
#define TM_SATURDAY     6

#define TM_JANUARY      0
#define TM_FEBRUARY     1
#define TM_MARCH        2
#define TM_APRIL        3
#define TM_MAY          4
#define TM_JUNE         5
#define TM_JULY         6
#define TM_AUGUST       7
#define TM_SEPTEMBER    8
#define TM_OCTOBER      9
#define TM_NOVEMBER     10
#define TM_DECEMBER     11
#define TM_SUNDAY       0

#define EPOCH_YEAR      1970
#define EPOCH_WDAY      TM_THURSDAY

/*
 * Accurate only for the past couple of centuries;
 * that will probably do.
 */
#define isleap(y) ((((y) % 4) == 0 && ((y) % 100) != 0) || ((y) % 400) == 0)

static const int64_t mon_lengths[2][MONS_PER_YEAR] = {
    { 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 },
    { 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 },
};

static const int64_t year_lengths[2] = {
    DAYS_PER_NYEAR, DAYS_PER_LYEAR
};

/**
 * Populate only tm_hour, tm_min, tm_sec in struct tm.
 * @param clock in sec
 * @param offset in sec.
 */
static int64_t offtime_clock(struct selva_tm *tm, int64_t clock, int64_t offset)
{
    int64_t days, rem;

    days = clock / SECS_PER_DAY;
    rem = clock % SECS_PER_DAY;
    rem += offset;
    while (rem < 0) {
        rem += SECS_PER_DAY;
        --days;
    }
    while (rem >= SECS_PER_DAY) {
        rem -= SECS_PER_DAY;
        ++days;
    }
    tm->tm_hour = (int32_t)(rem / SECS_PER_HOUR);
    rem = rem % SECS_PER_HOUR;
    tm->tm_min = (int32_t)(rem / SECS_PER_MIN);
    tm->tm_sec = (int32_t)(rem % SECS_PER_MIN);

    return days;
}

/**
 * Populate tm_wday in struct tm.
 * Call offtime_clock() first.
 * @param days as returned by offtime_clock().
 * @return days.
 */
static uint64_t offtime_wday(struct selva_tm *tm, int64_t days)
{
    tm->tm_wday = (int32_t)((EPOCH_WDAY + days) % DAYS_PER_WEEK);
    if (tm->tm_wday < 0) {
        tm->tm_wday += DAYS_PER_WEEK;
    }

    return days;
}

/**
 * Populate tm_year, tm_yday, and tm_yleap in struct tm.
 * Call offtime_clock() first.
 * @param days as returned by offtime_clock() or offtime_wday().
 * @return new days.
 */
static int64_t offtime_year(struct selva_tm *tm, int64_t days)
{
    int32_t y;
    bool yleap;

    y = EPOCH_YEAR;
    if (days >= 0) {
        for (;;) {
            yleap = isleap(y);
            if (days < year_lengths[yleap]) {
                break;
            }
            ++y;
            days = days - year_lengths[yleap];
        }
    } else do {
        --y;
        yleap = isleap(y);
        days = days + year_lengths[yleap];
    } while (days < 0);
    tm->tm_year = y;
    tm->tm_yday = (int32_t)days;
    tm->tm_yleap = yleap;

    return days;
}

/**
 * Populate full struct tm.
 * @param clock in sec
 * @param offset in sec.
 */
static void offtime(struct selva_tm *tm, int64_t clock, int64_t offset)
{
    int64_t days;
    const int64_t *ip;

    days = offtime_clock(tm, clock, offset);
    days = offtime_wday(tm, days);
    days = offtime_year(tm, days);
    ip = mon_lengths[tm->tm_yleap];
    for (tm->tm_mon = 0; days >= ip[tm->tm_mon]; ++(tm->tm_mon)) {
        days = days - ip[tm->tm_mon];
    }
    tm->tm_mday = (int32_t)(days + 1);
}

/**
 * Returns the day of the week of 31 December.
 */
static int32_t p(int32_t year)
{
    return (year + year / 4 - year / 100 + year / 400) % 7;
}

static int32_t weeks(int32_t year)
{
    return 52 + ((p(year) == 4) || p(year - 1) == 2 ? 1 : 0);
}

static int32_t iso_wyear(int32_t year, int32_t yday, int32_t wday)
{
    int32_t doy = yday + 1;
    int32_t dow = wday + 1;
    int32_t w = (10 + doy - dow) / 7;
    int32_t woy = (w < 1) ? weeks(year - 1) : (w > weeks(year)) ? 1 : w;

    return woy - 1;
}

void selva_gmtime(struct selva_tm *result, int64_t ts, int64_t tmz)
{
    offtime(result, ts / 1000, 60 * tmz);
}

#define GET_TM() ({ \
    struct selva_tm tm; \
    offtime(&tm, ts / 1000, 60 * tmz); tm; \
})

int32_t selva_gmtime_year(int64_t ts, int64_t tmz)
{
    struct selva_tm tm;
    int64_t days;

    days = offtime_clock(&tm, ts / 1000, 60 * tmz);
#if 0
    days = offtime_wday(&tm, days);
#endif
    (void)offtime_year(&tm, days);

    return tm.tm_year;
}

int32_t selva_gmtime_mon(int64_t ts, int64_t tmz)
{
    return GET_TM().tm_mon;
}

int32_t selva_gmtime_yday(int64_t ts, int64_t tmz)
{
    struct selva_tm tm;
    int64_t days;

    days = offtime_clock(&tm, ts / 1000, 60 * tmz);
#if 0
    days = offtime_wday(&tm, days);
#endif
    (void)offtime_year(&tm, days);

    return tm.tm_yday;
}

int32_t selva_gmtime_wday(int64_t ts, int64_t tmz)
{
    struct selva_tm tm;

    offtime_wday(&tm, offtime_clock(&tm, ts / 1000, 60 * tmz));

    return tm.tm_wday;
}

int32_t selva_gmtime_mday(int64_t ts, int64_t tmz)
{
    return GET_TM().tm_mday;
}

int32_t selva_gmtime_hour(int64_t ts, int64_t tmz)
{
    struct selva_tm tm;

    offtime_clock(&tm, ts / 1000, 60 * tmz);

    return tm.tm_hour;
}

int32_t selva_gmtime_iso_wyear(int64_t ts, int64_t tmz)
{
    struct selva_tm tm;
    int64_t days;

    days = offtime_clock(&tm, ts / 1000, 60 * tmz);
    days = offtime_wday(&tm, days);
    (void)offtime_year(&tm, days);

    return iso_wyear(tm.tm_year, tm.tm_yday, tm.tm_wday);
}
