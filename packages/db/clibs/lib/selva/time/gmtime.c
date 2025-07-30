/*
 * Copyright (c) 2025 SAULX
 * Copyright (c) 2014 - 2016 Olli Vanhoja <olli.vanhoja@cs.helsinki.fi>
 * Copyright (c) 1987 Regents of the University of California.
 * This file may be freely redistributed provided that this
 * notice remains attached.
 */

#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <tgmath.h>
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
#define SECS_PER_YEAR   31'556'926 /* avg accounting leap year. */

#define EPOCH_WDAY      SELVA_TM_THURSDAY

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
    /*
     * This yields a week day in [0,6] (Sunday=0).
     * Something like `(EPOCH_WDAY + days - 1) % 7` should give Monday=0 but we
     * follow the Unix/Linux/JS tradition. Moreover, remapping the week only
     * requires a few instructions if done like this `wday ? wday - 1 : 6`.
     */
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

    y = SELVA_EPOCH_YEAR;
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

/**
 * Returns the day of the week of 31 December.
 */
static int32_t p(int32_t y)
{
    return (5 * y + 12 - 4 * ((y / 100) - (y / 400)) +
            ((y - 100) / 400) - ((y - 102) / 400) +
            ((y - 200) / 400) - ((y - 199) / 400)) % 28;
}

static int32_t weeks(int32_t year)
{
#define WEEKSY(y) \
    case y: return 52 + (p(y) <= 4)

    /*
     * This will be optimized either into a simple range if (gcc) or a lookup
     * table (clang), i.e. the compiled precalculates the result of p(year) for
     * the hard-coded years.
     */
    switch (year) {
        /* 2020 not included because it would double the code len on gcc. */
        WEEKSY(2021);
        WEEKSY(2022);
        WEEKSY(2023);
        WEEKSY(2024);
        WEEKSY(2025);
        WEEKSY(2026);
        WEEKSY(2027);
        /* 2028 not included to keep the lookup compact on gcc. */
        default: return 52 + (p(year) <= 4);
    }
#undef WEEKSY
}

#define ISO_DOW 1
#define ISO_DOY 4

#define TM0_ARR_BEGIN 2021
#define TM0_ARR_END   2027
static const struct selva_tm tm0_arr[] = {
    { .tm_sec = 42, .tm_min = 19, .tm_hour = 19, .tm_mday = 4, .tm_mon = 0, .tm_year = 2027, .tm_wday = 1, .tm_yday = 3, .tm_yleap = 0, }, /* 2027 */
    { .tm_sec = 56, .tm_min = 30, .tm_hour = 13, .tm_mday = 4, .tm_mon = 0, .tm_year = 2026, .tm_wday = 0, .tm_yday = 3, .tm_yleap = 0, }, /* 2026 */
    { .tm_sec = 10, .tm_min = 42, .tm_hour = 7,  .tm_mday = 4, .tm_mon = 0, .tm_year = 2025, .tm_wday = 6, .tm_yday = 3, .tm_yleap = 0, }, /* 2025 */
    { .tm_sec = 24, .tm_min = 53, .tm_hour = 1,  .tm_mday = 4, .tm_mon = 0, .tm_year = 2024, .tm_wday = 4, .tm_yday = 3, .tm_yleap = 1, }, /* 2024 */
    { .tm_sec = 38, .tm_min = 4,  .tm_hour = 20, .tm_mday = 4, .tm_mon = 0, .tm_year = 2023, .tm_wday = 3, .tm_yday = 3, .tm_yleap = 0, }, /* 2023 */
    { .tm_sec = 52, .tm_min = 15, .tm_hour = 14, .tm_mday = 4, .tm_mon = 0, .tm_year = 2022, .tm_wday = 2, .tm_yday = 3, .tm_yleap = 0, }, /* 2022 */
    { .tm_sec = 6,  .tm_min = 27, .tm_hour = 8,  .tm_mday = 4, .tm_mon = 0, .tm_year = 2021, .tm_wday = 1, .tm_yday = 3, .tm_yleap = 0, }, /* 2021 */
};

struct selva_iso_week *selva_gmtime_iso_wyear(struct selva_iso_week *wyear, int64_t ts, int64_t tmz)
{
    struct selva_tm tm0, tm1;
    int64_t days;

    ts /= 1000;
    tmz *= 60;

    days = offtime_clock(&tm1, ts, tmz);
    days = offtime_wday(&tm1, days);
    (void)offtime_year(&tm1, days);

    int32_t fwd = 7 + ISO_DOW - ISO_DOY;
    switch (tm1.tm_year) {
    case TM0_ARR_BEGIN ... TM0_ARR_END:
        memcpy(&tm0, &tm0_arr[TM0_ARR_END - tm1.tm_year], sizeof(tm0));
        break;
    default:
        {
            int64_t fwd_off = SECS_PER_DAY;
            do {
                offtime(&tm0, (tm1.tm_year - SELVA_EPOCH_YEAR) * SECS_PER_YEAR + fwd_off, 0);
                fwd_off += SECS_PER_DAY;
            } while (tm0.tm_mday < fwd);
        }
    }
    /* Helper for finding the values for tm0_arr. */
#if 0
    fprintf(stderr, "%d: %d %d %d %d %d %d %d %d %d\n", tm1.tm_year,
        tm0.tm_sec,
        tm0.tm_min,
        tm0.tm_hour,
        tm0.tm_mday,
        tm0.tm_mon,
        tm0.tm_year,
        tm0.tm_wday,
        tm0.tm_yday,
        tm0.tm_yleap
    );
#endif

    int32_t wday = selva_gmtime_wday2iso_wday(tm0.tm_wday);
    int32_t fwdlw = (7 + wday + 1 - ISO_DOW) % 7;
    int32_t week_off = -fwdlw + fwd - 1;
    int32_t week = (int32_t)floor((((double)tm1.tm_yday + 1.0) - (double)week_off - 1.0) / 7.0) + 1;

    int32_t iso_year;
    int32_t iso_week;

    if (week < 1) {
        iso_year = tm1.tm_year - 1;
        iso_week = week + weeks(iso_year);
    } else if (week > weeks(tm1.tm_year)) {
        iso_year = tm1.tm_year + 1;
        iso_week = week - weeks(tm1.tm_year);
    } else {
        iso_week = week;
        iso_year = tm1.tm_year;
    }

    wyear->iso_year = iso_year;
    wyear->iso_week = iso_week;

    return wyear;
}
