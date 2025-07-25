/*
 * Copyright (c) 2022-2023, 2025 SAULX
 *
 * SPDX-License-Identifier: MIT
 */

#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "jemalloc_selva.h"
#include "svector.h"

struct data {
    int id;
};

struct SVector vec;

static int compar(const void ** restrict ap, const void ** restrict bp)
{
    const struct data *a = *(const struct data **)ap;
    const struct data *b = *(const struct data **)bp;

    return a->id - b->id;
}

void setup(void)
{
    memset(&vec, 0, sizeof(struct SVector));
}

void teardown(void)
{
    if (vec.vec_mode == SVECTOR_MODE_ARRAY) {
#if 0
        selva_free(vec.vec_arr);
#endif
        free(vec.vec_arr);
    }
}

PU_TEST(test_init_works)
{
    SVector_Init(&vec, 50, compar);

    pu_assert_ptr_equal("compar is set", vec.vec_compar, compar);
    pu_assert_equal("length is correct", vec.vec_arr_len, 50);
    pu_assert_equal("last is zeroed", vec.vec_last, 0);
    pu_assert_equal("mode is set correctly", SVector_Mode(&vec), SVECTOR_MODE_ARRAY);

    return nullptr;
}

PU_TEST(test_init_works_huge)
{
    SVector_Init(&vec, 1000, compar);

    pu_assert_ptr_equal("compar is set", vec.vec_compar, compar);
    pu_assert_equal("last is zeroed", vec.vec_last, 0);
    pu_assert_equal("mode is set correctly", SVector_Mode(&vec), SVECTOR_MODE_RBTREE);

    return nullptr;
}

PU_TEST(test_init_lazy_alloc)
{
    SVector_Init(&vec, 0, compar);

    pu_assert_ptr_equal("compar is set", vec.vec_compar, compar);
    pu_assert_ptr_equal("vec_arr is not allocated", vec.vec_arr, NULL);
    pu_assert_equal("length is correct", vec.vec_arr_len, 0);
    pu_assert_equal("last is zeroed", vec.vec_last, 0);

    return nullptr;
}

PU_TEST(test_can_destroy)
{
    SVector_Init(&vec, 100, compar);

    SVector_Destroy(&vec);
    // multiple times
    SVector_Destroy(&vec);

    return nullptr;
}

PU_TEST(test_insert_one)
{
    struct data el1 = {
        .id = 10,
    };

    SVector_Init(&vec, 5, compar);
    SVector_Insert(&vec, &el1);

    pu_assert_equal("last is incremented", vec.vec_last, 1);
    pu_assert_ptr_equal("el1 was inserted", vec.vec_arr[0], &el1);

    return nullptr;
}

PU_TEST(test_insert_one_fast)
{
    struct data el1 = {
        .id = 10,
    };

    SVector_Init(&vec, 5, compar);
    SVector_Insert(&vec, &el1);

    pu_assert_equal("last is incremented", vec.vec_last, 1);
    pu_assert_ptr_equal("el1 was inserted", vec.vec_arr[0], &el1);

    return nullptr;
}

PU_TEST(test_insert_one_lazy_alloc)
{
    struct data el1 = {
        .id = 10,
    };

    SVector_Init(&vec, 0, compar);
    SVector_Insert(&vec, &el1);

    pu_assert_equal("last is incremented", vec.vec_last, 1);
    pu_assert("vec_arr is allocated", vec.vec_arr != nullptr);
    pu_assert_ptr_equal("el1 was inserted", vec.vec_arr[0], &el1);

    return nullptr;
}

PU_TEST(test_insert_two_desc)
{
    struct data el1 = {
        .id = 10,
    };
    struct data el2 = {
        .id = 1,
    };

    SVector_Init(&vec, 5, compar);
    SVector_Insert(&vec, &el1);
    SVector_Insert(&vec, &el2);

    pu_assert_equal("last is incremented", vec.vec_last, 2);
    pu_assert_ptr_equal("el1 was inserted correctly", vec.vec_arr[1], &el1);
    pu_assert_ptr_equal("el2 was inserted correctly", vec.vec_arr[0], &el2);

    return nullptr;
}

PU_TEST(test_insert_many)
{
    struct data el[] = { { 1 }, { 5 }, { 15 }, { 800 }, { 3 }, { 300 }, { 10 }, { 20 } };

    SVector_Init(&vec, 5, compar);

    for (size_t i = 0; i < num_elem(el); i++) {
        SVector_Insert(&vec, &el[i]);
    }

    pu_assert_equal("last is incremented", vec.vec_last, 8);

    struct data **data = ((struct data **)vec.vec_arr);
    pu_assert_ptr_equal("el was inserted correctly", data[0]->id, 1);
    pu_assert_ptr_equal("el was inserted correctly", data[1]->id, 3);
    pu_assert_ptr_equal("el was inserted correctly", data[2]->id, 5);
    pu_assert_ptr_equal("el was inserted correctly", data[3]->id, 10);
    pu_assert_ptr_equal("el was inserted correctly", data[4]->id, 15);
    pu_assert_ptr_equal("el was inserted correctly", data[5]->id, 20);
    pu_assert_ptr_equal("el was inserted correctly", data[6]->id, 300);
    pu_assert_ptr_equal("el was inserted correctly", data[7]->id, 800);

    return nullptr;
}

