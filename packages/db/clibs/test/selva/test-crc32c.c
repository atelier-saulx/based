/*
 * Copyright (c) 2022-2023, 2025 SAULX
 * SPDX-License-Identifier: MIT
 */

#include <stdint.h>
#include "selva/crc32c.h"

PU_TEST(test_check)
{
    const char check1[] = "123456789";
    const char check2[] = "Hello world!";

    pu_assert_equal("should match", crc32c(0, check1, sizeof(check1) - 1), 0xe3069283);
    pu_assert_equal("should match", crc32c(0, check2, sizeof(check2) - 1), 0x7b98e751);

    return nullptr;
}
