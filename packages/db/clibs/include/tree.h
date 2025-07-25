/*	$NetBSD: tree.h,v 1.8 2004/03/28 19:38:30 provos Exp $	*/
/*	$OpenBSD: tree.h,v 1.7 2002/10/17 21:51:54 art Exp $	*/
/* $FreeBSD$ */

/*-
 * SPDX-License-Identifier: BSD-2-Clause
 *
 * Copyright 2002 Niels Provos <provos@citi.umich.edu>
 * Copyright (c) 2022-2025 SAULX
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 * IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 * NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#ifndef	_SYS_TREE_H_
#define	_SYS_TREE_H_

#include <stdint.h>

/*
 * This file defines data structures for different types of trees:
 * splay trees and rank-balanced trees.
 *
 * A splay tree is a self-organizing data structure.  Every operation
 * on the tree causes a splay to happen.  The splay moves the requested
 * node to the root of the tree and partly rebalances it.
 *
 * This has the benefit that request locality causes faster lookups as
 * the requested nodes move to the top of the tree.  On the other hand,
 * every lookup causes memory writes.
 *
 * The Balance Theorem bounds the total access time for m operations
 * and n inserts on an initially empty tree as O((m + n)lg n).  The
 * amortized cost for a sequence of m accesses to a splay tree is O(lg n);
 *
 * A rank-balanced tree is a binary search tree with an integer
 * rank-difference as an attribute of each pointer from parent to child.
 * The sum of the rank-differences on any path from a node down to null is
 * the same, and defines the rank of that node. The rank of the null node
 * is -1.
 *
 * Different additional conditions define different sorts of balanced
 * trees, including "red-black" and "AVL" trees.  The set of conditions
 * applied here are the "weak-AVL" conditions of Haeupler, Sen and Tarjan:
 *	- every rank-difference is 1 or 2.
 *	- the rank of any leaf is 1.
 *
 * For historical reasons, rank differences that are even are associated
 * with the color red (Rank-Even-Difference), and the child that a red edge
 * points to is called a red child.
 *
 * Every operation on a rank-balanced tree is bounded as O(lg n).
 * The maximum height of a rank-balanced tree is 2lg (n+1).
 */

#define SPLAY_HEAD(name, type)						\
struct name {								\
	struct type *sph_root; /* root of the tree */			\
}

#define SPLAY_INITIALIZER(root)						\
	{ nullptr }

#define SPLAY_INIT(root) do {						\
	(root)->sph_root = nullptr;					\
} while (/*CONSTCOND*/ 0)

#define SPLAY_ENTRY(type)						\
struct {								\
	struct type *spe_left; /* left element */			\
	struct type *spe_right; /* right element */			\
}

#define SPLAY_LEFT(elm, field)		(elm)->field.spe_left
#define SPLAY_RIGHT(elm, field)		(elm)->field.spe_right
#define SPLAY_ROOT(head)		(head)->sph_root
#define SPLAY_EMPTY(head)		(SPLAY_ROOT(head) == nullptr)

/* SPLAY_ROTATE_{LEFT,RIGHT} expect that tmp hold SPLAY_{RIGHT,LEFT} */
#define SPLAY_ROTATE_RIGHT(head, tmp, field) do {			\
	SPLAY_LEFT((head)->sph_root, field) = SPLAY_RIGHT(tmp, field);	\
	SPLAY_RIGHT(tmp, field) = (head)->sph_root;			\
	(head)->sph_root = tmp;						\
} while (/*CONSTCOND*/ 0)

#define SPLAY_ROTATE_LEFT(head, tmp, field) do {			\
	SPLAY_RIGHT((head)->sph_root, field) = SPLAY_LEFT(tmp, field);	\
	SPLAY_LEFT(tmp, field) = (head)->sph_root;			\
	(head)->sph_root = tmp;						\
} while (/*CONSTCOND*/ 0)

#define SPLAY_LINKLEFT(head, tmp, field) do {				\
	SPLAY_LEFT(tmp, field) = (head)->sph_root;			\
	tmp = (head)->sph_root;						\
	(head)->sph_root = SPLAY_LEFT((head)->sph_root, field);		\
} while (/*CONSTCOND*/ 0)

#define SPLAY_LINKRIGHT(head, tmp, field) do {				\
	SPLAY_RIGHT(tmp, field) = (head)->sph_root;			\
	tmp = (head)->sph_root;						\
	(head)->sph_root = SPLAY_RIGHT((head)->sph_root, field);	\
} while (/*CONSTCOND*/ 0)

#define SPLAY_ASSEMBLE(head, node, left, right, field) do {		\
	SPLAY_RIGHT(left, field) = SPLAY_LEFT((head)->sph_root, field);	\
	SPLAY_LEFT(right, field) = SPLAY_RIGHT((head)->sph_root, field);\
	SPLAY_LEFT((head)->sph_root, field) = SPLAY_RIGHT(node, field);	\
	SPLAY_RIGHT((head)->sph_root, field) = SPLAY_LEFT(node, field);	\
} while (/*CONSTCOND*/ 0)

