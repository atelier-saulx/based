Example: Sending a Record from C to Node.js
===========================================

```
% make
set -eo pipefail && echo 'console.log(require("../../lib").generateCHeader(require("./def"), "my_record"))' | node > my_record.h
cc main.c -o main
% ./run.sh
{
  a: 1,
  b: 2,
  c: 4294967295,
  d: 4294967295,
  e: -2,
  f: 18446744073709551615n,
  str: 'QWERTYUI',
  str_a: 'Hello world!',
  str_b: 'Ciao a tutti!'
}
```
