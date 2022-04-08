Example: Sending a Record from Node.js to C
===========================================

```
$ make
set -eo pipefail && echo 'console.log(require("../../lib").generateCHeader(require("./def"), "my_record"))' | node > my_record.h
cc main.c -o main
$ ./run.sh
a           1
b           2
c           4294967295
d           4294967295
e           -2
f           14632414794100835840
str         QWERTYUI
str_a       Hello world!
str_a_len   12
str_b       Ciao a tutti!
str_b_len   13
```
