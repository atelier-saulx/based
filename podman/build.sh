#!/bin/bash -e
podman build --platform=linux/aarch64 -t based-db-clibs-build-linux_aarch64 .
podman build --platform=linux/x86_64 -t based-db-clibs-build-linux_x86_64 .
