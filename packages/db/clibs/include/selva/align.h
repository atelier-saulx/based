/*
 * Copyright (c) 2020-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#define MOD_AL(x, y) ((x) & ((y) - 1)) /* x % bytes */
#define PAD(size, al) MOD_AL(((al) - MOD_AL((size), (al))), (al))
#define ALIGNED_SIZE(size, al) ((size) + PAD((size), (al)))
