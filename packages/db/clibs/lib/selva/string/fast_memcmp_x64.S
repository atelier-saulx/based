/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
/*
 * RFE the symbol is here twice because LLVM on Darwin can't find fast_memcmp and Linux can't find _fast_memcmp.
 * Moreover, alias is not supported in clang on Darwin.
 */
.intel_syntax noprefix
    .globl _fast_memcmp
    .globl fast_memcmp
.LCPI0_0:
    .zero   16,1
_fast_memcmp:
fast_memcmp:
    .cfi_startproc
    test    rdx, rdx
    je      .LB_3
    cmp     rdx, 15
    ja      .LB_5
    xor     ecx, ecx
    xor     eax, eax
    jmp     .LB_14
.LB_3:
    mov     al, 1
    and     al, 1
    ret
.LB_5:
    cmp     rdx, 128
    jae     .LB_7
    xor     ecx, ecx
    xor     eax, eax
    jmp     .LB_11
.LB_7:
    mov     rcx, rdx
    and     rcx, -128
    vpxor   xmm0, xmm0, xmm0
    xor     eax, eax
    vpcmpeqd ymm1, ymm1, ymm1
    vpxor   xmm2, xmm2, xmm2
    vpxor   xmm3, xmm3, xmm3
    vpxor   xmm4, xmm4, xmm4
.LB_8:
    vmovdqu ymm5, ymmword ptr [rdi + rax]
    vmovdqu ymm6, ymmword ptr [rdi + rax + 32]
    vmovdqu ymm7, ymmword ptr [rdi + rax + 64]
    vmovdqu ymm8, ymmword ptr [rdi + rax + 96]
    vpcmpeqb ymm5, ymm5, ymmword ptr [rsi + rax]
    vpxor   ymm5, ymm5, ymm1
    vpor    ymm0, ymm0, ymm5
    vpcmpeqb ymm5, ymm6, ymmword ptr [rsi + rax + 32]
    vpxor   ymm5, ymm5, ymm1
    vpor    ymm2, ymm2, ymm5
    vpcmpeqb ymm5, ymm7, ymmword ptr [rsi + rax + 64]
    vpxor   ymm5, ymm5, ymm1
    vpor    ymm3, ymm3, ymm5
    vpcmpeqb ymm5, ymm8, ymmword ptr [rsi + rax + 96]
    vpxor   ymm5, ymm5, ymm1
    vpor    ymm4, ymm4, ymm5
    sub     rax, -128
    cmp     rcx, rax
    jne     .LB_8
    vpor    ymm0, ymm2, ymm0
    vpor    ymm0, ymm3, ymm0
    vpor    ymm0, ymm4, ymm0
    vpsllw  ymm0, ymm0, 7
    vpmovmskb eax, ymm0
    test    eax, eax
    setne   al
    cmp     rdx, rcx
    je      .LB_16
    test    dl, 112
    je      .LB_14
.LB_11:
    mov     r8, rcx
    mov     rcx, rdx
    and     rcx, -16
    movzx   eax, al
    vmovd   xmm0, eax
    vpcmpeqd xmm1, xmm1, xmm1
.LB_12:
    vmovdqu xmm2, xmmword ptr [rdi + r8]
    vpcmpeqb xmm2, xmm2, xmmword ptr [rsi + r8]
    vpxor   xmm2, xmm2, xmm1
    vpor    xmm0, xmm0, xmm2
    add     r8, 16
    cmp     rcx, r8
    jne     .LB_12
    vptest  xmm0, xmmword ptr [rip + .LCPI0_0]
    setne   al
    jmp     .LB_15
.LB_14:
    movzx   r8d, byte ptr [rdi + rcx]
    cmp     r8b, byte ptr [rsi + rcx]
    setne   r8b
    or      al, r8b
    inc     rcx
.LB_15:
    cmp     rdx, rcx
    jne     .LB_14
.LB_16:
    xor     al, 1
    and     al, 1
    vzeroupper
    ret
    .cfi_endproc
