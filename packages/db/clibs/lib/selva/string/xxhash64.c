#include "xxhash.h"
#include "selva/xxhash64.h"
#include <string.h>

uint64_t xxHash64(const char *s, size_t len)
{
    return XXH64(s, len, 0);
}