/* Generates prototypes and inline functions */

#define SPLAY_PROTOTYPE(name, type, field, cmp)				\
void name##_SPLAY(struct name *, struct type *);			\
void name##_SPLAY_MINMAX(struct name *, int);				\
struct type *name##_SPLAY_INSERT(struct name *, struct type *);		\
struct type *name##_SPLAY_REMOVE(struct name *, struct type *);		\
									\
/* Finds the node with the same key as elm */				\
static __unused __inline struct type *					\
name##_SPLAY_FIND(struct name *head, struct type *elm)			\
{									\
	if (SPLAY_EMPTY(head))						\
		return nullptr;						\
	name##_SPLAY(head, elm);					\
	if ((cmp)(elm, (head)->sph_root) == 0)				\
		return (head->sph_root);				\
	return nullptr;							\
}									\
									\
static __unused __inline struct type *					\
name##_SPLAY_NEXT(struct name *head, struct type *elm)			\
{									\
	name##_SPLAY(head, elm);					\
	if (SPLAY_RIGHT(elm, field) != nullptr) {				\
		elm = SPLAY_RIGHT(elm, field);				\
		while (SPLAY_LEFT(elm, field) != nullptr) {		\
			elm = SPLAY_LEFT(elm, field);			\
		}							\
	} else								\
		elm = nullptr;						\
	return (elm);							\
}									\
									\
static __unused __inline struct type *					\
name##_SPLAY_MIN_MAX(struct name *head, int val)			\
{									\
	name##_SPLAY_MINMAX(head, val);					\
        return (SPLAY_ROOT(head));					\
}

/* Main splay operation.
 * Moves node close to the key of elm to top
 */
#define SPLAY_GENERATE(name, type, field, cmp)				\
struct type *								\
name##_SPLAY_INSERT(struct name *head, struct type *elm)		\
{									\
    if (SPLAY_EMPTY(head)) {						\
	    SPLAY_LEFT(elm, field) = SPLAY_RIGHT(elm, field) = nullptr;	\
    } else {								\
	    __typeof(cmp((void *)1, (void *)1)) __comp;							\
	    name##_SPLAY(head, elm);					\
	    __comp = (cmp)(elm, (head)->sph_root);			\
	    if (__comp < 0) {						\
		    SPLAY_LEFT(elm, field) = SPLAY_LEFT((head)->sph_root, field);\
		    SPLAY_RIGHT(elm, field) = (head)->sph_root;		\
		    SPLAY_LEFT((head)->sph_root, field) = nullptr;		\
	    } else if (__comp > 0) {					\
		    SPLAY_RIGHT(elm, field) = SPLAY_RIGHT((head)->sph_root, field);\
		    SPLAY_LEFT(elm, field) = (head)->sph_root;		\
		    SPLAY_RIGHT((head)->sph_root, field) = nullptr;	\
	    } else							\
		    return ((head)->sph_root);				\
    }									\
    (head)->sph_root = (elm);						\
    return nullptr;							\
}									\
									\
struct type *								\
name##_SPLAY_REMOVE(struct name *head, struct type *elm)		\
{									\
	struct type *__tmp;						\
	if (SPLAY_EMPTY(head))						\
		return nullptr;						\
	name##_SPLAY(head, elm);					\
	if ((cmp)(elm, (head)->sph_root) == 0) {			\
		if (SPLAY_LEFT((head)->sph_root, field) == nullptr) {	\
			(head)->sph_root = SPLAY_RIGHT((head)->sph_root, field);\
		} else {						\
			__tmp = SPLAY_RIGHT((head)->sph_root, field);	\
			(head)->sph_root = SPLAY_LEFT((head)->sph_root, field);\
			name##_SPLAY(head, elm);			\
			SPLAY_RIGHT((head)->sph_root, field) = __tmp;	\
		}							\
		return (elm);						\
	}								\
	return nullptr;							\
}									\
									\
