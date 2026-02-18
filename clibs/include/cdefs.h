/*
 * Copyright (c) 2020-2026 SAULX
 * SPDX-License-Identifier: BSD-2-Clause
 */

#pragma once
#ifndef _UTIL_CDEFS_H_
#define _UTIL_CDEFS_H_

#if __STDC_VERSION__ < 202311L
#define static_assert _Static_assert
#if defined(__clang__) && !defined(unreachable)
#define unreachable __builtin_unreachable
#endif
#endif

#if defined(__linux__)
/**
 * Force linking against a specific version of a GLIBC symbol.
 * Use this at the top-level of a source file.
 */
#define GLIBC_COMPAT_SYMBOL(SYM, VER) \
    __asm__(".symver " #SYM "," #SYM "@GLIBC_" #VER);
#else
#define GLIBC_COMPAT_SYMBOL(SYM, VER)
#endif

#if defined(__GNUC__) && !defined(__clang__)
/**
 * The char array isn't a NUL terminated C-string.
 * Using this attribute will help to get better warnings at compilation time.
 */
#define __nonstring __attribute__((nonstring))
/**
 * Annotate a pure function.
 * The function has no side effects and the value returned depends on the
 * arguments and the state of global variables. Therefore it is safe for
 * the optimizer to eliminate repeated calls with unchanged arguments.
 */
#define __purefn __attribute__((pure))
/**
 * Annotate a const function.
 * The return value of the function is solely a function of its arguments,
 * and if any of the arguments are pointers, then the pointers are not be
 * dereferenced.
 */
#define __constfn __attribute__((const))
#else
#define __nonstring
#define __purefn
#define __constfn
#endif

/**
 * The last argument to a function is expected to be nullptr.
 */
#define __sentinel __attribute__((sentinel))

#if __has_c_attribute(noreturn)
#define __noreturn [[noreturn]]
#else
#define __noreturn __attribute__((noreturn))
#endif

#define __transparent_union __attribute__((__transparent_union__))

#define CONCATENATE(arg1, arg2)   CONCATENATE1(arg1, arg2)
#define CONCATENATE1(arg1, arg2)  CONCATENATE2(arg1, arg2)
#define CONCATENATE2(arg1, arg2)  arg1##arg2

#define UTIL_NARG(...) \
    UTIL_NARG_(__VA_ARGS__, UTIL_RSEQ_N())
#define UTIL_NARG_(...) UTIL_ARG_N(__VA_ARGS__)
#define UTIL_ARG_N( \
     _1,  _2,  _3,  _4,  _5,  _6,  _7,  _8,  _9, _10, _11, _12, _13, _14, \
    _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, \
    _29, _30, _31, _32, _33, _34, _35, _36, _37, _38, _39, _40, _41, _42, \
    _43, _44, _45, _46, _47, _48, _49, _50, _51, _52, _53, _54, _55, _56, \
    _57, _58, _59, _60, _61, _62, _63, N, ...) N
# define UTIL_RSEQ_N() \
    63, 62, 61, 60, 59, 58, 57, 56, 55, 54, 53, 52, 51, 50, 49, 48, 47, \
    46, 45, 44, 43, 42, 41, 40, 39, 38, 37, 36, 35, 34, 33, 32, 31, 30, \
    29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, \
    12, 11, 10,  9,  8,  7,  6,  5,  4,  3,  2,  1,  0

#define _S__LINE__S(x) #x
#define _S__LINE__S2(x) _S__LINE__S(x)
/**
 * Current line number as a string.
 */
#define S__LINE__ _S__LINE__S2(__LINE__)

#ifndef __GLOBL1
#define  __GLOBL1(sym) __asm__(".globl " #sym)
/**
 * Make the symbol `sym` visible to the linker.
 */
#define  __GLOBL(sym) __GLOBL1(sym)
#endif

#ifndef __weak_sym
/**
 * Emit the declaration as a weak symbol.
 * A weak symbol can be overridden at linking. This is particularly useful for
 * functions.
 *
 */
#define __weak_sym __attribute__((weak))
#endif

#ifndef __used
/**
 * The function or variable is used.
 * Inform the compiler that the fuction is used and the code must be emitted
 * even if the function name is not referenced.
 */
#define __used __attribute__((__used__))
#endif

#ifndef __unused
/**
 * The function or variable is unused on purpose.
 */
#define __unused __attribute__((__unused__))
#endif

#ifndef __section
/**
 * Store the variable or function in a named section.
 */
#define __section(x) __attribute__((__section__(x)))
#endif

#if defined(__APPLE__)
#define __lazy_alloc_glob
#else
/**
 * Lazy alloc global variable.
 * On many system (especially Linux) user defined sections are not zeroed on
 * startup and thus implicitly neither allocated until accessed. This allows
 * us to create global variables that are allocated lazily.
 */
#define __lazy_alloc_glob __attribute__((__section__("lazy")))
#endif

/**
 * A function that must be called before `main()`.
 * The function is called automatically before executing `main()`.
 */
#define __constructor   __attribute__((constructor))

