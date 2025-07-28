/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */

#include "selva/gmtime.h"

PU_TEST(test_gmtime_tm)
{
    struct selva_tm tm;

    selva_gmtime(&tm, 1'753'698'615'000, 0 /* UTC+00 */);

    pu_assert_equal("sec", tm.tm_sec, 15);
    pu_assert_equal("min", tm.tm_min, 30);
    pu_assert_equal("hour", tm.tm_hour, 10);
    pu_assert_equal("day of month", tm.tm_mday, 28);
    pu_assert_equal("month", tm.tm_mon, 6);
    pu_assert_equal("year", tm.tm_year, 2025);
    pu_assert_equal("day of week", tm.tm_wday, 1);
    pu_assert_equal("day of year", tm.tm_yday, 208);
    pu_assert_equal("not a leap year", tm.tm_yleap, 0);

    return nullptr;
}

PU_TEST(test_gmtime_tm_yleap)
{
    struct selva_tm tm;

    selva_gmtime(&tm, 1'708'730'660'000, 0 /* UTC+00 */);

    pu_assert_equal("sec", tm.tm_sec, 20);
    pu_assert_equal("min", tm.tm_min, 24);
    pu_assert_equal("hour", tm.tm_hour, 23);
    pu_assert_equal("day of month", tm.tm_mday, 23);
    pu_assert_equal("month", tm.tm_mon, 1);
    pu_assert_equal("year", tm.tm_year, 2024);
    pu_assert_equal("day of week", tm.tm_wday, 5);
    pu_assert_equal("day of year", tm.tm_yday, 53);
    pu_assert("is a leap year", tm.tm_yleap);

    return nullptr;
}

PU_TEST(test_gmtime_helsinki)
{
    struct selva_tm tm;

    selva_gmtime(&tm, 1'753'698'615'000, 120 /* EEST */);

    pu_assert_equal("sec", tm.tm_sec, 15);
    pu_assert_equal("min", tm.tm_min, 30);
    pu_assert_equal("hour", tm.tm_hour, 12);
    pu_assert_equal("day of month", tm.tm_mday, 28);
    pu_assert_equal("month", tm.tm_mon, 6);
    pu_assert_equal("year", tm.tm_year, 2025);
    pu_assert_equal("day of week", tm.tm_wday, 1);
    pu_assert_equal("day of year", tm.tm_yday, 208);

    return nullptr;
}

PU_TEST(test_gmtime_sf)
{
    struct selva_tm tm;

    selva_gmtime(&tm, 1'753'687'815'000, -480 /* PST */);

    pu_assert_equal("sec", tm.tm_sec, 15);
    pu_assert_equal("min", tm.tm_min, 30);
    pu_assert_equal("hour", tm.tm_hour, 23);
    pu_assert_equal("day of month", tm.tm_mday, 27);
    pu_assert_equal("month", tm.tm_mon, 6);
    pu_assert_equal("year", tm.tm_year, 2025);
    pu_assert_equal("day of week", tm.tm_wday, 0);
    pu_assert_equal("day of year", tm.tm_yday, 207);

    return nullptr;
}

PU_TEST(test_gmtime_hk)
{
    struct selva_tm tm;

    selva_gmtime(&tm, 1'753'705'598'000, 480 /* UTC+08 */);

    pu_assert_equal("sec", tm.tm_sec, 38);
    pu_assert_equal("min", tm.tm_min, 26);
    pu_assert_equal("hour", tm.tm_hour, 20);
    pu_assert_equal("day of month", tm.tm_mday, 28);
    pu_assert_equal("month", tm.tm_mon, 6);
    pu_assert_equal("year", tm.tm_year, 2025);
    pu_assert_equal("day of week", tm.tm_wday, 1);
    pu_assert_equal("day of year", tm.tm_yday, 208);

    return nullptr;
}

PU_TEST(test_gmtime_eucla)
{
    struct selva_tm tm;

    selva_gmtime(&tm, 1'753'709'130'000, 525 /* UTC+08:45 */);

    pu_assert_equal("sec", tm.tm_sec, 30);
    pu_assert_equal("min", tm.tm_min, 10);
    pu_assert_equal("hour", tm.tm_hour, 22);
    pu_assert_equal("day of month", tm.tm_mday, 28);
    pu_assert_equal("month", tm.tm_mon, 6);
    pu_assert_equal("year", tm.tm_year, 2025);
    pu_assert_equal("day of week", tm.tm_wday, 1);
    pu_assert_equal("day of year", tm.tm_yday, 208);

    return nullptr;
}

PU_TEST(test_gmtime_year)
{
    int32_t year = selva_gmtime_year(1'753'698'615'000, 0 /* UTC+00 */);

    pu_assert_equal("year", year, 2025);

    return nullptr;
}

PU_TEST(test_gmtime_mon)
{
    int32_t month = selva_gmtime_mon(1'753'698'615'000, 0 /* UTC+00 */);

    pu_assert_equal("year", month, 6);

    return nullptr;
}

PU_TEST(test_gmtime_yday)
{
    int32_t yday = selva_gmtime_yday(1'753'698'615'000, 0 /* UTC+00 */);

    pu_assert_equal("day of year", yday, 208);

    return nullptr;
}

PU_TEST(test_gmtime_wday)
{
    int32_t wday = selva_gmtime_wday(1'753'698'615'000, 0 /* UTC+00 */);

    pu_assert_equal("day of week", wday, 1);

    return nullptr;
}

PU_TEST(test_gmtime_mday)
{
    int32_t mday = selva_gmtime_mday(1'753'698'615'000, 0 /* UTC+00 */);

    pu_assert_equal("day of month", mday, 28);

    return nullptr;
}

PU_TEST(test_gmtime_hour)
{
    int32_t hour = selva_gmtime_hour(1'753'698'615'000, 0 /* UTC+00 */);

    pu_assert_equal("hour", hour, 10);

    return nullptr;
}

PU_TEST(test_week_numbers)
{
    pu_assert_equal("week", selva_gmtime_iso_wyear(1'753'711'927'000, 0), 30);
    pu_assert_equal("week", selva_gmtime_iso_wyear(1'735'772'400'000, 0), 0);
    pu_assert_equal("week", selva_gmtime_iso_wyear(1'704'063'600'000, 0), 0);
    pu_assert_equal("week", selva_gmtime_iso_wyear(1'608'678'000'000, 0), 51);
    pu_assert_equal("week", selva_gmtime_iso_wyear(1'609'628'400'000, 0), 52);
    pu_assert_equal("week", selva_gmtime_iso_wyear(1'577'660'400'000, 0), 0);
    pu_assert_equal("week", selva_gmtime_iso_wyear(1'514'674'800'000, 0), 51);

    return nullptr;
}