void									\
name##_SPLAY(struct name *head, struct type *elm)			\
{									\
	struct type __node, *__left, *__right, *__tmp;			\
	__typeof(cmp((void *)1, (void *)1)) __comp;							\
\
	SPLAY_LEFT(&__node, field) = SPLAY_RIGHT(&__node, field) = nullptr;\
	__left = __right = &__node;					\
\
	while ((__comp = (cmp)(elm, (head)->sph_root)) != 0) {		\
		if (__comp < 0) {					\
			__tmp = SPLAY_LEFT((head)->sph_root, field);	\
			if (__tmp == nullptr)				\
				break;					\
			if ((cmp)(elm, __tmp) < 0){			\
				SPLAY_ROTATE_RIGHT(head, __tmp, field);	\
				if (SPLAY_LEFT((head)->sph_root, field) == nullptr)\
					break;				\
			}						\
			SPLAY_LINKLEFT(head, __right, field);		\
		} else if (__comp > 0) {				\
			__tmp = SPLAY_RIGHT((head)->sph_root, field);	\
			if (__tmp == nullptr)				\
				break;					\
			if ((cmp)(elm, __tmp) > 0){			\
				SPLAY_ROTATE_LEFT(head, __tmp, field);	\
				if (SPLAY_RIGHT((head)->sph_root, field) == nullptr)\
					break;				\
			}						\
			SPLAY_LINKRIGHT(head, __left, field);		\
		}							\
	}								\
	SPLAY_ASSEMBLE(head, &__node, __left, __right, field);		\
}									\
									\
/* Splay with either the minimum or the maximum element			\
 * Used to find minimum or maximum element in tree.			\
 */									\
void name##_SPLAY_MINMAX(struct name *head, int __comp) \
{									\
	struct type __node, *__left, *__right, *__tmp;			\
\
	SPLAY_LEFT(&__node, field) = SPLAY_RIGHT(&__node, field) = nullptr;\
	__left = __right = &__node;					\
\
	while (1) {							\
		if (__comp < 0) {					\
			__tmp = SPLAY_LEFT((head)->sph_root, field);	\
			if (__tmp == nullptr)				\
				break;					\
			if (__comp < 0){				\
				SPLAY_ROTATE_RIGHT(head, __tmp, field);	\
				if (SPLAY_LEFT((head)->sph_root, field) == nullptr)\
					break;				\
			}						\
			SPLAY_LINKLEFT(head, __right, field);		\
		} else if (__comp > 0) {				\
			__tmp = SPLAY_RIGHT((head)->sph_root, field);	\
			if (__tmp == nullptr)				\
				break;					\
			if (__comp > 0) {				\
				SPLAY_ROTATE_LEFT(head, __tmp, field);	\
				if (SPLAY_RIGHT((head)->sph_root, field) == nullptr)\
					break;				\
			}						\
			SPLAY_LINKRIGHT(head, __left, field);		\
		}							\
	}								\
	SPLAY_ASSEMBLE(head, &__node, __left, __right, field);		\
}

#define SPLAY_NEGINF	-1
#define SPLAY_INF	1

#define SPLAY_INSERT(name, x, y)	name##_SPLAY_INSERT(x, y)
#define SPLAY_REMOVE(name, x, y)	name##_SPLAY_REMOVE(x, y)
#define SPLAY_FIND(name, x, y)		name##_SPLAY_FIND(x, y)
#define SPLAY_NEXT(name, x, y)		name##_SPLAY_NEXT(x, y)
#define SPLAY_MIN(name, x)		(SPLAY_EMPTY(x) ? nullptr	\
					: name##_SPLAY_MIN_MAX(x, SPLAY_NEGINF))
#define SPLAY_MAX(name, x)		(SPLAY_EMPTY(x) ? nullptr	\
					: name##_SPLAY_MIN_MAX(x, SPLAY_INF))

#define SPLAY_FOREACH(x, name, head)					\
	for ((x) = SPLAY_MIN(name, head);				\
	     (x) != nullptr;						\
	     (x) = SPLAY_NEXT(name, head, x))

/* Macros that define a rank-balanced tree */
#define RB_HEAD(name, type)						\
struct name {								\
	struct type *rbh_root; /* root of the tree */			\
}

#define RB_INITIALIZER(root)						\
	{ nullptr }

#define RB_INIT(root) do {						\
	(root)->rbh_root = nullptr;					\
} while (/*CONSTCOND*/ 0)

#define RB_ENTRY(type)							\
struct {								\
	struct type *rbe_left;		/* left element */		\
	struct type *rbe_right;		/* right element */		\
    union {                                             \
	    struct type *rbe_parent;	/* parent element */		\
        uintptr_t rbe_parent_bits;                      \
    };                                                  \
}

#define RB_LEFT(elm, field)		(elm)->field.rbe_left
#define RB_RIGHT(elm, field)		(elm)->field.rbe_right

/*
 * With the expectation that any object of struct type has an
 * address that is a multiple of 4, and that therefore the
 * 2 least significant bits of a pointer to struct type are
 * always zero, this implementation sets those bits to indicate
 * that the left or right child of the tree node is "red".
 */
