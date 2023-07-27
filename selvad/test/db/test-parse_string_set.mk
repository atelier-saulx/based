# Copyright (c) 2023 SAULX
#
# SPDX-License-Identifier: MIT

TEST_SRC += test-parse_string_set.c
SRC-parse_string_set += ../../lib/util/array_field.c
SRC-parse_string_set += ../../lib/util/crc32c/crc32c.c
SRC-parse_string_set += ../../lib/util/cstrings.c
SRC-parse_string_set += ../../lib/util/finalizer.c
SRC-parse_string_set += ../../lib/util/hll.c
SRC-parse_string_set += ../../lib/util/mempool.c
SRC-parse_string_set += ../../lib/util/selva_error.c
SRC-parse_string_set += ../../lib/util/selva_string.c
SRC-parse_string_set += ../../lib/util/svector.c
SRC-parse_string_set += ../../modules/db/module/selva_object/selva_object.c
SRC-parse_string_set += ../../modules/db/module/selva_set/selva_set.c
SRC-parse_string_set += ../../modules/db/module/parsers/string_set.c