PU_TEST(test_insertFast_lazy_alloc)
{
    struct data el1 = {
        .id = 10,
    };

    SVector_Init(&vec, 0, compar);
    SVector_Insert(&vec, &el1);

    pu_assert_equal("last is incremented", vec.vec_last, 1);
    pu_assert("vec_arr is allocated", vec.vec_arr != nullptr);
    pu_assert_ptr_equal("el1 was inserted", vec.vec_arr[0], &el1);
    pu_assert_equal("size is correct", SVector_Size(&vec), 1);

    return nullptr;
}

PU_TEST(test_insertFast_many)
{
    struct data el[] = {
        { 1 }, { 5 }, { 15 }, { 800 }, { 3 }, { 300 }, { 10 }, { 20 }, { 232 },
        { 223 }, { 130 }, { 132 }, { 133 }, { 134 }, { 135 }, { 136 }, { 137 },
        { 201 }, { 202 }, { 203 }, { 204 }, { 205 }, { 206 }, { 207 }, { 208 },
        { 301 }, { 302 }, { 303 }, { 304 }, { 305 }, { 306 }, { 307 }, { 308 },
        { 401 }, { 402 }, { 403 }, { 404 }, { 405 }, { 406 }, { 407 }, { 408 },
        { 501 }, { 502 }, { 503 }, { 504 }, { 505 }, { 506 }, { 507 }, { 508 },
        { 601 }, { 602 }, { 603 }, { 604 }, { 605 }, { 606 }, { 607 }, { 608 },
        { 0x00A7 }, { 0x8198 }, { 0x00A8 }, { 0x814E }, { 0x00B0 }, { 0x818B },
        { 0x00B4 }, { 0x814C }, { 0x00B6 }, { 0x81F7 }, { 0x00D7 }, { 0x817E },
        { 0x0391 }, { 0x839F }, { 0x0392 }, { 0x83A0 }, { 0x0393 }, { 0x83A1 },
        { 0x0395 }, { 0x83A3 }, { 0x0396 }, { 0x83A4 }, { 0x0397 }, { 0x83A5 },
        { 0x0399 }, { 0x83A7 }, { 0x039A }, { 0x83A8 }, { 0x039B }, { 0x83A9 },
        { 0x039D }, { 0x83AB }, { 0x039E }, { 0x83AC }, { 0x039F }, { 0x83AD },
        { 0x03A1 }, { 0x83AF }, { 0x03A3 }, { 0x83B0 }, { 0x03A4 }, { 0x83B1 },
        { 0x03A6 }, { 0x83B3 }, { 0x03A7 }, { 0x83B4 }, { 0x03A8 }, { 0x83B5 },
        { 0x03B1 }, { 0x83BF }, { 0x03B2 }, { 0x83C0 }, { 0x03B3 }, { 0x83C1 },
        { 0x03B5 }, { 0x83C3 }, { 0x03B6 }, { 0x83C4 }, { 0x03B7 }, { 0x83C5 },
        { 0x03B9 }, { 0x83C7 }, { 0x03BA }, { 0x83C8 }, { 0x03BB }, { 0x83C9 },
        { 0x03BD }, { 0x83CB }, { 0x03BE }, { 0x83CC }, { 0x03BF }, { 0x83CD },
        { 0x03C1 }, { 0x83CF }, { 0x03C3 }, { 0x83D0 }, { 0x03C4 }, { 0x83D1 },
        { 0x03C6 }, { 0x83D3 }, { 0x03C7 }, { 0x83D4 }, { 0x03C8 }, { 0x83D5 },
        { 0x0401 }, { 0x8446 }, { 0x0410 }, { 0x8440 }, { 0x0411 }, { 0x8441 },
        { 0x0413 }, { 0x8443 }, { 0x0414 }, { 0x8444 }, { 0x0415 }, { 0x8445 },
        { 0x0417 }, { 0x8448 }, { 0x0418 }, { 0x8449 }, { 0x0419 }, { 0x844A },
        { 0x041B }, { 0x844C }, { 0x041C }, { 0x844D }, { 0x041D }, { 0x844E },
        { 0x041F }, { 0x8450 }, { 0x0420 }, { 0x8451 }, { 0x0421 }, { 0x8452 },
        { 0x0423 }, { 0x8454 }, { 0x0424 }, { 0x8455 }, { 0x0425 }, { 0x8456 },
        { 0x0427 }, { 0x8458 }, { 0x0428 }, { 0x8459 }, { 0x0429 }, { 0x845A },
        { 0x042B }, { 0x845C }, { 0x042C }, { 0x845D }, { 0x042D }, { 0x845E },
        { 0x042F }, { 0x8460 }, { 0x0430 }, { 0x8470 }, { 0x0431 }, { 0x8471 },
        { 0x0433 }, { 0x8473 }, { 0x0434 }, { 0x8474 }, { 0x0435 }, { 0x8475 },
        { 0x0437 }, { 0x8478 }, { 0x0438 }, { 0x8479 }, { 0x0439 }, { 0x847A },
        { 0x043B }, { 0x847C }, { 0x043C }, { 0x847D }, { 0x043D }, { 0x847E },
        { 0x043F }, { 0x8481 }, { 0x0440 }, { 0x8482 }, { 0x0441 }, { 0x8483 },
        { 0x0443 }, { 0x8485 }, { 0x0444 }, { 0x8486 }, { 0x0445 }, { 0x8487 },
        { 0x0447 }, { 0x8489 }, { 0x0448 }, { 0x848A }, { 0x0449 }, { 0x848B },
        { 0x044B }, { 0x848D }, { 0x044C }, { 0x848E }, { 0x044D }, { 0x848F },
        { 0x044F }, { 0x8491 }, { 0x0451 }, { 0x8476 }, { 0x2010 }, { 0x815D },
        { 0x2018 }, { 0x8165 }, { 0x2019 }, { 0x8166 }, { 0x201C }, { 0x8167 },
        { 0x2020 }, { 0x81F5 }, { 0x2021 }, { 0x81F6 }, { 0x2025 }, { 0x8164 },
        { 0x2030 }, { 0x81F1 }, { 0x2032 }, { 0x818C }, { 0x2033 }, { 0x818D },
        { 0x2103 }, { 0x818E }, { 0x2116 }, { 0x8782 }, { 0x2121 }, { 0x8784 },
        { 0x2160 }, { 0x8754 }, { 0x2161 }, { 0x8755 }, { 0x2162 }, { 0x8756 },
        { 0x2164 }, { 0x8758 }, { 0x2165 }, { 0x8759 }, { 0x2166 }, { 0x875A },
        { 0x2168 }, { 0x875C }, { 0x2169 }, { 0x875D }, { 0x2170 }, { 0xFA40 },
        { 0x2172 }, { 0xFA42 }, { 0x2173 }, { 0xFA43 }, { 0x2174 }, { 0xFA44 },
        { 0x2176 }, { 0xFA46 }, { 0x2177 }, { 0xFA47 }, { 0x2178 }, { 0xFA48 },
        { 0x2190 }, { 0x81A9 }, { 0x2191 }, { 0x81AA }, { 0x2192 }, { 0x81A8 },
        { 0x21D2 }, { 0x81CB }, { 0x21D4 }, { 0x81CC }, { 0x2200 }, { 0x81CD },
        { 0x2203 }, { 0x81CE }, { 0x2207 }, { 0x81DE }, { 0x2208 }, { 0x81B8 },
        { 0x2211 }, { 0x8794 }, { 0x221A }, { 0x81E3 }, { 0x221D }, { 0x81E5 },
        { 0x221F }, { 0x8798 }, { 0x2220 }, { 0x81DA }, { 0x2225 }, { 0x8161 },
        { 0x2228 }, { 0x81C9 }, { 0x2229 }, { 0x81BF }, { 0x222A }, { 0x81BE },
    };

    SVector_Init(&vec, 5, compar);

    for (size_t i = 0; i < num_elem(el); i++) {
        const void * r = SVector_Insert(&vec, &el[i]);
        pu_assert_null("No return value", r);
    }

    pu_assert_equal("last is incremented", vec.vec_last, 333);
    pu_assert_equal("size is correct", SVector_Size(&vec), 333);
    pu_assert_equal("mode was changed", SVector_Mode(&vec), SVECTOR_MODE_RBTREE);

    return nullptr;
}

