/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
/*
 * RFE the symbol is here twice because LLVM on Darwin can't find fast_memcmp and Linux can't find _fast_memcmp.
 * Moreover, alias is not supported in clang on Darwin.
 */
    .globl _fast_memcmp
    .globl fast_memcmp
    .p2align 2
_fast_memcmp:
fast_memcmp:
    .cfi_startproc
    ldrb    w8, [x0]
    ldrb    w9, [x1]
    cmp     w8, w9
    b.ne    LB_4
    cbz     x2, LB_5
    cmp     x2, #8
    b.hs    LB_6
    mov     x8, #0
    mov     w9, #0
    b       LB_15
LB_4:
    and     w0, wzr, #0x1
    ret
LB_5:
    mov     w8, #1
    and     w0, w8, #0x1
    ret
LB_6:
    cmp     x2, #64
    b.hs    LB_8
    mov     w9, #0
    mov     x8, #0
    b       LB_12
LB_8:
    and     x8, x2, #0xffffffffffffffc0
    add     x9, x0, #32
    add     x10, x1, #32
    movi    v0.2d, #0000000000000000
    mov     x11, x8
    movi    v1.2d, #0000000000000000
    movi    v2.2d, #0000000000000000
    movi    v3.2d, #0000000000000000
LB_9:
    ldp     q4, q5, [x9, #-32]
    ldp     q6, q7, [x9], #64
    ldp     q16, q17, [x10, #-32]
    ldp     q18, q19, [x10], #64
    cmeq    v4.16b, v4.16b, v16.16b
    cmeq    v5.16b, v5.16b, v17.16b
    cmeq    v6.16b, v6.16b, v18.16b
    cmeq    v7.16b, v7.16b, v19.16b
    orn     v0.16b, v0.16b, v4.16b
    orn     v1.16b, v1.16b, v5.16b
    orn     v2.16b, v2.16b, v6.16b
    orn     v3.16b, v3.16b, v7.16b
    subs    x11, x11, #64
    b.ne    LB_9
    orr     v0.16b, v1.16b, v0.16b
    orr     v1.16b, v3.16b, v2.16b
    orr     v0.16b, v1.16b, v0.16b
    shl     v0.16b, v0.16b, #7
    cmlt    v0.16b, v0.16b, #0
    umaxv   b0, v0.16b
    fmov    w9, s0
    and     w9, w9, #0x1
    cmp     x8, x2
    b.eq    LB_17
    tst     x2, #0x38
    b.eq    LB_15
LB_12:
    mov     x11, x8
    and     x8, x2, #0xfffffffffffffff8
    movi    v0.2d, #0000000000000000
    mov     v0.b[0], w9
    add     x9, x0, x11
    add     x10, x1, x11
    sub     x11, x11, x8
LB_13:
    ldr     d1, [x9], #8
    ldr     d2, [x10], #8
    cmeq    v1.8b, v1.8b, v2.8b
    orn     v0.8b, v0.8b, v1.8b
    adds    x11, x11, #8
    b.ne    LB_13
    shl     v0.8b, v0.8b, #7
    cmlt    v0.8b, v0.8b, #0
    umaxv   b0, v0.8b
    fmov    w9, s0
    and     w9, w9, #0x1
    cmp     x8, x2
    b.eq    LB_17
LB_15:
    sub     x10, x2, x8
    add     x11, x1, x8
    add     x8, x0, x8
LB_16:
    ldrb    w12, [x8], #1
    ldrb    w13, [x11], #1
    cmp     w12, w13
    cset    w12, ne
    orr     w9, w9, w12
    subs    x10, x10, #1
    b.ne    LB_16
LB_17:
    eor     w8, w9, #0x1
    and     w0, w8, #0x1
    ret
    .cfi_endproc
