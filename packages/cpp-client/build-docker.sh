#!/bin/sh
make clean
mkdir -p docker-build
docker build -t based-build .
docker run -v "$PWD/docker-build":/build/out based-build