PU_TEST(test_insertFast_dedup)
{
    struct data el1 = {
        .id = 10,
    };

    SVector_Init(&vec, 5, compar);
    const void *r1 = SVector_Insert(&vec, &el1);
    const void *r2 = SVector_Insert(&vec, &el1);

    pu_assert_equal("last is incremented", vec.vec_last, 1);
    pu_assert_ptr_equal("el1 was inserted", vec.vec_arr[0], &el1);
    pu_assert_null("r1 = nullptr", r1);
    pu_assert_ptr_equal("r2 = el1", r2, &el1);
    pu_assert_equal("size is correct", SVector_Size(&vec), 1);

    return nullptr;
}

PU_TEST(test_mixed_insertFast_and_Remove)
{
    struct data el[] = {
        { 1 }, { 5 }, { 15 }, { 800 }, { 3 }, { 300 }, { 10 }, { 20 }, { 232 },
        { 223 }, { 130 }, { 132 }, { 133 }, { 134 }, { 135 }, { 136 }, { 137 },
        { 201 }, { 202 }, { 203 }, { 204 }, { 205 }, { 206 }, { 207 }, { 208 },
        { 301 }, { 302 }, { 303 }, { 304 }, { 305 }, { 306 }, { 307 }, { 308 },
        { 401 }, { 402 }, { 403 }, { 404 }, { 405 }, { 406 }, { 407 }, { 408 },
        { 501 }, { 502 }, { 503 }, { 504 }, { 505 }, { 506 }, { 507 }, { 508 },
        { 601 }, { 602 }, { 603 }, { 604 }, { 605 }, { 606 }, { 607 }, { 608 },
        { 0x00A7 }, { 0x8198 }, { 0x00A8 }, { 0x814E }, { 0x00B0 }, { 0x818B },
        { 0x00B4 }, { 0x814C }, { 0x00B6 }, { 0x81F7 }, { 0x00D7 }, { 0x817E },
        { 0x0391 }, { 0x839F }, { 0x0392 }, { 0x83A0 }, { 0x0393 }, { 0x83A1 },
        { 0x0395 }, { 0x83A3 }, { 0x0396 }, { 0x83A4 }, { 0x0397 }, { 0x83A5 },
        { 0x0399 }, { 0x83A7 }, { 0x039A }, { 0x83A8 }, { 0x039B }, { 0x83A9 },
        { 0x039D }, { 0x83AB }, { 0x039E }, { 0x83AC }, { 0x039F }, { 0x83AD },
        { 0x03A1 }, { 0x83AF }, { 0x03A3 }, { 0x83B0 }, { 0x03A4 }, { 0x83B1 },
        { 0x03A6 }, { 0x83B3 }, { 0x03A7 }, { 0x83B4 }, { 0x03A8 }, { 0x83B5 },
        { 0x03B1 }, { 0x83BF }, { 0x03B2 }, { 0x83C0 }, { 0x03B3 }, { 0x83C1 },
        { 0x03B5 }, { 0x83C3 }, { 0x03B6 }, { 0x83C4 }, { 0x03B7 }, { 0x83C5 },
        { 0x03B9 }, { 0x83C7 }, { 0x03BA }, { 0x83C8 }, { 0x03BB }, { 0x83C9 },
        { 0x03BD }, { 0x83CB }, { 0x03BE }, { 0x83CC }, { 0x03BF }, { 0x83CD },
        { 0x03C1 }, { 0x83CF }, { 0x03C3 }, { 0x83D0 }, { 0x03C4 }, { 0x83D1 },
        { 0x03C6 }, { 0x83D3 }, { 0x03C7 }, { 0x83D4 }, { 0x03C8 }, { 0x83D5 },
        { 0x0401 }, { 0x8446 }, { 0x0410 }, { 0x8440 }, { 0x0411 }, { 0x8441 },
        { 0x0413 }, { 0x8443 }, { 0x0414 }, { 0x8444 }, { 0x0415 }, { 0x8445 },
        { 0x0417 }, { 0x8448 }, { 0x0418 }, { 0x8449 }, { 0x0419 }, { 0x844A },
        { 0x041B }, { 0x844C }, { 0x041C }, { 0x844D }, { 0x041D }, { 0x844E },
        { 0x041F }, { 0x8450 }, { 0x0420 }, { 0x8451 }, { 0x0421 }, { 0x8452 },
        { 0x0423 }, { 0x8454 }, { 0x0424 }, { 0x8455 }, { 0x0425 }, { 0x8456 },
        { 0x0427 }, { 0x8458 }, { 0x0428 }, { 0x8459 }, { 0x0429 }, { 0x845A },
        { 0x042B }, { 0x845C }, { 0x042C }, { 0x845D }, { 0x042D }, { 0x845E },
        { 0x042F }, { 0x8460 }, { 0x0430 }, { 0x8470 }, { 0x0431 }, { 0x8471 },
        { 0x0433 }, { 0x8473 }, { 0x0434 }, { 0x8474 }, { 0x0435 }, { 0x8475 },
        { 0x0437 }, { 0x8478 }, { 0x0438 }, { 0x8479 }, { 0x0439 }, { 0x847A },
        { 0x043B }, { 0x847C }, { 0x043C }, { 0x847D }, { 0x043D }, { 0x847E },
        { 0x043F }, { 0x8481 }, { 0x0440 }, { 0x8482 }, { 0x0441 }, { 0x8483 },
        { 0x0443 }, { 0x8485 }, { 0x0444 }, { 0x8486 }, { 0x0445 }, { 0x8487 },
        { 0x0447 }, { 0x8489 }, { 0x0448 }, { 0x848A }, { 0x0449 }, { 0x848B },
        { 0x044B }, { 0x848D }, { 0x044C }, { 0x848E }, { 0x044D }, { 0x848F },
        { 0x044F }, { 0x8491 }, { 0x0451 }, { 0x8476 }, { 0x2010 }, { 0x815D },
        { 0x2018 }, { 0x8165 }, { 0x2019 }, { 0x8166 }, { 0x201C }, { 0x8167 },
        { 0x2020 }, { 0x81F5 }, { 0x2021 }, { 0x81F6 }, { 0x2025 }, { 0x8164 },
        { 0x2030 }, { 0x81F1 }, { 0x2032 }, { 0x818C }, { 0x2033 }, { 0x818D },
        { 0x2103 }, { 0x818E }, { 0x2116 }, { 0x8782 }, { 0x2121 }, { 0x8784 },
        { 0x2160 }, { 0x8754 }, { 0x2161 }, { 0x8755 }, { 0x2162 }, { 0x8756 },
        { 0x2164 }, { 0x8758 }, { 0x2165 }, { 0x8759 }, { 0x2166 }, { 0x875A },
        { 0x2168 }, { 0x875C }, { 0x2169 }, { 0x875D }, { 0x2170 }, { 0xFA40 },
        { 0x2172 }, { 0xFA42 }, { 0x2173 }, { 0xFA43 }, { 0x2174 }, { 0xFA44 },
        { 0x2176 }, { 0xFA46 }, { 0x2177 }, { 0xFA47 }, { 0x2178 }, { 0xFA48 },
        { 0x2190 }, { 0x81A9 }, { 0x2191 }, { 0x81AA }, { 0x2192 }, { 0x81A8 },
        { 0x21D2 }, { 0x81CB }, { 0x21D4 }, { 0x81CC }, { 0x2200 }, { 0x81CD },
        { 0x2203 }, { 0x81CE }, { 0x2207 }, { 0x81DE }, { 0x2208 }, { 0x81B8 },
        { 0x2211 }, { 0x8794 }, { 0x221A }, { 0x81E3 }, { 0x221D }, { 0x81E5 },
        { 0x221F }, { 0x8798 }, { 0x2220 }, { 0x81DA }, { 0x2225 }, { 0x8161 },
        { 0x2228 }, { 0x81C9 }, { 0x2229 }, { 0x81BF }, { 0x222A }, { 0x81BE },
    };

    SVector_Init(&vec, 5, compar);

    for (size_t i = 0; i < num_elem(el); i++) {
        const void * r;

        r = SVector_Insert(&vec, &el[i]);
        pu_assert_null("no return value", r);

        if (i > 0 &&i % 3 == 0) {
            r = SVector_Remove(&vec, &el[i - 1]);
            pu_assert_ptr_equal("returned the correct el", r, &el[i - 1]);
        }
    }

    pu_assert_equal("mode was changed", SVector_Mode(&vec), SVECTOR_MODE_RBTREE);
    pu_assert_equal("final size is correct", SVector_Size(&vec), 223);

    return nullptr;
}

