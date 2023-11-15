#!/bin/sh

rm -rf packages/server/selvad/local/*
cd selvad
make
INSTALL_DIR=../packages/server/selvad/local make install
