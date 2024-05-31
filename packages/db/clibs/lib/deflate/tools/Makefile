decompress: decompress.c
	$(CC) -std=gnu2x -Wall $^ -L../../ -ldeflate -o $@
	install_name_tool -add_rpath @executable_path/../../ $@
