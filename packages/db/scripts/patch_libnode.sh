#/bin/bash -e
version="$1"
file="libnode-${version}.node"
patchelf --replace-needed $(readelf -d "$file"|grep -Eow '/.*/libselva.so') libselva.so "$file"
