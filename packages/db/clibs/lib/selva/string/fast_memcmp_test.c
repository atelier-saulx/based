/*
 * Copyright (c) 2022-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdio.h>
#include <string.h>
#include "print_ready.h"
#include "selva/ctime.h"
#include "selva/timestamp.h"
#include "selva/fast_memcmp.h"

#define TEST_STRING_1 \
"y7X8muviHTa2xAmQcGFXWOc4FkLdQCi4" \
"BRytz9uPq9Gk4FTs02n6Kv4YrOBD7q3c" \
"yafowlQov0wPvRDkELgOxaeI4puDN9hz" \
"tI8KLEsK2x7YaUDINS5MmgdGDq4IHIt9" \
"7V1CG7StJSgTpydQi9m3wx3WBkKuKG3w" \
"QwOR1KG4y98RspTAa2SBy7xaQl4wSlip" \
"CowxJV6CvVqLameOK4trsAox5toCbPaQ" \
"z2vhRPZsSVW8UkdFNZ9tI5FKDqx3hzBK" \
"CpHsLeI8MlbXqfkcfact2zi6iTWFPzGr" \
"weA7fvpVwe1aDLOER0iKabRpGBLOiO6s" \
"o4p3kv15MuNxKT5EQuqTWa6z0j3wYGCK" \
"4ldgvRUpIYoFA1dWbLxPZSTSox7ES2kG" \
"bVE40mrCaSbjEwIyJOeXzGRnxWUgZZZq" \
"a7a49MbxXI4ZGgmQDnvFvKVVloOwwPgD" \
"V5CAV50iEZvT2GHPVCNuy3NgbcJQllJu" \
"q20IueUjkyy7BfUFsdhVGdqwP16QYviS" \
"wUlsoUbjVJwcqE00BQL9rZQo9jPTBT8T" \
"g1wgYWsPUrHmQQh7UnYt1laCci0bTvt8" \
"5COG5eBNo9ksJqfVG0GkWcfC5b7PChMI" \
"VoOM4O2tvDP81rdNzM96uab0FvvHqFnE"
#define TEST_STRING_2 "abc"
#define TEST_STRING_3 "bVE40mrCaSbjEwIyJOeXzGRnxWUgZZZq"

#define ALTER() \
    ({ \
        if (alter & 0x1) b[0] ^= 0xff; \
        if (alter & 0x2) b[len - 1] ^= 0xff; \
    })

__constructor
__attribute__((optnone))
static void test_memcmp(void)
{
    const char *test_strings[] = {
        TEST_STRING_1,
        TEST_STRING_2,
        TEST_STRING_3
    };
    char a[1024];
    char b[1024];

    for (int alter = 0; alter < 4; alter++) {
        for (size_t j = 0; j < num_elem(test_strings); j++) {
            struct timespec ts_start, ts_end;
            size_t len = strlen(test_strings[j]);
            int x;

            memcpy(a, test_strings[j], len);
            memcpy(b, a, len);
            ALTER();

            fprintf(stderr, "== %s: alter: %x string: %zu ==\n", __func__, alter, j);

            x = 0;
            ts_monotime(&ts_start);
            for (int64_t i = 0; i < 1'000'000; i++) {
                x += fast_memcmp(a, b, len);
            }
            ts_monotime(&ts_end);
            print_ready("fast_memcmp", &ts_start, &ts_end, "res: %d\n", x);

            x = 0;
            ts_monotime(&ts_start);
            for (int64_t i = 0; i < 1'000'000; i++) {
                x += !memcmp(a, b, len);
            }
            ts_monotime(&ts_end);
            print_ready("memcmp", &ts_start, &ts_end, "res: %d\n", x);
        }
        fprintf(stderr, "\n");
    }
}
