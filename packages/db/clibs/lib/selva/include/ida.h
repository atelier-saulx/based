/*
 * Copyright (c) 2021-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef _IDA_H_
#define _IDA_H_

struct ida;
typedef int ida_t;

/**
 * Create a new Id Allocator.
 * Ids are allocated from 0 to max.
 */
struct ida *ida_init(ida_t max) __attribute__ ((malloc));

/**
 * Destroy an Id Allocator.
 */
void ida_destroy(struct ida *ida);

/**
 * Allocate an unique id.
 */
[[nodiscard]]
ida_t ida_alloc(struct ida *ida) __attribute__ ((warn_unused_result));

/**
 * Free a previously allocated unique id.
 */
void ida_free(struct ida *ida, ida_t id) __attribute__((nonnull (1)));

#endif /* _IDA_H_ */
