/*
 * decompress_template.h
 *
 * Copyright (c) 2024 SAULX
 * Copyright 2023-2024 housisong
 * Copyright 2016 Eric Biggers
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
 * SPDX-License-Identifier: MIT
 */

/*
 * This is the actual DEFLATE decompression routine, lifted out of
 * deflate_decompress.c so that it can be compiled multiple times with different
 * target instruction sets.
 */

#ifndef ATTRIBUTES
#  define ATTRIBUTES
#endif
#ifndef EXTRACT_VARBITS
#  define EXTRACT_VARBITS(word, count)  ((word) & BITMASK(count))
#endif
#ifndef EXTRACT_VARBITS8
#  define EXTRACT_VARBITS8(word, count) ((word) & BITMASK((u8)(count)))
#endif

#ifndef _DEF_bitstream_byte_restore
#define _DEF_bitstream_byte_restore() do{   \
        bitsleft = (u8)bitsleft;            \
        SAFETY_CHECK(overread_count <= (bitsleft >> 3));    \
        in_next -= (bitsleft >> 3) - overread_count; } while(0)
#endif

#ifndef _DEF_bitstream_byte_align
#define _DEF_bitstream_byte_align() do{ \
        _DEF_bitstream_byte_restore();  \
        overread_count = 0; \
        bitbuf = 0;         \
        bitsleft = 0; } while(0)
#endif

static ATTRIBUTES MAYBE_UNUSED enum libdeflate_result
FUNCNAME(struct libdeflate_decompressor * restrict d,
     const void * restrict in, size_t in_nbytes,
     void * restrict out, size_t in_dict_nbytes, size_t out_nbytes_avail,
     size_t *actual_in_nbytes_ret, size_t *actual_out_nbytes_ret,
     enum libdeflate_decompress_stop_by stop_type)
{
    u8 *out_next = ((u8 *)out) + in_dict_nbytes;
    u8 * const out_end = out_next + out_nbytes_avail;
    u8 * const out_fastloop_end = out_end - MIN(out_nbytes_avail, FASTLOOP_MAX_BYTES_WRITTEN);

    /* Input bitstream state; see deflate_decompress.c for documentation */
    const u8 *in_next = in;
    const u8 * const in_end = in_next + in_nbytes;
    const u8 * const in_fastloop_end = in_end - MIN(in_nbytes, FASTLOOP_MAX_BYTES_READ);
    bitbuf_t bitbuf = d->bitbuf_back;
    bitbuf_t saved_bitbuf;
    u32 bitsleft = d->bitsleft_back;
    size_t overread_count = 0;

    bool is_final_block;
    unsigned block_type;
    bitbuf_t litlen_tablemask;
    u32 entry;

    decompress_block_init(d);

    static_assert(CAN_CONSUME(1 + 2 + 5 + 5 + 4 + 3));
next_block:
    /* Starting to read the next block */
    REFILL_BITS();

    /* BFINAL: 1 bit */
    is_final_block = bitbuf & BITMASK(1);

    /* BTYPE: 2 bits */
    block_type = (bitbuf >> 1) & BITMASK(2);

