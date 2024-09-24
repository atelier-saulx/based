/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stdint.h>
#include "selva/types.h"

uint16_t idz_pack(node_id_t id);
node_id_t idz_unpack(uint16_t packed_id);
