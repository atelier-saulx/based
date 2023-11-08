#!/usr/bin/env bash
# Copyright (c) 2023 SAULX
#
# SPDX-License-Identifier: MIT
cd "${0%/*}"
LOCPATH=../../../binaries/Linux_x86_64/locale SELVA_PORT=3001 SERVER_SO_REUSE=1 SELVA_REPLICATION_MODE=2 exec ../../../selvad
