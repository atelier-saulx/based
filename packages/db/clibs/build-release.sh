#!/bin/bash -e

if [[ "$PWD" != *"/clibs" ]]; then
    echo "Wrong dir"
    exit 1
fi

read -p "All uncommitted files will be DELETED! Are you sure? (type y or Y)" -n 1 -r
echo    # (optional) move to a new line
if [[ $REPLY =~ ^[Yy]$ ]]
then
    git clean -dfx .
    # TODO Should do this only on Darwin
    make
    git clean -dfx .
    podman run --rm -v "$PWD/../../..:/usr/src/based-db" based-db-clibs-build-linux_aarch64
    git clean -dfx .
    podman run --rm -v "$PWD/../../..:/usr/src/based-db" based-db-clibs-build-linux_x86_64
    git clean -dfx .
else
    exit 1
fi