/**
 * A function that must be called after `main()` exits.
 * The function is called automatically after `main()` exits.
 */
#define __destructor    __attribute__((destructor))

#ifndef __hot
/**
 * Inform the compiler that the function is a hotspot.
 * Hot functions might be placed closely together in memory to improve locality.
 */
#define __hot __attribute__((hot))
#endif

#ifndef __cold
/**
 * Inform the compiler that the function is unlikely to be executed.
 */
#define __cold __attribute__((cold))
#endif

#ifndef __packed
/**
 * Use the minimum required memory to represent the type.
 * The enum, union, structure, or a structure member should have the smallest
 * possible alignment.
 */
#define __packed __attribute__((packed))
#endif

#ifndef __designated_init
#if __has_attribute(__designated_init__)
/**
 * Must use a designated initializer with a struct.
 */
#define __designated_init __attribute__((__designated_init__))
#else
#define __designated_init
#endif
#endif

#ifndef __flag_enum
/**
 * enum used as flags.
 */
#define __flag_enum __attribute__((flag_enum))
#endif

#ifndef __counted_by
#if __has_attribute(__counted_by__)
/**
 * struct foo {
 *     unsigned int len;
 *     char buf[] __counted_by(len);
 * };
 * *__builtin_counted_by_ref(p->puf) = len;
 * __builtin_dynamic_object_size(p->buf) == p->len * sizeof(*p->buf);
 */
#define __counted_by(member) __attribute__((__counted_by__(member)))
#else
#define __counted_by(member)
#endif
#endif

#ifndef __pcounted_by
#if __has_attribute(__counted_by__) && \
    !defined(__clang__) && \
    (__GNUC__ >= 14 && __GNUC_MINOR__ > 2)
/**
 * struct foo {
 *     unsigned int len;
 *     char *buf __pcounted_by(len);
 * };
 * *__builtin_counted_by_ref(p->puf) = len;
 * __builtin_dynamic_object_size(p->buf) == p->len * sizeof(*p->buf);
 */
#define __pcounted_by(member) __attribute__((__counted_by__(member)))
#else
#define __pcounted_by(member)
#endif
#endif

/* This should come with C23 */
#ifndef alignas
#define alignas(x) _Alignas(x)
#endif

/* This should come with C23 */
#ifndef alignof
#define alignof(x) _Alignof(x)
#endif

/**
 * It's likely that `x` is always truthy in runtime.
 */
#define likely(x)   __builtin_expect(!!(x), 1)
#define unlikely(x) __builtin_expect(!!(x), 0)

#if __has_builtin(__builtin_speculation_safe_value)
#define speculation_safe_value(x) __builtin_speculation_safe_value(x)
#else
#define speculation_safe_value(x) x
#endif

#ifndef assume
#define assume(expr) __attribute__((assume(expr)))
#endif

#define same_type(a, b) __builtin_types_compatible_p(typeof(a), typeof(b))

/**
 * Statically assert that VAR is compatible with the type TYPE.
 */
#define ASSERT_TYPE(TYPE, VAR) \
    static_assert(__builtin_types_compatible_p(TYPE, typeof(VAR)))

/**
 * Returns the smaller of the given values.
 */
#define min(a, b) \
    ({ __typeof__ (a) _a = (a); \
       __typeof__ (b) _b = (b); \
       _a < _b ? _a : _b; })

/**
 * Returns the greater of the given values.
 */
#define max(a, b) \
    ({ __typeof__ (a) _a = (a); \
      __typeof__ (b) _b = (b); \
      _a > _b ? _a : _b; })

/**
 * Get the struct that contains `m`.
 * This macro can be only used if we know for certain that `x` is a pointer to
 * the member `m` in type `s`.
 * @param x is a pointer to the member `m` in a struct of type `s`.
 * @param s is a struct type.
 * @param m is the name of the member in `s`.
 */
#define containerof(x, s, m) ({                     \
        const __typeof(((s *)0)->m) *__x = (x);     \
        ((s *)((uint8_t *)(__x) - offsetof(s, m))); \
})

/**
 * Get the number of elements in an array.
 */
#define num_elem(x) (sizeof(x) / sizeof(*(x)))

/**
 * Size of struct field.
 */
#define typeof_field(t, f) typeof(((t*)0)->f)

/**
 * Size of struct field.
 */
#define sizeof_field(t, f) (sizeof(((t*)0)->f))

/**
 * Size of a struct with its flexible array member.
 */
#define sizeof_wflex(t, f, count) \
    max(sizeof(t), offsetof(t, f[0]) + (count) * sizeof(((t*)0)->f[0]))

/**
 * Check if pointer has a const qualifier.
 */
#define IS_POINTER_CONST(P) \
    _Generic(1 ? (P) : (void *)(P), \
            void const *: 1, \
            default : 0)

/**
 * Static ternary if.
 * Selects either T or E depending on P.
 */
#define STATIC_IF(P, T, E) \
    _Generic (&(char [!!(P) + 1]) {0}, \
            char (*) [2] : T, \
            char (*) [1] : E)

#endif /* _UTIL_CDEFS_H_ */