PU_TEST(test_insert_no_compar)
{
    struct data el[] = { { 1 }, { 2 }, { 3 } };

    SVector_Init(&vec, 3, nullptr);
    for (size_t i = 0; i < num_elem(el); i++) {
        SVector_Insert(&vec, &el[i]);
    }

    pu_assert_equal("last is incremented", vec.vec_last, 3);
    pu_assert_ptr_equal("el[0] was inserted correctly", vec.vec_arr[0], &el[0]);
    pu_assert_ptr_equal("el[1] was inserted correctly", vec.vec_arr[1], &el[1]);
    pu_assert_ptr_equal("el[2] was inserted correctly", vec.vec_arr[2], &el[2]);

    return nullptr;
}

PU_TEST(test_insert_setIndex)
{
    struct data el[] = { { 1 } };

    SVector_Init(&vec, 1, nullptr);
    SVector_SetIndex(&vec, 4095, &el[0]);

    pu_assert_ptr_equal("el[0] was inserted correctly", vec.vec_arr[4095], &el[0]);

    return nullptr;
}

PU_TEST(test_search_index_unordered)
{
    struct data el[] = { { 1 }, { 5 }, { 15 }, { 800 }, { 3 }, { 300 }, { 10 }, { 20 } };

    SVector_Init(&vec, 5, nullptr);

    for (size_t i = 0; i < num_elem(el); i++) {
        SVector_Insert(&vec, &el[i]);
    }

    const ssize_t i = SVector_SearchIndex(&vec, &el[3]);
    pu_assert_equal("found it", i, 3);

    const ssize_t i1 = SVector_SearchIndex(&vec, &(struct data){ 15 });
    pu_assert_equal("not found", i1, -1);

    return nullptr;
}

