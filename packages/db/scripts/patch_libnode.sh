#/bin/bash -e
version="$1"
file="libnode-${version}.node"
abs_path=$(readelf -d "$file" 2>/dev/null | grep -Eow '/.*/libselva\.so' || true)
if [ -n "$abs_path" ]; then
    patchelf --replace-needed "$abs_path" libselva.so "$file"
fi
