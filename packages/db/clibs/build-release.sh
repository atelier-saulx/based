#!/bin/bash -e

if [[ "$PWD" != *"/clibs" ]]; then
    echo "Wrong dir"
    exit 1
fi

read -p "All uncommitted files will be DELETED! Are you sure? " -n 1 -r
echo    # (optional) move to a new line
if [[ $REPLY =~ ^[Yy]$ ]]
then
    git clean -dfx .
    podman build -t based-db-clibs-build .
    make
    git clean -dfx .
    podman run -v $PWD/../../..:/usr/src/based-db based-db-clibs-build
fi