PU_TEST(test_search_index_ordered)
{
    struct data el[] = { { 1 }, { 5 }, { 15 }, { 800 }, { 3 }, { 300 }, { 10 }, { 20 } };

    SVector_Init(&vec, 5, compar);

    for (size_t i = 0; i < num_elem(el); i++) {
        SVector_Insert(&vec, &el[i]);
    }

    const ssize_t i = SVector_SearchIndex(&vec, &el[3]);
    pu_assert_equal("found it", i, 7);

    const ssize_t i1 = SVector_SearchIndex(&vec, &(struct data){ 5 });
    pu_assert_equal("found", i1, 2);

    const ssize_t i2 = SVector_SearchIndex(&vec, &(struct data){ 16 });
    pu_assert_equal("not found", i2, -1);

    return nullptr;
}

PU_TEST(test_search)
{
    struct data el[] = { { 1 }, { 5 }, { 15 }, { 800 }, { 3 }, { 300 }, { 10 }, { 20 } };

    SVector_Init(&vec, 5, compar);

    for (size_t i = 0; i < num_elem(el); i++) {
        SVector_Insert(&vec, &el[i]);
    }

    const struct data *res = SVector_Search(&vec, &(struct data){ 15 });

    pu_assert_ptr_equal("found the right one", res, &el[2]);

    return nullptr;
}

PU_TEST(test_remove_by_index)
{
    struct data el[] = { { 1 }, { 5 }, { 15 }, { 800 }, { 3 }, { 300 }, { 10 }, { 20 } };

    SVector_Init(&vec, 5, nullptr);

    for (size_t i = 0; i < num_elem(el); i++) {
        SVector_Insert(&vec, &el[i]);
    }

    struct data *r0 = SVector_GetIndex(&vec, 3);
    pu_assert_equal("the element is at expected index", r0->id, 800);
    pu_assert_equal("the size is correct", SVector_Size(&vec), num_elem(el));

    struct data *r1 = SVector_RemoveIndex(&vec, 3);
    pu_assert("r1 returned", r1);
    pu_assert_equal("removed the correct element", r1->id, 800);

    struct data *r2 = SVector_GetIndex(&vec, 3);
    pu_assert_equal("the old element is no longer there", r2->id, 3);
    pu_assert_equal("the size was decremented", SVector_Size(&vec), num_elem(el) - 1);

    return nullptr;
}