#define RB_UP(elm, field)		(elm)->field.rbe_parent
#define RB_UP_BITS(elm, field)  (elm)->field.rbe_parent_bits
#define RB_BITS(elm, field)		(RB_UP_BITS(elm, field))
#define RB_RED_L			((uintptr_t)1)
#define RB_RED_R			((uintptr_t)2)
#define RB_RED_MASK			((uintptr_t)3)
#define RB_FLIP_LEFT(elm, field)	(RB_BITS(elm, field) ^= RB_RED_L)
#define RB_FLIP_RIGHT(elm, field)	(RB_BITS(elm, field) ^= RB_RED_R)
#define RB_RED_LEFT(elm, field)		((RB_BITS(elm, field) & RB_RED_L) != 0)
#define RB_RED_RIGHT(elm, field)	((RB_BITS(elm, field) & RB_RED_R) != 0)
#define RB_PARENT(elm, field)		((__typeof(RB_UP(elm, field)))	\
					 (RB_BITS(elm, field) & ~RB_RED_MASK))
#define RB_ROOT(head)			(head)->rbh_root
#define RB_EMPTY(head)			(RB_ROOT(head) == nullptr)

#define RB_SET_PARENT(dst, src, field) do {				\
	RB_BITS(dst, field) &= RB_RED_MASK;				\
	RB_BITS(dst, field) |= (uintptr_t)src;			\
} while (/*CONSTCOND*/ 0)

#define RB_SET(elm, parent, field) do {					\
	RB_UP(elm, field) = parent;					\
	RB_LEFT(elm, field) = RB_RIGHT(elm, field) = nullptr;		\
} while (/*CONSTCOND*/ 0)

#define RB_COLOR(elm, field)	(RB_PARENT(elm, field) == nullptr ? 0 :	\
				RB_LEFT(RB_PARENT(elm, field), field) == elm ? \
				RB_RED_LEFT(RB_PARENT(elm, field), field) : \
				RB_RED_RIGHT(RB_PARENT(elm, field), field))

/*
 * Something to be invoked in a loop at the root of every modified subtree,
 * from the bottom up to the root, to update augmented node data.
 */
#ifndef RB_AUGMENT
#define RB_AUGMENT(x)	break
#endif

#define RB_SWAP_CHILD(head, out, in, field) do {			\
	if (RB_PARENT(out, field) == nullptr)				\
		RB_ROOT(head) = (in);					\
	else if ((out) == RB_LEFT(RB_PARENT(out, field), field))	\
		RB_LEFT(RB_PARENT(out, field), field) = (in);		\
	else								\
		RB_RIGHT(RB_PARENT(out, field), field) = (in);		\
} while (/*CONSTCOND*/ 0)

#define RB_ROTATE_LEFT(head, elm, tmp, field) do {			\
	(tmp) = RB_RIGHT(elm, field);					\
	if ((RB_RIGHT(elm, field) = RB_LEFT(tmp, field)) != nullptr) {	\
		RB_SET_PARENT(RB_RIGHT(elm, field), elm, field);	\
	}								\
	RB_SET_PARENT(tmp, RB_PARENT(elm, field), field);		\
	RB_SWAP_CHILD(head, elm, tmp, field);				\
	RB_LEFT(tmp, field) = (elm);					\
	RB_SET_PARENT(elm, tmp, field);					\
	RB_AUGMENT(elm);						\
} while (/*CONSTCOND*/ 0)

#define RB_ROTATE_RIGHT(head, elm, tmp, field) do {			\
	(tmp) = RB_LEFT(elm, field);					\
	if ((RB_LEFT(elm, field) = RB_RIGHT(tmp, field)) != nullptr) {	\
		RB_SET_PARENT(RB_LEFT(elm, field), elm, field);		\
	}								\
	RB_SET_PARENT(tmp, RB_PARENT(elm, field), field);		\
	RB_SWAP_CHILD(head, elm, tmp, field);				\
	RB_RIGHT(tmp, field) = (elm);					\
	RB_SET_PARENT(elm, tmp, field);					\
	RB_AUGMENT(elm);						\
} while (/*CONSTCOND*/ 0)

/* Generates prototypes and inline functions */
#define	RB_PROTOTYPE(name, type, field, cmp)				\
	RB_PROTOTYPE_INTERNAL(name, type, field, cmp,)
#define	RB_PROTOTYPE_STATIC(name, type, field, cmp)			\
	RB_PROTOTYPE_INTERNAL(name, type, field, cmp, __unused static)
#define RB_PROTOTYPE_INTERNAL(name, type, field, cmp, attr)		\
	RB_PROTOTYPE_INSERT_COLOR(name, type, attr);			\
	RB_PROTOTYPE_REMOVE_COLOR(name, type, attr);			\
    RB_PROTOTYPE_INSERT_FINISH(name, type, attr); \
	RB_PROTOTYPE_INSERT(name, type, attr);				\
	RB_PROTOTYPE_INSERT_NEXT(name, type, attr);			\
	RB_PROTOTYPE_REMOVE(name, type, attr);				\
	RB_PROTOTYPE_FIND(name, type, attr);				\
	RB_PROTOTYPE_NFIND(name, type, attr);				\
	RB_PROTOTYPE_NEXT(name, type, attr);				\
	RB_PROTOTYPE_PREV(name, type, attr);				\
	RB_PROTOTYPE_MINMAX(name, type, attr);				\
	RB_PROTOTYPE_REINSERT(name, type, attr);
