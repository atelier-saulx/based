#!/bin/bash -e

if [[ "$PWD" != *"/locale" ]]; then
    echo "Wrong dir"
    exit 1
fi

if test "$OSTYPE" == "linux-gnu" && test "$1" != "release"; then
    make -j4
else
    podman run --rm -v "$PWD/../..:/usr/src/based-db" based-db-clibs-build-linux_aarch64 /bin/bash -c "cd /usr/src/based-db/packages/locale && make -j4"
    podman run --rm -v "$PWD/../..:/usr/src/based-db" based-db-clibs-build-linux_x86_64 /bin/bash -c "cd /usr/src/based-db/packages/locale && make -j4"
fi
