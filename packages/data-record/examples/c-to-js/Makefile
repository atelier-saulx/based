all: main

my_record.h: def.js
	set -eo pipefail && echo 'console.log(require("../../lib").generateCHeader(require("./def"), "my_record"))' | node > my_record.h

main: main.c my_record.h
	$(CC) $< -o $@

clean:
	$(RM) my_record.h main

.PHONY: clean