    if (block_type == DEFLATE_BLOCKTYPE_DYNAMIC_HUFFMAN) {
        /* The order in which precode lengths are stored */
        static const u8 deflate_precode_lens_permutation[DEFLATE_NUM_PRECODE_SYMS] = {
            16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15
        };

        unsigned num_litlen_syms;
        unsigned num_offset_syms;
        unsigned num_explicit_precode_lens;
        unsigned i;

        /* Read the codeword length counts. */

        static_assert(DEFLATE_NUM_LITLEN_SYMS == 257 + BITMASK(5));
        num_litlen_syms = 257 + ((bitbuf >> 3) & BITMASK(5));

        static_assert(DEFLATE_NUM_OFFSET_SYMS == 1 + BITMASK(5));
        num_offset_syms = 1 + ((bitbuf >> 8) & BITMASK(5));

        static_assert(DEFLATE_NUM_PRECODE_SYMS == 4 + BITMASK(4));
        num_explicit_precode_lens = 4 + ((bitbuf >> 13) & BITMASK(4));

        d->static_codes_loaded = false;

        /*
         * Read the precode codeword lengths.
         *
         * A 64-bit bitbuffer is just one bit too small to hold the
         * maximum number of precode lens, so to minimize branches we
         * merge one len with the previous fields.
         */
        static_assert(DEFLATE_MAX_PRE_CODEWORD_LEN == (1 << 3) - 1);
        if (CAN_CONSUME(3 * (DEFLATE_NUM_PRECODE_SYMS - 1))) {
            d->u.precode_lens[deflate_precode_lens_permutation[0]] =
                (bitbuf >> 17) & BITMASK(3);
            bitbuf >>= 20;
            bitsleft -= 20;
            REFILL_BITS();
            i = 1;
            do {
                d->u.precode_lens[deflate_precode_lens_permutation[i]] =
                    bitbuf & BITMASK(3);
                bitbuf >>= 3;
                bitsleft -= 3;
            } while (++i < num_explicit_precode_lens);
        } else {
            bitbuf >>= 17;
            bitsleft -= 17;
            i = 0;
            do {
                if ((u8)bitsleft < 3)
                    REFILL_BITS();
                d->u.precode_lens[deflate_precode_lens_permutation[i]] =
                    bitbuf & BITMASK(3);
                bitbuf >>= 3;
                bitsleft -= 3;
            } while (++i < num_explicit_precode_lens);
        }
        for (; i < DEFLATE_NUM_PRECODE_SYMS; i++)
            d->u.precode_lens[deflate_precode_lens_permutation[i]] = 0;

        /* Build the decode table for the precode. */
        SAFETY_CHECK(build_precode_decode_table(d));

        /* Decode the litlen and offset codeword lengths. */
        i = 0;
        do {
            unsigned presym;
            u8 rep_val;

            if ((u8)bitsleft < DEFLATE_MAX_PRE_CODEWORD_LEN + 7)
                REFILL_BITS();

            /*
             * The code below assumes that the precode decode table
             * doesn't have any subtables.
             */
            static_assert(PRECODE_TABLEBITS == DEFLATE_MAX_PRE_CODEWORD_LEN);

            /* Decode the next precode symbol. */
            entry = d->u.l.precode_decode_table[
                bitbuf & BITMASK(DEFLATE_MAX_PRE_CODEWORD_LEN)];
            bitbuf >>= (u8)entry;
            bitsleft -= entry; /* optimization: subtract full entry */
            presym = entry >> 16;

            if (presym < 16) {
                /* Explicit codeword length */
                d->u.l.lens[i++] = presym;
                continue;
            }

            /* Run-length encoded (RLE) codeword lengths */

            /*
             * Note: we don't need to immediately verify that the
             * repeat count doesn't overflow the number of elements,
             * since we've sized the lens array to have enough extra
             * space to allow for the worst-case overrun (138 zeroes
             * when only 1 length was remaining).
             *
             * In the case of the small repeat counts (presyms 16
             * and 17), it is fastest to always write the maximum
             * number of entries.  That gets rid of branches that
             * would otherwise be required.
             *
             * It is not just because of the numerical order that
             * our checks go in the order 'presym < 16', 'presym ==
             * 16', and 'presym == 17'.  For typical data this is
             * ordered from most frequent to least frequent case.
             */
            static_assert(DEFLATE_MAX_LENS_OVERRUN == 138 - 1);

            if (presym == 16) {
                /* Repeat the previous length 3 - 6 times. */
                SAFETY_CHECK(i != 0);
                static_assert(3 + BITMASK(2) == 6);
                unsigned rep_count = 3 + (bitbuf & BITMASK(2));

                rep_val = d->u.l.lens[i - 1];
                bitbuf >>= 2;
                bitsleft -= 2;
                d->u.l.lens[i + 0] = rep_val;
                d->u.l.lens[i + 1] = rep_val;
                d->u.l.lens[i + 2] = rep_val;
                d->u.l.lens[i + 3] = rep_val;
                d->u.l.lens[i + 4] = rep_val;
                d->u.l.lens[i + 5] = rep_val;
                i += rep_count;
            } else if (presym == 17) {
                /* Repeat zero 3 - 10 times. */
                static_assert(3 + BITMASK(3) == 10);
                unsigned rep_count = 3 + (bitbuf & BITMASK(3));

                bitbuf >>= 3;
                bitsleft -= 3;
                d->u.l.lens[i + 0] = 0;
                d->u.l.lens[i + 1] = 0;
                d->u.l.lens[i + 2] = 0;
                d->u.l.lens[i + 3] = 0;
                d->u.l.lens[i + 4] = 0;
                d->u.l.lens[i + 5] = 0;
                d->u.l.lens[i + 6] = 0;
                d->u.l.lens[i + 7] = 0;
                d->u.l.lens[i + 8] = 0;
                d->u.l.lens[i + 9] = 0;
                i += rep_count;
            } else {
                /* Repeat zero 11 - 138 times. */
                static_assert(11 + BITMASK(7) == 138);
                unsigned rep_count = 11 + (bitbuf & BITMASK(7));

                bitbuf >>= 7;
                bitsleft -= 7;
                memset(&d->u.l.lens[i], 0,
                       rep_count * sizeof(d->u.l.lens[i]));
                i += rep_count;
            }
        } while (i < num_litlen_syms + num_offset_syms);

        SAFETY_CHECK(i == num_litlen_syms + num_offset_syms);
        if (!(i == num_litlen_syms + num_offset_syms &&
              build_offset_decode_table(d, num_litlen_syms, num_offset_syms) &&
              build_litlen_decode_table(d, num_litlen_syms, num_offset_syms))) {
            return LIBDEFLATE_BAD_DATA;
        }
    } else if (block_type == DEFLATE_BLOCKTYPE_UNCOMPRESSED) {
        u16 len, nlen;

        /*
         * Uncompressed block: copy 'len' bytes literally from the input
         * buffer to the output buffer.
         */

        bitsleft -= 3; /* for BTYPE and BFINAL */

        /*
         * Align the bitstream to the next byte boundary.  This means
         * the next byte boundary as if we were reading a byte at a
         * time.  Therefore, we have to rewind 'in_next' by any bytes
         * that have been refilled but not actually consumed yet (not
         * counting overread bytes, which don't increment 'in_next').
         */
        _DEF_bitstream_byte_align();

        SAFETY_CHECK(in_end - in_next >= 4);
        len = get_unaligned_le16(in_next);
        nlen = get_unaligned_le16(in_next + 2);
        in_next += 4;

        SAFETY_CHECK(len == (u16)~nlen);
        if (unlikely(len > out_end - out_next)) {
            return LIBDEFLATE_INSUFFICIENT_SPACE;
        }
        SAFETY_CHECK(len <= in_end - in_next);

        memcpy(out_next, in_next, len);
        in_next += len;
        out_next += len;

        goto block_done;
    } else if (block_type == DEFLATE_BLOCKTYPE_STATIC_HUFFMAN) {
        /*
         * Static Huffman block: build the decode tables for the static
         * codes.  Skip doing so if the tables are already set up from
         * an earlier static block; this speeds up decompression of
         * degenerate input of many empty or very short static blocks.
         *
         * Afterwards, the remainder is the same as decompressing a
         * dynamic Huffman block.
         */

        bitbuf >>= 3; /* for BTYPE and BFINAL */
        bitsleft -= 3;

        if (!d->static_codes_loaded) {
            huffman_build_static_decode_tables(d);
        }
    } else {
        return LIBDEFLATE_BAD_DATA;
    }

