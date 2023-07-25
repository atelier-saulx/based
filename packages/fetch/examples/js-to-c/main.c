#include <stdio.h>
#include <stdlib.h>
#include "my_record.h"

#define BUF_SIZE_BASE 4096

static int read_stdin(void ** p)
{
	int c;
	size_t buf_size = BUF_SIZE_BASE;
	int i = 0;
	void * new_ptr = NULL;
	char * str = calloc(1, buf_size);

	while (str != NULL && (c = getchar()) != EOF) {
		if (i >= buf_size) {
			buf_size += BUF_SIZE_BASE;
			if ((new_ptr = realloc(str, buf_size)) != NULL) {
				str = (char *)new_ptr;
			} else {
				free(str);
				return -1;
			}
		}
		str[i++] = c;
	}

	if (str == NULL) {
		return -1;
	}

	*p = str;
	return i;
}

int main(void)
{
	struct my_record * record;
	size_t record_len = read_stdin((void *)(&record));

	if (record_len < sizeof(struct my_record)) {
		fprintf(stderr, "Read failed\n");
		return -1;
	}

	my_record_ntoh(record);

	printf("a           %d\n", (int)record->a);
	printf("b           %d\n", (int)record->b);
	printf("c           %u\n", (unsigned)record->c);
	printf("d           %u\n", (unsigned)record->d);
	printf("e           %d\n", (int)record->e);
	printf("f           %llu\n", (unsigned long long)record->f);
	printf("str         %.10s\n", record->str);
	printf("str_a       %s\n", record->str_a);
	printf("str_a_len   %d\n", record->str_a_len);
	printf("str_b       %s\n", record->str_b);
	printf("str_b_len   %d\n", record->str_b_len);

	return 0;
}