#define RB_PROTOTYPE_INSERT_COLOR(name, type, attr)			\
	attr void name##_RB_INSERT_COLOR(struct name *, struct type *, struct type *)
#define RB_PROTOTYPE_REMOVE_COLOR(name, type, attr)			\
	attr void name##_RB_REMOVE_COLOR(struct name *,			\
	    struct type *, struct type *)
#define RB_PROTOTYPE_INSERT_FINISH(name, type, attr) \
    attr struct type *name##_RB_INSERT_FINISH(struct name *, \
        struct type *, struct type **, struct type *)
#define RB_PROTOTYPE_REMOVE(name, type, attr)				\
	attr struct type *name##_RB_REMOVE(struct name *, struct type *)
#define RB_PROTOTYPE_INSERT(name, type, attr)				\
	attr struct type *name##_RB_INSERT(struct name *, struct type *)
#define RB_PROTOTYPE_INSERT_NEXT(name, type, attr)				\
	attr void name##_RB_INSERT_NEXT(struct name *, struct type *, struct type *)
#define RB_PROTOTYPE_FIND(name, type, attr)				\
	attr struct type *name##_RB_FIND(struct name *, struct type *)
#define RB_PROTOTYPE_NFIND(name, type, attr)				\
	attr struct type *name##_RB_NFIND(struct name *, struct type *)
#define RB_PROTOTYPE_NEXT(name, type, attr)				\
	attr struct type *name##_RB_NEXT(struct type *)
#define RB_PROTOTYPE_PREV(name, type, attr)				\
	attr struct type *name##_RB_PREV(struct type *)
#define RB_PROTOTYPE_MINMAX(name, type, attr)				\
	attr struct type *name##_RB_MINMAX(struct name *, int)
#define RB_PROTOTYPE_REINSERT(name, type, attr)			\
	attr struct type *name##_RB_REINSERT(struct name *, struct type *)

/* Main rb operation.
 * Moves node close to the key of elm to top
 */
#define	RB_GENERATE(name, type, field, cmp)				\
	RB_GENERATE_INTERNAL(name, type, field, cmp,)
#define	RB_GENERATE_STATIC(name, type, field, cmp)			\
	RB_GENERATE_INTERNAL(name, type, field, cmp, __unused static)
#define RB_GENERATE_INTERNAL(name, type, field, cmp, attr)		\
	RB_GENERATE_INSERT_COLOR(name, type, field, attr)		\
	RB_GENERATE_REMOVE_COLOR(name, type, field, attr)		\
    RB_GENERATE_INSERT_FINISH(name, type, field, attr) \
	RB_GENERATE_INSERT(name, type, field, cmp, attr)		\
	RB_GENERATE_INSERT_NEXT(name, type, field, cmp, attr)	\
	RB_GENERATE_REMOVE(name, type, field, attr)			\
	RB_GENERATE_FIND(name, type, field, cmp, attr)			\
	RB_GENERATE_NFIND(name, type, field, cmp, attr)			\
	RB_GENERATE_NEXT(name, type, field, attr)			\
	RB_GENERATE_PREV(name, type, field, attr)			\
	RB_GENERATE_MINMAX(name, type, field, attr)			\
	RB_GENERATE_REINSERT(name, type, field, cmp, attr)


#define RB_GENERATE_INSERT_COLOR(name, type, field, attr)		\
attr void								\
name##_RB_INSERT_COLOR(struct name *head, struct type *parent, struct type *elm)		\
{									\
	struct type *child;					\
    do { \
		if (RB_LEFT(parent, field) == elm) {			\
			if (RB_RED_LEFT(parent, field)) {		\
				RB_FLIP_LEFT(parent, field);		\
				return;					\
			}						\
			RB_FLIP_RIGHT(parent, field);			\
			if (RB_RED_RIGHT(parent, field)) {		\
				elm = parent;				\
				continue;				\
			}						\
			if (!RB_RED_RIGHT(elm, field)) {		\
				RB_FLIP_LEFT(elm, field);		\
				RB_ROTATE_LEFT(head, elm, child, field);\
				if (RB_RED_LEFT(child, field))		\
					RB_FLIP_RIGHT(elm, field);	\
				else if (RB_RED_RIGHT(child, field))	\
					RB_FLIP_LEFT(parent, field);	\
				elm = child;				\
			}						\
			RB_ROTATE_RIGHT(head, parent, elm, field);	\
		} else {						\
			if (RB_RED_RIGHT(parent, field)) {		\
				RB_FLIP_RIGHT(parent, field);		\
				return;					\
			}						\
			RB_FLIP_LEFT(parent, field);			\
			if (RB_RED_LEFT(parent, field)) {		\
				elm = parent;				\
				continue;				\
			}						\
			if (!RB_RED_LEFT(elm, field)) {			\
				RB_FLIP_RIGHT(elm, field);		\
				RB_ROTATE_RIGHT(head, elm, child, field);\
				if (RB_RED_RIGHT(child, field))		\
					RB_FLIP_LEFT(elm, field);	\
				else if (RB_RED_LEFT(child, field))	\
					RB_FLIP_RIGHT(parent, field);	\
				elm = child;				\
			}						\
			RB_ROTATE_LEFT(head, parent, elm, field);	\
		}							\
		RB_BITS(elm, field) &= ~RB_RED_MASK;			\
		break;							\
	} while ((parent = RB_PARENT(elm, field)) != nullptr); \
}

