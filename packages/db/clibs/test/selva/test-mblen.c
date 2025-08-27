/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */

#include <stdint.h>
#include "selva/mblen.h"

PU_TEST(test_mblen)
{
    unsigned x = selva_mblen('x');
    unsigned y = selva_mblen("ä"[0]);
    unsigned z = selva_mblen("ࡈ"[0]);
    unsigned r = selva_mblen("𒁦"[0]);

    pu_assert_equal("len", x, 0);
    pu_assert_equal("len", y, 1);
    pu_assert_equal("len", z, 2);
    pu_assert_equal("len", r, 3);

    return nullptr;
}
