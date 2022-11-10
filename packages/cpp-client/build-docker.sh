#!/bin/sh
make clean
mkdir -p build-docker
docker build -t based-build .
docker run -v "$PWD/build-docker":/build/out based-build