    /*
     * Decompressing a Huffman block (either dynamic or static)
     */
    litlen_tablemask = BITMASK(d->litlen_tablebits);

    /*
     * This is the "fastloop" for decoding literals and matches.  It does
     * bounds checks on in_next and out_next in the loop conditions so that
     * additional bounds checks aren't needed inside the loop body.
     *
     * To reduce latency, the bitbuffer is refilled and the next litlen
     * decode table entry is preloaded before each loop iteration.
     */
    if (in_next >= in_fastloop_end || out_next >= out_fastloop_end)
        goto generic_loop;
    REFILL_BITS_IN_FASTLOOP();
    entry = d->u.litlen_decode_table[bitbuf & litlen_tablemask];
    do {
        u32 length, offset, lit;

        /*
         * Consume the bits for the litlen decode table entry.  Save the
         * original bitbuf for later, in case the extra match length
         * bits need to be extracted from it.
         */
        saved_bitbuf = bitbuf;
        bitbuf >>= (u8)entry;
        bitsleft -= entry; /* optimization: subtract full entry */

        /*
         * Begin by checking for a "fast" literal, i.e. a literal that
         * doesn't need a subtable.
         */
        if (entry & HUFFDEC_LITERAL) {
            /*
             * On 64-bit platforms, we decode up to 2 extra fast
             * literals in addition to the primary item, as this
             * increases performance and still leaves enough bits
             * remaining for what follows.  We could actually do 3,
             * assuming LITLEN_TABLEBITS=11, but that actually
             * decreases performance slightly (perhaps by messing
             * with the branch prediction of the conditional refill
             * that happens later while decoding the match offset).
             *
             * Note: the definitions of FASTLOOP_MAX_BYTES_WRITTEN
             * and FASTLOOP_MAX_BYTES_READ need to be updated if the
             * number of extra literals decoded here is changed.
             */
            if (/* enough bits for 2 fast literals + length + offset preload? */
                CAN_CONSUME_AND_THEN_PRELOAD(2 * LITLEN_TABLEBITS +
                             LENGTH_MAXBITS,
                             OFFSET_TABLEBITS) &&
                /* enough bits for 2 fast literals + slow literal + litlen preload? */
                CAN_CONSUME_AND_THEN_PRELOAD(2 * LITLEN_TABLEBITS +
                             DEFLATE_MAX_LITLEN_CODEWORD_LEN,
                             LITLEN_TABLEBITS)) {
                /* 1st extra fast literal */
                lit = entry >> 16;
                entry = d->u.litlen_decode_table[bitbuf & litlen_tablemask];
                saved_bitbuf = bitbuf;
                bitbuf >>= (u8)entry;
                bitsleft -= entry;
                *out_next++ = lit;
                if (entry & HUFFDEC_LITERAL) {
                    /* 2nd extra fast literal */
                    lit = entry >> 16;
                    entry = d->u.litlen_decode_table[bitbuf & litlen_tablemask];
                    saved_bitbuf = bitbuf;
                    bitbuf >>= (u8)entry;
                    bitsleft -= entry;
                    *out_next++ = lit;
                    if (entry & HUFFDEC_LITERAL) {
                        /*
                         * Another fast literal, but
                         * this one is in lieu of the
                         * primary item, so it doesn't
                         * count as one of the extras.
                         */
                        lit = entry >> 16;
                        entry = d->u.litlen_decode_table[bitbuf & litlen_tablemask];
                        REFILL_BITS_IN_FASTLOOP();
                        *out_next++ = lit;
                        continue;
                    }
                }
            } else {
                /*
                 * Decode a literal.  While doing so, preload
                 * the next litlen decode table entry and refill
                 * the bitbuffer.  To reduce latency, we've
                 * arranged for there to be enough "preloadable"
                 * bits remaining to do the table preload
                 * independently of the refill.
                 */
                static_assert(CAN_CONSUME_AND_THEN_PRELOAD(LITLEN_TABLEBITS, LITLEN_TABLEBITS));
                lit = entry >> 16;
                entry = d->u.litlen_decode_table[bitbuf & litlen_tablemask];
                REFILL_BITS_IN_FASTLOOP();
                *out_next++ = lit;
                continue;
            }
        }

        /*
         * It's not a literal entry, so it can be a length entry, a
         * subtable pointer entry, or an end-of-block entry.  Detect the
         * two unlikely cases by testing the HUFFDEC_EXCEPTIONAL flag.
         */
        if (unlikely(entry & HUFFDEC_EXCEPTIONAL)) {
            /* Subtable pointer or end-of-block entry */

            if (unlikely(entry & HUFFDEC_END_OF_BLOCK))
                goto block_done;

            /*
             * A subtable is required.  Load and consume the
             * subtable entry.  The subtable entry can be of any
             * type: literal, length, or end-of-block.
             */
            entry = d->u.litlen_decode_table[(entry >> 16) +
                EXTRACT_VARBITS(bitbuf, (entry >> 8) & 0x3F)];
            saved_bitbuf = bitbuf;
            bitbuf >>= (u8)entry;
            bitsleft -= entry;

            /*
             * 32-bit platforms that use the byte-at-a-time refill
             * method have to do a refill here for there to always
             * be enough bits to decode a literal that requires a
             * subtable, then preload the next litlen decode table
             * entry; or to decode a match length that requires a
             * subtable, then preload the offset decode table entry.
             */
            if (!CAN_CONSUME_AND_THEN_PRELOAD(DEFLATE_MAX_LITLEN_CODEWORD_LEN, LITLEN_TABLEBITS) ||
                !CAN_CONSUME_AND_THEN_PRELOAD(LENGTH_MAXBITS, OFFSET_TABLEBITS))
                REFILL_BITS_IN_FASTLOOP();
            if (entry & HUFFDEC_LITERAL) {
                /* Decode a literal that required a subtable. */
                lit = entry >> 16;
                entry = d->u.litlen_decode_table[bitbuf & litlen_tablemask];
                REFILL_BITS_IN_FASTLOOP();
                *out_next++ = lit;
                continue;
            }
            if (unlikely(entry & HUFFDEC_END_OF_BLOCK))
                goto block_done;
            /* Else, it's a length that required a subtable. */
        }

        /*
         * Decode the match length: the length base value associated
         * with the litlen symbol (which we extract from the decode
         * table entry), plus the extra length bits.  We don't need to
         * consume the extra length bits here, as they were included in
         * the bits consumed by the entry earlier.  We also don't need
         * to check for too-long matches here, as this is inside the
         * fastloop where it's already been verified that the output
         * buffer has enough space remaining to copy a max-length match.
         */
        length = entry >> 16;
        length += EXTRACT_VARBITS8(saved_bitbuf, entry) >> (u8)(entry >> 8);

        /*
         * Decode the match offset.  There are enough "preloadable" bits
         * remaining to preload the offset decode table entry, but a
         * refill might be needed before consuming it.
         */
        static_assert(CAN_CONSUME_AND_THEN_PRELOAD(LENGTH_MAXFASTBITS, OFFSET_TABLEBITS));
        entry = d->offset_decode_table[bitbuf & BITMASK(OFFSET_TABLEBITS)];
        if (CAN_CONSUME_AND_THEN_PRELOAD(OFFSET_MAXBITS,
                         LITLEN_TABLEBITS)) {
            /*
             * Decoding a match offset on a 64-bit platform.  We may
             * need to refill once, but then we can decode the whole
             * offset and preload the next litlen table entry.
             */
            if (unlikely(entry & HUFFDEC_EXCEPTIONAL)) {
                /* Offset codeword requires a subtable */
                if (unlikely((u8)bitsleft < OFFSET_MAXBITS +
                         LITLEN_TABLEBITS - PRELOAD_SLACK))
                    REFILL_BITS_IN_FASTLOOP();
                bitbuf >>= OFFSET_TABLEBITS;
                bitsleft -= OFFSET_TABLEBITS;
                entry = d->offset_decode_table[(entry >> 16) +
                    EXTRACT_VARBITS(bitbuf, (entry >> 8) & 0x3F)];
            } else if (unlikely((u8)bitsleft < OFFSET_MAXFASTBITS +
                        LITLEN_TABLEBITS - PRELOAD_SLACK))
                REFILL_BITS_IN_FASTLOOP();
        } else {
            /* Decoding a match offset on a 32-bit platform */
            REFILL_BITS_IN_FASTLOOP();
            if (unlikely(entry & HUFFDEC_EXCEPTIONAL)) {
                /* Offset codeword requires a subtable */
                bitbuf >>= OFFSET_TABLEBITS;
                bitsleft -= OFFSET_TABLEBITS;
                entry = d->offset_decode_table[(entry >> 16) +
                    EXTRACT_VARBITS(bitbuf, (entry >> 8) & 0x3F)];
                REFILL_BITS_IN_FASTLOOP();
                /* No further refill needed before extra bits */
                static_assert(CAN_CONSUME(
                    OFFSET_MAXBITS - OFFSET_TABLEBITS));
            } else {
                /* No refill needed before extra bits */
                static_assert(CAN_CONSUME(OFFSET_MAXFASTBITS));
            }
        }
        saved_bitbuf = bitbuf;
        bitbuf >>= (u8)entry;
        bitsleft -= entry; /* optimization: subtract full entry */
        offset = entry >> 16;
        offset += EXTRACT_VARBITS8(saved_bitbuf, entry) >> (u8)(entry >> 8);

        /* Validate the match offset; needed even in the fastloop. */
        SAFETY_CHECK(offset <= out_next - (const u8 *)out);

        /*
         * Before starting to issue the instructions to copy the match,
         * refill the bitbuffer and preload the litlen decode table
         * entry for the next loop iteration.  This can increase
         * performance by allowing the latency of the match copy to
         * overlap with these other operations.  To further reduce
         * latency, we've arranged for there to be enough bits remaining
         * to do the table preload independently of the refill, except
         * on 32-bit platforms using the byte-at-a-time refill method.
         */
        if (!CAN_CONSUME_AND_THEN_PRELOAD(
            MAX(OFFSET_MAXBITS - OFFSET_TABLEBITS,
                OFFSET_MAXFASTBITS),
            LITLEN_TABLEBITS) &&
            unlikely((u8)bitsleft < LITLEN_TABLEBITS - PRELOAD_SLACK))
            REFILL_BITS_IN_FASTLOOP();
        entry = d->u.litlen_decode_table[bitbuf & litlen_tablemask];
        REFILL_BITS_IN_FASTLOOP();

        fast_copy_match(out_next, out_next - offset, length, offset);
        out_next += length;
    } while (in_next < in_fastloop_end && out_next < out_fastloop_end);