#define RB_GENERATE_REMOVE_COLOR(name, type, field, attr)		\
attr void								\
name##_RB_REMOVE_COLOR(struct name *head,				\
    struct type *parent, struct type *elm)				\
{									\
	struct type *sib;						\
	if (RB_LEFT(parent, field) == elm &&				\
	    RB_RIGHT(parent, field) == elm) {				\
		RB_BITS(parent, field) &= ~RB_RED_MASK;			\
		elm = parent;						\
		parent = RB_PARENT(elm, field);				\
		if (parent == nullptr)					\
			return;						\
	}								\
	do  {								\
		if (RB_LEFT(parent, field) == elm) {			\
			if (!RB_RED_LEFT(parent, field)) {		\
				RB_FLIP_LEFT(parent, field);		\
				return;					\
			}						\
			if (RB_RED_RIGHT(parent, field)) {		\
				RB_FLIP_RIGHT(parent, field);		\
				elm = parent;				\
				continue;				\
			}						\
			sib = RB_RIGHT(parent, field);			\
			if ((~RB_BITS(sib, field) & RB_RED_MASK) == 0) {\
				RB_BITS(sib, field) &= ~RB_RED_MASK;	\
				elm = parent;				\
				continue;				\
			}						\
			RB_FLIP_RIGHT(sib, field);			\
			if (RB_RED_LEFT(sib, field))			\
				RB_FLIP_LEFT(parent, field);		\
			else if (!RB_RED_RIGHT(sib, field)) {		\
				RB_FLIP_LEFT(parent, field);		\
				RB_ROTATE_RIGHT(head, sib, elm, field);	\
				if (RB_RED_RIGHT(elm, field))		\
					RB_FLIP_LEFT(sib, field);	\
				if (RB_RED_LEFT(elm, field))		\
					RB_FLIP_RIGHT(parent, field);	\
				RB_BITS(elm, field) |= RB_RED_MASK;	\
				sib = elm;				\
			}						\
			RB_ROTATE_LEFT(head, parent, sib, field);	\
		} else {						\
			if (!RB_RED_RIGHT(parent, field)) {		\
				RB_FLIP_RIGHT(parent, field);		\
				return;					\
			}						\
			if (RB_RED_LEFT(parent, field)) {		\
				RB_FLIP_LEFT(parent, field);		\
				elm = parent;				\
				continue;				\
			}						\
			sib = RB_LEFT(parent, field);			\
			if ((~RB_BITS(sib, field) & RB_RED_MASK) == 0) {\
				RB_BITS(sib, field) &= ~RB_RED_MASK;	\
				elm = parent;				\
				continue;				\
			}						\
			RB_FLIP_LEFT(sib, field);			\
			if (RB_RED_RIGHT(sib, field))			\
				RB_FLIP_RIGHT(parent, field);		\
			else if (!RB_RED_LEFT(sib, field)) {		\
				RB_FLIP_RIGHT(parent, field);		\
				RB_ROTATE_LEFT(head, sib, elm, field);	\
				if (RB_RED_LEFT(elm, field))		\
					RB_FLIP_RIGHT(sib, field);	\
				if (RB_RED_RIGHT(elm, field))		\
					RB_FLIP_LEFT(parent, field);	\
				RB_BITS(elm, field) |= RB_RED_MASK;	\
				sib = elm;				\
			}						\
			RB_ROTATE_RIGHT(head, parent, sib, field);	\
		}							\
		break;							\
	} while ((parent = RB_PARENT(elm, field)) != nullptr);		\
}

