# Copyright (c) 2022 SAULX
#
# SPDX-License-Identifier: MIT

TEST_SRC += test-selva_string.c
SRC-selva_string += ../../lib/util/crc32c/crc32c.c
SRC-selva_string += ../../lib/util/finalizer.c
SRC-selva_string += ../../lib/util/selva_lang/selva_mbscmp.c
SRC-selva_string += ../../lib/util/selva_lang/selva_mbsstrstr.c
SRC-selva_string += ../../lib/util/selva_lang/selva_mbstowc.c
SRC-selva_string += ../../lib/util/selva_string.c
