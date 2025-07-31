/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */

#include "selva/ctime.h"
#include "selva/timestamp.h"
#include "print_ready.h"
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
    struct selva_iso_week iso;

    pu_assert_equal("2027-12-31 week", selva_gmtime_iso_wyear(&iso, 1'830'211'200'000, 0)->iso_week, 52);
    pu_assert_equal("2026-01-02 week", selva_gmtime_iso_wyear(&iso, 1'767'225'600'000, 0)->iso_week, 1);
    pu_assert_equal("2025-07-28 week", selva_gmtime_iso_wyear(&iso, 1'753'711'927'000, 0)->iso_week, 31);
    pu_assert_equal("2025-01-01 week", selva_gmtime_iso_wyear(&iso, 1'735'772'400'000, 0)->iso_week, 1);
    pu_assert_equal("2023-12-31 week", selva_gmtime_iso_wyear(&iso, 1'704'063'600'000, 0)->iso_week, 52);
    pu_assert_equal("2020-12-22 week", selva_gmtime_iso_wyear(&iso, 1'608'678'000'000, 0)->iso_week, 52);
    pu_assert_equal("2021-01-02 week", selva_gmtime_iso_wyear(&iso, 1'609'628'400'000, 0)->iso_week, 53);
    pu_assert_equal("2019-12-29 week", selva_gmtime_iso_wyear(&iso, 1'577'660'400'000, 0)->iso_week, 52);
    pu_assert_equal("2017-12-30 week", selva_gmtime_iso_wyear(&iso, 1'514'674'800'000, 0)->iso_week, 52);
    pu_assert_equal("2004-12-27 week", selva_gmtime_iso_wyear(&iso, 1'104'105'600'000, 0)->iso_week, 53);
    pu_assert_equal("2005-12-31 week", selva_gmtime_iso_wyear(&iso, 1'135'987'200'000, 0)->iso_week, 52);
    pu_assert_equal("2005-01-01 week", selva_gmtime_iso_wyear(&iso, 1'104'537'600'000, 0)->iso_week, 53);
    pu_assert_equal("2005-01-02 week", selva_gmtime_iso_wyear(&iso, 1'104'624'000'000, 0)->iso_week, 53);
    pu_assert_equal("2007-12-31 week", selva_gmtime_iso_wyear(&iso, 1'199'059'200'000, 0)->iso_week, 1);
    pu_assert_equal("2009-12-31 week", selva_gmtime_iso_wyear(&iso, 1'262'217'600'000, 0)->iso_week, 53);
    pu_assert_equal("2010-01-02 week", selva_gmtime_iso_wyear(&iso, 1'262'390'400'000, 0)->iso_week, 53);
    pu_assert_equal("1995-01-02 week", selva_gmtime_iso_wyear(&iso, 789'004'800'000, 0)->iso_week, 1);
    pu_assert_equal("1921-01-02 week", selva_gmtime_iso_wyear(&iso, -1546214400'000, 0)->iso_week, 53);

    pu_assert_equal("2027-12-31 week", selva_gmtime_iso_wyear(&iso, 1'830'211'200'000, 0)->iso_year, 2027);
    pu_assert_equal("2026-01-02 week", selva_gmtime_iso_wyear(&iso, 1'767'225'600'000, 0)->iso_year, 2026);
    pu_assert_equal("2025-07-28 year", selva_gmtime_iso_wyear(&iso, 1'753'711'927'000, 0)->iso_year, 2025);
    pu_assert_equal("2025-01-01 year", selva_gmtime_iso_wyear(&iso, 1'735'772'400'000, 0)->iso_year, 2025);
    pu_assert_equal("2023-12-31 year", selva_gmtime_iso_wyear(&iso, 1'704'063'600'000, 0)->iso_year, 2023);
    pu_assert_equal("2020-12-22 year", selva_gmtime_iso_wyear(&iso, 1'608'678'000'000, 0)->iso_year, 2020);
    pu_assert_equal("2021-01-02 year", selva_gmtime_iso_wyear(&iso, 1'609'628'400'000, 0)->iso_year, 2020);
    pu_assert_equal("2019-12-29 year", selva_gmtime_iso_wyear(&iso, 1'577'660'400'000, 0)->iso_year, 2019);
    pu_assert_equal("2017-12-30 year", selva_gmtime_iso_wyear(&iso, 1'514'674'800'000, 0)->iso_year, 2017);
    pu_assert_equal("2005-01-01 year", selva_gmtime_iso_wyear(&iso, 1'104'537'600'000, 0)->iso_year, 2004);
    pu_assert_equal("2005-01-02 year", selva_gmtime_iso_wyear(&iso, 1'104'624'000'000, 0)->iso_year, 2004);
    pu_assert_equal("2007-12-31 year", selva_gmtime_iso_wyear(&iso, 1'199'059'200'000, 0)->iso_year, 2008);
    pu_assert_equal("2009-12-31 year", selva_gmtime_iso_wyear(&iso, 1'262'217'600'000, 0)->iso_year, 2009);
    pu_assert_equal("2010-01-02 year", selva_gmtime_iso_wyear(&iso, 1'262'390'400'000, 0)->iso_year, 2009);
    pu_assert_equal("1995-01-02 week", selva_gmtime_iso_wyear(&iso, 789'004'800'000, 0)->iso_year, 1995);
    pu_assert_equal("1921-01-02 week", selva_gmtime_iso_wyear(&iso, -1546214400'000, 0)->iso_year, 1920);

    return nullptr;
}

PU_TEST(test_week_numbers_perf)
{
    struct timespec start, end;
    struct selva_iso_week iso;
    int64_t ts;

    ts = 1'736'467'200;
    ts_monotime(&start);
    for (int64_t t = 0; t < 15'778'463; t++) {
        selva_gmtime_iso_wyear(&iso, ts + t, 0);
    }
    ts_monotime(&end);
    print_ready("2025 (opt)", &start, &end, "");

    ts = -1'577'145'600;
    ts_monotime(&start);
    for (int64_t t = 0; t < 15'778'463; t++) {
        selva_gmtime_iso_wyear(&iso, ts + t, 0);
    }
    ts_monotime(&end);
    print_ready("1920", &start, &end, "");

    return nullptr;
}
