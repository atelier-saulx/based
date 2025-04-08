decompress: decompress.c
	$(CC) -std=gnu23 -Wall $^ -L../../ -ldeflate -o $@
	install_name_tool -add_rpath @executable_path/../../ $@
