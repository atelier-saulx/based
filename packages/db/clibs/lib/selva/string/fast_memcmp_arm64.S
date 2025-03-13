	.globl	_fast_memcmp
	.p2align	2
_fast_memcmp:
	.cfi_startproc
/* %bb.0: */
	cbz	x2, LBB0_3
/* %bb.1: */
	cmp	x2, #8
	b.hs	LBB0_4
/* %bb.2: */
	mov	x8, #0
	mov	w9, #0
	b	LBB0_13
LBB0_3:
	mov	w8, #1
	and	w0, w8, #0x1
	ret
LBB0_4:
	cmp	x2, #64
	b.hs	LBB0_6
/* %bb.5: */
	mov	w9, #0
	mov	x8, #0
	b	LBB0_10
LBB0_6:
	and	x8, x2, #0xffffffffffffffc0
	add	x9, x0, #32
	add	x10, x1, #32
	movi v0.2d, #0000000000000000
	mov	x11, x8
	movi v1.2d, #0000000000000000
	movi v2.2d, #0000000000000000
	movi v3.2d, #0000000000000000
LBB0_7:
	ldp	q4, q5, [x9, #-32]
	ldp	q6, q7, [x9], #64
	ldp	q16, q17, [x10, #-32]
	ldp	q18, q19, [x10], #64
	cmeq v4.16b, v4.16b, v16.16b
	cmeq v5.16b, v5.16b, v17.16b
	cmeq v6.16b, v6.16b, v18.16b
	cmeq v7.16b, v7.16b, v19.16b
	orn	v0.16b, v0.16b, v4.16b
	orn	v1.16b, v1.16b, v5.16b
	orn	v2.16b, v2.16b, v6.16b
	orn	v3.16b, v3.16b, v7.16b
	subs	x11, x11, #64
	b.ne	LBB0_7
/* %bb.8: */
	orr	v0.16b, v1.16b, v0.16b
	orr	v1.16b, v3.16b, v2.16b
	orr	v0.16b, v1.16b, v0.16b
	shl	v0.16b, v0.16b, #7
	cmlt	v0.16b, v0.16b, #0
	umaxv	b0, v0.16b
	fmov	w9, s0
	and	w9, w9, #0x1
	cmp	x8, x2
	b.eq	LBB0_15
/* %bb.9: */
	tst	x2, #0x38
	b.eq	LBB0_13
LBB0_10:
	mov	x11, x8
	and	x8, x2, #0xfffffffffffffff8
	movi	v0.2d, #0000000000000000
	mov	v0.b[0], w9
	add	x9, x0, x11
	add	x10, x1, x11
	sub	x11, x11, x8
LBB0_11:
	ldr	d1, [x9], #8
	ldr	d2, [x10], #8
	cmeq	v1.8b, v1.8b, v2.8b
	orn	v0.8b, v0.8b, v1.8b
	adds	x11, x11, #8
	b.ne	LBB0_11
/* %bb.12: */
	shl	v0.8b, v0.8b, #7
	cmlt	v0.8b, v0.8b, #0
	umaxv	b0, v0.8b
	fmov	w9, s0
	and	w9, w9, #0x1
	cmp	x8, x2
	b.eq	LBB0_15
LBB0_13:
	sub	x10, x2, x8
	add	x11, x1, x8
	add	x8, x0, x8
LBB0_14:
	ldrb	w12, [x8], #1
	ldrb	w13, [x11], #1
	cmp	w12, w13
	cset	w12, ne
	orr	w9, w9, w12
	subs	x10, x10, #1
	b.ne	LBB0_14
LBB0_15:
	eor	w8, w9, #0x1
	and	w0, w8, #0x1
	ret
	.cfi_endproc