PU_TEST(test_remove_one)
{
    struct data el1 = {
        .id = 10,
    };

    SVector_Init(&vec, 5, compar);
    SVector_Insert(&vec, &el1);
    SVector_Remove(&vec, &el1);

    pu_assert_equal("last is zeroed", vec.vec_last, 0);

    return nullptr;
}

PU_TEST(test_remove_one_compound_literal)
{
    struct data el1 = {
        .id = 10,
    };

    SVector_Init(&vec, 5, compar);
    SVector_Insert(&vec, &el1);
    struct data *rem = SVector_Remove(&vec, &(struct data){ 10 });

    pu_assert_equal("last is zeroed", vec.vec_last, 0);
    pu_assert_ptr_equal("the removed item was returned", rem, &el1);

    return nullptr;
}

PU_TEST(test_remove_last)
{
    struct data el1 = {
        .id = 1,
    };
    struct data el2 = {
        .id = 2,
    };

    SVector_Init(&vec, 3, compar);
    SVector_Insert(&vec, &el1);
    SVector_Insert(&vec, &el2);
    SVector_Remove(&vec, &el2);

    pu_assert_equal("last is decremented", vec.vec_last, 1);
    pu_assert_ptr_equal("el1 was is still there", vec.vec_arr[0], &el1);

    return nullptr;
}

PU_TEST(test_remove_first)
{
    struct data el1 = {
        .id = 1,
    };
    struct data el2 = {
        .id = 2,
    };

    SVector_Init(&vec, 3, compar);
    SVector_Insert(&vec, &el1);
    SVector_Insert(&vec, &el2);
    SVector_Remove(&vec, &el1);

    pu_assert_equal("last is decremented", vec.vec_last, 1);
    pu_assert_ptr_equal("el2 was is still there", vec.vec_arr[0], &el2);

    return nullptr;
}

PU_TEST(test_remove_middle)
{
    struct data el[] = { { 1 }, { 2 }, { 3 } };

    SVector_Init(&vec, 3, compar);
    for (size_t i = 0; i < num_elem(el); i++) {
        SVector_Insert(&vec, &el[i]);
    }

    SVector_Remove(&vec, &(struct data){ 2 });

    pu_assert_equal("last is decremented", vec.vec_last, 2);
    pu_assert_ptr_equal("el[0] was is still there", vec.vec_arr[0], &el[0]);
    pu_assert_ptr_equal("el[2] was is still there", vec.vec_arr[1], &el[2]);

    return nullptr;
}

PU_TEST(test_remove_all)
{
    struct data el[] = { { 1 }, { 5 }, { 15 }, { 800 }, { 3 }, { 300 }, { 10 }, { 20 } };

    SVector_Init(&vec, 9, compar);

    for (size_t i = 0; i < num_elem(el); i++) {
        SVector_Insert(&vec, &el[i]);
    }

    SVector_Remove(&vec, &(struct data){ 1 });
    SVector_Remove(&vec, &(struct data){ 5 });
    SVector_Remove(&vec, &(struct data){ 15 });
    SVector_Remove(&vec, &(struct data){ 800 });
    SVector_Remove(&vec, &(struct data){ 3 });
    SVector_Remove(&vec, &(struct data){ 300 });
    SVector_Remove(&vec, &(struct data){ 10 });
    SVector_Remove(&vec, &(struct data){ 20 });

    pu_assert_equal("the vector is empty", SVector_Size(&vec), 0);

    return nullptr;
}

PU_TEST(test_peek)
{
    struct data el[] = { { 1 }, { 2 }, { 3 } };
    int *v;

    SVector_Init(&vec, 3, compar);
    for (size_t i = 0; i < num_elem(el); i++) {
        SVector_Insert(&vec, &el[i]);
    }

    v = SVector_Peek(&vec);
    pu_assert_equal("Got the first elem", *v, 1);
    pu_assert_ptr_equal("Shifts el[0]", SVector_Shift(&vec), &el[0]);
    SVector_ShiftReset(&vec);

    v = SVector_Peek(&vec);
    pu_assert_equal("Got the second elem", *v, 2);

    pu_assert_ptr_equal("Shifts el[0]", SVector_Shift(&vec), &el[1]);
    v = SVector_Peek(&vec);
    pu_assert_equal("Got the last elem", *v, 3);

    pu_assert_ptr_equal("Shifts el[0]", SVector_Shift(&vec), &el[2]);
    v = SVector_Peek(&vec);
    pu_assert_null("Nothing left", v);

    return nullptr;
}

