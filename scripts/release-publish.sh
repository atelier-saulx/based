#!/bin/sh

if [ -z "$1" ]; then
	echo 'Please suply a version name. Example `npm run release-publish -- v1.2.3 <optional_description>`'
	exit 1
fi

echo "Releasing and publishing version $1"

gh workflow run release.yml --ref $(git branch --show-current) -f version=$1 -f notes=$2