    /*
     * This is the generic loop for decoding literals and matches.  This
     * handles cases where in_next and out_next are close to the end of
     * their respective buffers.  Usually this loop isn't performance-
     * critical, as most time is spent in the fastloop above instead.  We
     * therefore omit some optimizations here in favor of smaller code.
     */
generic_loop:
    for (;;) {
        u32 length, offset;

        REFILL_BITS();
        entry = d->u.litlen_decode_table[bitbuf & litlen_tablemask];
        saved_bitbuf = bitbuf;
        bitbuf >>= (u8)entry;
        bitsleft -= entry;
        if (unlikely(entry & HUFFDEC_SUBTABLE_POINTER)) {
            entry = d->u.litlen_decode_table[(entry >> 16) +
                    EXTRACT_VARBITS(bitbuf, (entry >> 8) & 0x3F)];
            saved_bitbuf = bitbuf;
            bitbuf >>= (u8)entry;
            bitsleft -= entry;
        }
        length = entry >> 16;
        if (entry & HUFFDEC_LITERAL) {
            if (unlikely(out_next == out_end)) {
                return LIBDEFLATE_INSUFFICIENT_SPACE;
            }
            *out_next++ = length;
            continue;
        }
        if (unlikely(entry & HUFFDEC_END_OF_BLOCK)) {
            goto block_done;
        }
        length += EXTRACT_VARBITS8(saved_bitbuf, entry) >> (u8)(entry >> 8);
        if (unlikely(length > out_end - out_next)) {
            return LIBDEFLATE_INSUFFICIENT_SPACE;
        }

        if (!CAN_CONSUME(LENGTH_MAXBITS + OFFSET_MAXBITS))
            REFILL_BITS();
        entry = d->offset_decode_table[bitbuf & BITMASK(OFFSET_TABLEBITS)];
        if (unlikely(entry & HUFFDEC_EXCEPTIONAL)) {
            bitbuf >>= OFFSET_TABLEBITS;
            bitsleft -= OFFSET_TABLEBITS;
            entry = d->offset_decode_table[(entry >> 16) +
                    EXTRACT_VARBITS(bitbuf, (entry >> 8) & 0x3F)];
            if (!CAN_CONSUME(OFFSET_MAXBITS))
                REFILL_BITS();
        }
        offset = entry >> 16;
        offset += EXTRACT_VARBITS8(bitbuf, entry) >> (u8)(entry >> 8);
        bitbuf >>= (u8)entry;
        bitsleft -= entry;

        SAFETY_CHECK(offset <= out_next - (const u8 *)out);
        generic_copy(out_next, out_next - offset, length);
        out_next += length;
    }

