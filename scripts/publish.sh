#!/bin/sh

if [ -z "$1" ]; then
	echo 'Please suply a version name. Example `npm run publish -- v1.2.3 <optional_description>`'
	exit 1
fi

echo "Publishing version $1"

gh workflow run publish.yml --ref $(git branch --show-current) -f version=$1 -f notes=$2
