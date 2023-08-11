# Copyright (c) 2023 SAULX
#
# SPDX-License-Identifier: MIT 
CFLAGS += -DEVL_MAIN
TEST_SRC += test-selva_object.c
SRC-selva_object += ../../lib/util/array_field.c
SRC-selva_object += ../../lib/util/crc32c/crc32c.c
SRC-selva_object += ../../lib/util/cstrings.c
SRC-selva_object += ../../lib/util/finalizer.c
SRC-selva_object += ../../lib/util/hll.c
SRC-selva_object += ../../lib/util/mempool.c
SRC-selva_object += ../../lib/util/memrchr.c
SRC-selva_object += ../../lib/util/mempbrk.c
SRC-selva_object += ../../lib/util/selva_error.c
SRC-selva_object += ../../lib/util/selva_string.c
SRC-selva_object += ../../lib/util/svector.c
SRC-selva_object += ../../src/selva_log.c
SRC-selva_object += ../../modules/db/selva_object/selva_object.c
SRC-selva_object += ../../modules/db/selva_set/selva_set.c
SRC-selva_object += ../../modules/db/selva_type.c
