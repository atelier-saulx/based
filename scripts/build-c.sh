#!/bin/sh

rm -rf packages/server/selvad/*
cd selvad
make mostlyclean
make
INSTALL_DIR=../packages/server/selvad make install