PU_TEST(test_pop)
{
    struct data el[] = { { 1 }, { 2 }, { 3 } };

    SVector_Init(&vec, 3, nullptr);
    for (size_t i = 0; i < num_elem(el); i++) {
        SVector_Insert(&vec, &el[i]);
    }

    pu_assert_ptr_equal("Pops el[2]", SVector_Pop(&vec), &el[2]);
    pu_assert_ptr_equal("Pops el[1]", SVector_Pop(&vec), &el[1]);

    SVector_Insert(&vec, &el[0]);
    pu_assert_ptr_equal("Pops el[0]", SVector_Pop(&vec), &el[0]);
    pu_assert_ptr_equal("Pops el[0]", SVector_Pop(&vec), &el[0]);
    pu_assert_equal("Vector size is zeroed", SVector_Size(&vec), 0);

    return nullptr;
}

PU_TEST(test_shift)
{
    struct data el[] = { { 1 }, { 2 }, { 3 } };

    SVector_Init(&vec, 3, nullptr);

    pu_assert_null("Shift empty vector", SVector_Shift(&vec));

    for (size_t i = 0; i < num_elem(el); i++) {
        SVector_Insert(&vec, &el[i]);
    }

    pu_assert_ptr_equal("Shifts el[0]", SVector_Shift(&vec), &el[0]);
    pu_assert_ptr_equal("Shifts el[1]", SVector_Shift(&vec), &el[1]);
    pu_assert_ptr_equal("Shifts el[2]", SVector_Shift(&vec), &el[2]);
    pu_assert_equal("Vector size is zeroed", SVector_Size(&vec), 0);
    pu_assert_null("Shifts nullptr", SVector_Shift(&vec));

    return nullptr;
}

PU_TEST(test_shift_reset)
{
    struct data el[] = { { 1 }, { 2 }, { 3 }, { 4 } };

    SVector_Init(&vec, num_elem(el), nullptr);
    for (size_t i = 0; i < num_elem(el); i++) {
        SVector_Insert(&vec, &el[i]);
    }

    pu_assert_ptr_equal("Shifts el[0]", SVector_Shift(&vec), &el[0]);
    pu_assert_ptr_equal("Shifts el[1]", SVector_Shift(&vec), &el[1]);
    pu_assert_ptr_equal("Shifts el[2]", SVector_Shift(&vec), &el[2]);
    pu_assert_equal("shift index is changed", vec.vec_arr_shift_index, 3);
    pu_assert_ptr_equal("Shifts el[3]", SVector_Shift(&vec), &el[3]);

    SVector_ShiftReset(&vec);
    pu_assert_equal("shift index is reset", vec.vec_arr_shift_index, 0);

    return nullptr;
}

PU_TEST(test_foreach_small)
{
    struct data el[] = { { 1 }, { 2 }, { 3 } };

    SVector_Init(&vec, 3, compar);
    for (size_t i = 0; i < num_elem(el); i++) {
        SVector_Insert(&vec, &el[i]);
    }

    size_t i = 0;
    struct SVectorIterator it;
    struct data *d;

    SVector_ForeachBegin(&it, &vec);
    while ((d = SVector_Foreach(&it))) {
        pu_assert_ptr_equal("el[0] is pointing to the correct item", d, &el[i++]);
    }

    return nullptr;
}

PU_TEST(test_foreach_large)
{
    struct data el[] = {
        { 1 }, { 2 }, { 3 }, { 4 }, { 5 }, { 6 }, { 7 }, { 8 }, { 9 }, { 10 }, { 11 }, { 12 }, { 13 }, { 14 }, { 15 }, { 16 }, { 17 }, { 18 }, { 19 }, { 20 }, { 21 }, { 22 }, { 23 }, { 24 }, { 25 }, { 26 }, { 27 }, { 28 }, { 29 }, { 30 }, { 31 }, { 32 }, { 33 }, { 34 }, { 35 }, { 36 }, { 37 }, { 38 }, { 39 }, { 40 }, { 41 }, { 42 }, { 43 }, { 44 }, { 45 }, { 46 }, { 47 }, { 48 }, { 49 }, { 50 }, { 51 }, { 52 }, { 53 }, { 54 }, { 55 }, { 56 }, { 57 }, { 58 }, { 59 }, { 60 }, { 61 }, { 62 }, { 63 }, { 64 }, { 65 }, { 66 }, { 67 }, { 68 }, { 69 }, { 70 }, { 71 }, { 72 }, { 73 }, { 74 }, { 75 }, { 76 }, { 77 }, { 78 }, { 79 }, { 80 }, { 81 }, { 82 }, { 83 }, { 84 }, { 85 }, { 86 }, { 87 }, { 88 }, { 89 }, { 90 }, { 91 }, { 92 }, { 93 }, { 94 }, { 95 }, { 96 }, { 97 }, { 98 }, { 99 }, { 100 }, { 101 }, { 102 }, { 103 }, { 104 }, { 105 }, { 106 }, { 107 }, { 108 }, { 109 }, { 110 }, { 111 }, { 112 }, { 113 }, { 114 }, { 115 }, { 116 }, { 117 }, { 118 }, { 119 }, { 120 }, { 121 }, { 122 }, { 123 }, { 124 }, { 125 }, { 126 }, { 127 }, { 128 }, { 129 }, { 130 }, { 131 }, { 132 }, { 133 }, { 134 }, { 135 }, { 136 }, { 137 }, { 138 }, { 139 }, { 140 }, { 141 }, { 142 }, { 143 }, { 144 }, { 145 }, { 146 }, { 147 }, { 148 }, { 149 }, { 150 } };

    SVector_Init(&vec, 3, compar);
    for (size_t i = 0; i < num_elem(el); i++) {
        SVector_Insert(&vec, &el[i]);
    }

    size_t i = 0;
    struct SVectorIterator it;
    struct data *d;

    SVector_ForeachBegin(&it, &vec);
    while ((d = SVector_Foreach(&it))) {
        pu_assert_ptr_equal("el[0] is pointing to the correct item", d, &el[i++]);
    }
    pu_assert_equal("found all items", i, num_elem(el));

    return nullptr;
}