#define RB_GENERATE_REMOVE(name, type, field, attr)			\
attr struct type *							\
name##_RB_REMOVE(struct name *head, struct type *elm)			\
{									\
	struct type *child, *old, *parent, *right;			\
									\
	old = elm;							\
	parent = RB_PARENT(elm, field);					\
	right = RB_RIGHT(elm, field);					\
	if (RB_LEFT(elm, field) == nullptr)				\
		elm = child = right;					\
	else if (right == nullptr)						\
		elm = child = RB_LEFT(elm, field);			\
	else {								\
		if ((child = RB_LEFT(right, field)) == nullptr) {		\
			child = RB_RIGHT(right, field);			\
			RB_RIGHT(old, field) = child;			\
			parent = elm = right;				\
		} else {						\
			do						\
				elm = child;				\
			while ((child = RB_LEFT(elm, field)) != nullptr);	\
			child = RB_RIGHT(elm, field);			\
			parent = RB_PARENT(elm, field);			\
			RB_LEFT(parent, field) = child;			\
			RB_SET_PARENT(RB_RIGHT(old, field), elm, field);\
		}							\
		RB_SET_PARENT(RB_LEFT(old, field), elm, field);		\
		elm->field = old->field;				\
	}								\
	RB_SWAP_CHILD(head, old, elm, field);				\
	if (child != nullptr)						\
		RB_SET_PARENT(child, parent, field);			\
	if (parent != nullptr)						\
		name##_RB_REMOVE_COLOR(head, parent, child);		\
	while (parent != nullptr) {					\
		RB_AUGMENT(parent);					\
		parent = RB_PARENT(parent, field);			\
	}								\
	return (old);							\
}

#define RB_GENERATE_INSERT_FINISH(name, type, field, attr)		\
/* Inserts a node into the RB tree */					\
attr struct type *							\
name##_RB_INSERT_FINISH(struct name *head, struct type *parent,		\
    struct type **pptr, struct type *elm)				\
{									\
	RB_SET(elm, parent, field);					\
	*pptr = elm;							\
	if (parent != nullptr) name##_RB_INSERT_COLOR(head, parent, elm); \
	while (elm != nullptr) {						\
		RB_AUGMENT(elm);					\
		elm = RB_PARENT(elm, field);				\
	}								\
	return nullptr;							\
}

