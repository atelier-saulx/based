#!/bin/bash

if [ $# -eq 0 ]; then
 echo "specify teamID as first argument"
 exit 1
fi

shopt -s nullglob
for file in build-scripts/*.sh
do
  echo Executing "$file"
  export XCODE_TEAMID="$1"
  /bin/bash "$file"
done
shopt -u nullglob