    enum libdeflate_result rc;
block_done:
    /* Finished decoding a block */

    if (is_final_block) {
        _DEF_bitstream_byte_align();
        rc = LIBDEFLATE_SUCCESS;
    } else {
        switch (stop_type) {
        case LIBDEFLATE_STOP_BY_FINAL_BLOCK:
            goto next_block;
        case LIBDEFLATE_STOP_BY_ANY_BLOCK:
            break;
        case LIBDEFLATE_STOP_BY_ANY_BLOCK_AND_FULL_INPUT:
            if (in_next - ((((u8)bitsleft) >> 3) - overread_count) < in_end)
                goto next_block;
            break;
        case LIBDEFLATE_STOP_BY_ANY_BLOCK_AND_FULL_OUTPUT:
            if (out_next < out_end)
                goto next_block;
            break;
        case LIBDEFLATE_STOP_BY_ANY_BLOCK_AND_FULL_OUTPUT_AND_IN_BYTE_ALIGN:
            if ((out_next < out_end) | ((bitsleft & 7) != 0))
                goto next_block;
            break;
        }

        _DEF_bitstream_byte_restore();
        //backup for next block
        d->bitsleft_back = bitsleft & 7;
        d->bitbuf_back = bitbuf & ((1 << (bitsleft & 7)) - 1);

        rc = LIBDEFLATE_MORE;
    }

    /* Optionally return the actual number of bytes consumed. */
    if (actual_in_nbytes_ret) {
        *actual_in_nbytes_ret = in_next - (u8 *)in;
    }

    /* Optionally return the actual number of bytes written. */
    if (actual_out_nbytes_ret) {
        *actual_out_nbytes_ret = out_next - (((u8 *)out) + in_dict_nbytes);
    } else {
        if (out_next != out_end)
            rc = LIBDEFLATE_SHORT_OUTPUT;
    }
    return rc;
}

#undef FUNCNAME
#undef ATTRIBUTES
#undef EXTRACT_VARBITS
#undef EXTRACT_VARBITS8