#define RB_GENERATE_INSERT(name, type, field, cmp, attr)		\
/* Inserts a node into the RB tree */					\
attr struct type *							\
name##_RB_INSERT(struct name *head, struct type *elm)			\
{									\
	struct type *tmp;						\
    struct type **tmpp = &RB_ROOT(head); \
	struct type *parent = nullptr;					\
    while ((tmp = *tmpp) != nullptr) { \
        parent = tmp; \
        __typeof(cmp((void *)1, (void *)1)) comp = (cmp)(elm, parent); \
        if (comp < 0) tmpp = &RB_LEFT(parent, field); \
        else if (comp > 0) tmpp = &RB_RIGHT(parent, field); \
        else return (parent); \
    } \
    return (name##_RB_INSERT_FINISH(head, parent, tmpp, elm)); \
}

#define RB_GENERATE_INSERT_NEXT(name, type, field, cmp, attr) \
attr void \
name##_RB_INSERT_NEXT(struct name *head, struct type * restrict elm, struct type * restrict next) \
{ \
    struct type *tmp; \
    struct type **tmpp = &RB_RIGHT(elm, field); \
    while ((tmp = *tmpp) != nullptr) { \
        elm = tmp; \
        tmpp = &RB_LEFT(elm, field); \
    } \
    (void)(name##_RB_INSERT_FINISH(head, elm, tmpp, next)); \
}

#define RB_GENERATE_FIND(name, type, field, cmp, attr)			\
/* Finds the node with the same key as elm */				\
attr struct type *							\
name##_RB_FIND(struct name *head, struct type *elm)			\
{									\
	struct type *tmp = RB_ROOT(head);				\
	__typeof(cmp((void *)1, (void *)1)) comp;							\
	while (tmp) {							\
		comp = cmp(elm, tmp);					\
		if (comp < 0)						\
			tmp = RB_LEFT(tmp, field);			\
		else if (comp > 0)					\
			tmp = RB_RIGHT(tmp, field);			\
		else							\
			return (tmp);					\
	}								\
	return nullptr;							\
}

#define RB_GENERATE_NFIND(name, type, field, cmp, attr)			\
/* Finds the first node greater than or equal to the search key */	\
attr struct type *							\
name##_RB_NFIND(struct name *head, struct type *elm)			\
{									\
	struct type *tmp = RB_ROOT(head);				\
	struct type *res = nullptr;					\
	__typeof(cmp((void *)1, (void *)1)) comp;							\
	while (tmp) {							\
		comp = cmp(elm, tmp);					\
		if (comp < 0) {						\
			res = tmp;					\
			tmp = RB_LEFT(tmp, field);			\
		}							\
		else if (comp > 0)					\
			tmp = RB_RIGHT(tmp, field);			\
		else							\
			return (tmp);					\
	}								\
	return (res);							\
}

#define RB_GENERATE_NEXT(name, type, field, attr)			\
/* ARGSUSED */								\
attr struct type *							\
name##_RB_NEXT(struct type *elm)					\
{									\
	if (RB_RIGHT(elm, field)) {					\
		elm = RB_RIGHT(elm, field);				\
		while (RB_LEFT(elm, field))				\
			elm = RB_LEFT(elm, field);			\
	} else {							\
        while (RB_PARENT(elm, field) && \
               (elm == RB_RIGHT(RB_PARENT(elm, field), field))) \
            elm = RB_PARENT(elm, field); \
        elm = RB_PARENT(elm, field); \
	}								\
	return (elm);							\
}

#define RB_GENERATE_PREV(name, type, field, attr)			\
/* ARGSUSED */								\
attr struct type *							\
name##_RB_PREV(struct type *elm)					\
{									\
	if (RB_LEFT(elm, field)) {					\
		elm = RB_LEFT(elm, field);				\
		while (RB_RIGHT(elm, field))				\
			elm = RB_RIGHT(elm, field);			\
	} else {							\
        while (RB_PARENT(elm, field) && \
               (elm == RB_LEFT(RB_PARENT(elm, field), field))) \
            elm = RB_PARENT(elm, field); \
        elm = RB_PARENT(elm, field); \
	}								\
	return (elm);							\
}

#define RB_GENERATE_MINMAX(name, type, field, attr)			\
attr struct type *							\
name##_RB_MINMAX(struct name *head, int val)				\
{									\
	struct type *tmp = RB_ROOT(head);				\
	struct type *parent = nullptr;					\
	while (tmp) {							\
		parent = tmp;						\
		if (val < 0)						\
			tmp = RB_LEFT(tmp, field);			\
		else							\
			tmp = RB_RIGHT(tmp, field);			\
	}								\
	return (parent);						\
}

#define	RB_GENERATE_REINSERT(name, type, field, cmp, attr)		\
attr struct type *							\
name##_RB_REINSERT(struct name *head, struct type *elm)			\
{									\
	struct type *cmpelm;						\
	if (((cmpelm = RB_PREV(name, head, elm)) != nullptr &&		\
	    cmp(cmpelm, elm) >= 0) ||					\
	    ((cmpelm = RB_NEXT(name, head, elm)) != nullptr &&		\
	    cmp(elm, cmpelm) >= 0)) {					\
		/* XXXLAS: Remove/insert is heavy handed. */		\
		RB_REMOVE(name, head, elm);				\
		return (RB_INSERT(name, head, elm));			\
	}								\
	return nullptr;							\
}									\

#define RB_NEGINF	-1
#define RB_INF	1

#define RB_INSERT(name, x, y)	name##_RB_INSERT(x, y)
#define RB_INSERT_NEXT(name, x, y, z)	name##_RB_INSERT_NEXT(x, y, z)
#define RB_REMOVE(name, x, y)	name##_RB_REMOVE(x, y)
#define RB_FIND(name, x, y)	name##_RB_FIND(x, y)
#define RB_NFIND(name, x, y)	name##_RB_NFIND(x, y)
#define RB_NEXT(name, x, y)	name##_RB_NEXT(y)
#define RB_PREV(name, x, y)	name##_RB_PREV(y)
#define RB_MIN(name, x)		name##_RB_MINMAX(x, RB_NEGINF)
#define RB_MAX(name, x)		name##_RB_MINMAX(x, RB_INF)
#define RB_REINSERT(name, x, y)	name##_RB_REINSERT(x, y)

#define RB_FOREACH(x, name, head)					\
	for ((x) = RB_MIN(name, head);					\
	     (x) != nullptr;						\
	     (x) = name##_RB_NEXT(x))

#define RB_FOREACH_FROM(x, name, y)					\
	for ((x) = (y);							\
	    ((x) != nullptr) && ((y) = name##_RB_NEXT(x), (x) != nullptr);	\
	     (x) = (y))

#define RB_FOREACH_SAFE(x, name, head, y)				\
	for ((x) = RB_MIN(name, head);					\
	    ((x) != nullptr) && ((y) = name##_RB_NEXT(x), (x) != nullptr);	\
	     (x) = (y))

#define RB_FOREACH_REVERSE(x, name, head)				\
	for ((x) = RB_MAX(name, head);					\
	     (x) != nullptr;						\
	     (x) = name##_RB_PREV(x))

#define RB_FOREACH_REVERSE_FROM(x, name, y)				\
	for ((x) = (y);							\
	    ((x) != nullptr) && ((y) = name##_RB_PREV(x), (x) != nullptr);	\
	     (x) = (y))

#define RB_FOREACH_REVERSE_SAFE(x, name, head, y)			\
	for ((x) = RB_MAX(name, head);					\
	    ((x) != nullptr) && ((y) = name##_RB_PREV(x), (x) != nullptr);	\
	     (x) = (y))

#endif	/* _SYS_TREE_H_ */
