/*
 * Copyright (c) 2022 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef SELVA_JEMALLOC_H
#define SELVA_JEMALLOC_H

#if defined(__APPLE__)
#include "jemalloc_darwin_x64.h"
#elif defined(__linux__)
#include "./jemalloc_linux_x64.h"
#else
#error "Arch not supported"
#endif

#endif /* SELVA_JEMALLOC_H */
