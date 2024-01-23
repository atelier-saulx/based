#!/bin/sh
# Copyright (c) 2023 SAULX
# SPDX-License-Identifier: MIT

rm -rf packages/server/selvad/local/lib packages/server/selvad/local/modules packages/server/selvad/local/selvad
cd selvad
make
INSTALL_DIR=../packages/server/selvad/local make install
