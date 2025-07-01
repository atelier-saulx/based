/*
 * shared_ht_matchfinder.h - Lempel-Ziv matchfinding with a hash table
 *
 * Copyright (c) 2024 SAULX
 * Copyright 2022 Eric Biggers
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 *
 * ---------------------------------------------------------------------------
 *
 * This is a Hash Table (ht) matchfinder.
 *
 * This is a variant of the Hash Chains (hc) matchfinder that is optimized for
 * very fast compression.  The ht_matchfinder stores the hash chains inline in
 * the hash table, whereas the hc_matchfinder stores them in a separate array.
 * Storing the hash chains inline is the faster method when max_search_depth
 * (the maximum chain length) is very small.  It is not appropriate when
 * max_search_depth is larger, as then it uses too much memory.
 *
 * Due to its focus on speed, the ht_matchfinder doesn't support length 3
 * matches.  It also doesn't allow max_search_depth to vary at runtime; it is
 * fixed at build time as HT_MATCHFINDER_BUCKET_SIZE.
 *
 * See hc_matchfinder.h for more information.
 */

#pragma once

#include "matchfinder_common.h"

#define SHARED_HT_MATCHFINDER_HASH_ORDER   15
#define SHARED_HT_MATCHFINDER_BUCKET_SIZE  1

#define SHARED_HT_MATCHFINDER_MIN_MATCH_LEN    4
/* Minimum value of max_len for shared_ht_matchfinder_longest_match() */
#define SHARED_HT_MATCHFINDER_REQUIRED_NBYTES  5

struct shared_ht_matchfinder {
    mf_pos_t hash_tab[1UL << SHARED_HT_MATCHFINDER_HASH_ORDER][SHARED_HT_MATCHFINDER_BUCKET_SIZE];
} MATCHFINDER_ALIGNED;

static forceinline void
shared_ht_matchfinder_init(struct shared_ht_matchfinder *mf)
{
    static_assert(sizeof(*mf) % MATCHFINDER_SIZE_ALIGNMENT == 0);

    matchfinder_init((mf_pos_t *)mf, sizeof(*mf));
}

/* Note: max_len must be >= SHARED_HT_MATCHFINDER_REQUIRED_NBYTES */
static forceinline u32
shared_ht_matchfinder_longest_match(
        struct shared_ht_matchfinder * const mf,
        const u8 *dict,
        const u8 * const in_next,
        const u32 max_len,
        const u32 nice_len,
        u32 * const offset_ret)
{
    const u8 *best_matchptr = NULL;
    u32 best_len = 0;
    u32 hash;
    u32 seq;

    /* This is assumed throughout this function. */
    static_assert(SHARED_HT_MATCHFINDER_MIN_MATCH_LEN == 4);
    static_assert(SHARED_HT_MATCHFINDER_REQUIRED_NBYTES == 5);

    hash = lz_hash(get_unaligned_le32(in_next), SHARED_HT_MATCHFINDER_HASH_ORDER);
    seq = load_u32_unaligned(in_next);
    mf_pos_t last_match = 0;
    for (size_t i = 0; i < SHARED_HT_MATCHFINDER_BUCKET_SIZE; i++) {
        mf_pos_t cur_node;
        const u8 *matchptr;

        cur_node = mf->hash_tab[hash][i];
        if (cur_node == MATCHFINDER_INITVAL) {
            matchptr = memchr(dict + last_match, *in_next, MATCHFINDER_WINDOW_SIZE - last_match);
            if (!matchptr &&
                matchptr + SHARED_HT_MATCHFINDER_MIN_MATCH_LEN < dict + MATCHFINDER_WINDOW_SIZE) {
                goto out;
            }
            mf->hash_tab[hash][i] = matchptr - dict;
        } else {
            matchptr = &dict[cur_node];
        }

        if (load_u32_unaligned(matchptr) == seq) {
            u32 len;

            len = lz_extend(in_next, matchptr, SHARED_HT_MATCHFINDER_MIN_MATCH_LEN, max_len);
            if (len > best_len) {
                best_len = len;
                best_matchptr = matchptr;
                if (best_len >= nice_len) {
                    goto out;
                }
            }
        }
    }
out:
    *offset_ret = best_matchptr - dict;
    return best_len;
}
