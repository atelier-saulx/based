#!/bin/sh

cd selvad
echo "\n====== cleaning"
make mostlyclean
echo "\n====== building"
make
echo "\n====== installing locales"
make install
cd ..

echo "\n====== copying build to packages/server/selvad"

rm -rf packages/server/selvad
{
	find selvad/lib -name "*.so*"
	find selvad/lib -name "*.dylib"
	find selvad/modules -name "*.so*"
	find selvad/locale
	echo selvad/selvad
} | tar -czf - -T - | tar -xzf - -C packages/server/
