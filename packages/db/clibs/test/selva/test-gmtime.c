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

PU_TEST(test_week_numbers)
{
    pu_assert_equal("week", selva_gmtime_iso_wyear(1753711927000, 0), 30);
    pu_assert_equal("week", selva_gmtime_iso_wyear(1735772400000, 0), 0);
    pu_assert_equal("week", selva_gmtime_iso_wyear(1704063600000, 0), 0);
    pu_assert_equal("week", selva_gmtime_iso_wyear(1608678000000, 0), 51);
    pu_assert_equal("week", selva_gmtime_iso_wyear(1609628400000, 0), 52);
    pu_assert_equal("week", selva_gmtime_iso_wyear(1577660400000, 0), 0);
    pu_assert_equal("week", selva_gmtime_iso_wyear(1514674800000, 0), 51);

    return nullptr;
}
