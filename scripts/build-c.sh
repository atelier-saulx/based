#!/bin/sh
# Copyright (c) 2023 SAULX
# SPDX-License-Identifier: MIT

rm -rf packages/server/selvad/local/*
cd selvad
make
INSTALL_DIR=../packages/server/selvad/local make install
