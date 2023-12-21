#!/usr/bin/env bash
# Copyright (c) 2023 SAULX
#
# SPDX-License-Identifier: MIT
#
# Check the minimum glibc version needed by each binary in selvad
cd "${0%/*}"
cd ..
print_glibc_ver () {
	echo "$1" "glibc@$(objdump -T "$1" | grep GLIBC | sed 's/.*GLIBC_\([.0-9]*\).*/\1/g' | sort --version-sort | tail -n 1)"
}

for name in selvad lib/*.so modules/*.so; do
	print_glibc_ver "$name"
done