PU_TEST(test_foreach_large_fast_insert)
{
    struct data el[] = {
        { 1 }, { 2 }, { 3 }, { 4 }, { 5 }, { 6 }, { 7 }, { 8 }, { 9 }, { 10 }, { 11 }, { 12 }, { 13 }, { 14 }, { 15 }, { 16 }, { 17 }, { 18 }, { 19 }, { 20 }, { 21 }, { 22 }, { 23 }, { 24 }, { 25 }, { 26 }, { 27 }, { 28 }, { 29 }, { 30 }, { 31 }, { 32 }, { 33 }, { 34 }, { 35 }, { 36 }, { 37 }, { 38 }, { 39 }, { 40 }, { 41 }, { 42 }, { 43 }, { 44 }, { 45 }, { 46 }, { 47 }, { 48 }, { 49 }, { 50 }, { 51 }, { 52 }, { 53 }, { 54 }, { 55 }, { 56 }, { 57 }, { 58 }, { 59 }, { 60 }, { 61 }, { 62 }, { 63 }, { 64 }, { 65 }, { 66 }, { 67 }, { 68 }, { 69 }, { 70 }, { 71 }, { 72 }, { 73 }, { 74 }, { 75 }, { 76 }, { 77 }, { 78 }, { 79 }, { 80 }, { 81 }, { 82 }, { 83 }, { 84 }, { 85 }, { 86 }, { 87 }, { 88 }, { 89 }, { 90 }, { 91 }, { 92 }, { 93 }, { 94 }, { 95 }, { 96 }, { 97 }, { 98 }, { 99 }, { 100 }, { 101 }, { 102 }, { 103 }, { 104 }, { 105 }, { 106 }, { 107 }, { 108 }, { 109 }, { 110 }, { 111 }, { 112 }, { 113 }, { 114 }, { 115 }, { 116 }, { 117 }, { 118 }, { 119 }, { 120 }, { 121 }, { 122 }, { 123 }, { 124 }, { 125 }, { 126 }, { 127 }, { 128 }, { 129 }, { 130 }, { 131 }, { 132 }, { 133 }, { 134 }, { 135 }, { 136 }, { 137 }, { 138 }, { 139 }, { 140 }, { 141 }, { 142 }, { 143 }, { 144 }, { 145 }, { 146 }, { 147 }, { 148 }, { 149 }, { 150 } };

    SVector_Init(&vec, 3, compar);
    for (size_t i = 0; i < num_elem(el); i++) {
        SVector_Insert(&vec, &el[i]);
    }

    size_t i = 0;
    struct SVectorIterator it;
    struct data *d;

    SVector_ForeachBegin(&it, &vec);
    while ((d = SVector_Foreach(&it))) {
        pu_assert_ptr_equal("el[0] is pointing to the correct item", d, &el[i++]);
    }
    pu_assert_equal("found all items", i, num_elem(el));

    return nullptr;
}

PU_TEST(test_foreach_extra_large)
{
    struct data el[100000];
    size_t i = 0;

    SVector_Init(&vec, 300, compar);
    for (i = 0; i < num_elem(el); i++) {
        el[i].id = i;
        SVector_Insert(&vec, &el[i]);
        SVector_Insert(&vec, &el[i]);
    }

    pu_assert_equal("inserted all", i, 100000);
    pu_assert_equal("size is correct", SVector_Size(&vec), 100000);

    struct SVectorIterator it;
    struct data *d;

    i = 0;
    SVector_ForeachBegin(&it, &vec);
    while ((d = SVector_Foreach(&it))) {
        i++;
    }

    pu_assert_equal("visited every item", i, 100000);

    return nullptr;
}

PU_TEST(test_get_index)
{
    struct data el[] = { { 1 }, { 2 }, { 3 } };

    SVector_Init(&vec, 3, compar);
    for (size_t i = 0; i < num_elem(el); i++) {
        SVector_Insert(&vec, &el[i]);
    }

    pu_assert_ptr_equal("ind 0", SVector_GetIndex(&vec, 0), &el[0]);
    pu_assert_ptr_equal("ind 1", SVector_GetIndex(&vec, 1), &el[1]);
    pu_assert_ptr_equal("ind 2", SVector_GetIndex(&vec, 2), &el[2]);

    return nullptr;
}

PU_SKIP(test_sizeof_ctrl)
{
    pu_test_description("Make sure the SVector size doesn't accidentally change when we make changes");

    pu_assert_equal("sizeof the control struct", sizeof(SVector), 48);

    return nullptr;
}
