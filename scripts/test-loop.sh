#!/bin/bash

set -e

while true
do
    LD_PRELOAD=/lib64/libasan.so.8 LOCPATH=../locale/locale-x86_64-gnu/locale node ./scripts/test.js
	sleep 1
done
