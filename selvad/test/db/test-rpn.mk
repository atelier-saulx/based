# Copyright (c) 2023 SAULX
#
# SPDX-License-Identifier: MIT

TEST_SRC += test-rpn.c
SRC-rpn += ../../lib/util/array_field.c
SRC-rpn += ../../lib/util/crc32c/crc32c.c
SRC-rpn += ../../lib/util/cstrings.c
SRC-rpn += ../../lib/util/finalizer.c
SRC-rpn += ../../lib/util/hll.c
SRC-rpn += ../../lib/util/mempbrk.c
SRC-rpn += ../../lib/util/mempool.c
SRC-rpn += ../../lib/util/memrchr.c
SRC-rpn += ../../lib/util/selva_error.c
SRC-rpn += ../../lib/util/selva_string.c
SRC-rpn += ../../lib/util/svector.c
SRC-rpn += ../../lib/util/timestamp.c
SRC-rpn += ../../modules/db/module/rpn/rpn.c
SRC-rpn += ../../modules/db/module/selva_object/selva_object.c
SRC-rpn += ../../modules/db/module/selva_set/field_has.c
SRC-rpn += ../../modules/db/module/selva_set/fielda_in_fieldb.c
SRC-rpn += ../../modules/db/module/selva_set/fielda_in_setb.c
SRC-rpn += ../../modules/db/module/selva_set/selva_set.c
SRC-rpn += ../../modules/db/module/selva_set/seta_in_fieldb.c
SRC-rpn += ../../modules/db/module/selva_set/seta_in_setb.c
SRC-rpn += ../../modules/db/module/selva_type.c
SRC-rpn += ../../src/selva_log.c
SRC-rpn += ./mock-edge.c
SRC-rpn += ./mock-hierarchy.c
SRC-rpn += ./mock-subscriptions.c
