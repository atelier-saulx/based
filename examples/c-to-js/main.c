#include <stdio.h>
#include <stdlib.h>
#include "my_record.h"

char hello_en[] = "Hello world!";
char hello_it[] = "Ciao a tutti!";

int main(void)
{
    const size_t struct_len = sizeof(struct my_record)
		+ MY_RECORD_ALIGN(sizeof(hello_it))
		+ MY_RECORD_ALIGN(sizeof(hello_en));
	struct my_record * record = calloc(1, struct_len);

	*record = ((struct my_record){
		.a = 0x1,
		.b = 0x2,
		.c = 0xffffffff,
		.d = 0xffffffff,
		.e = 254,
		.f = 0xffffffffffffffff,
		.str = "QWERTYUI",
		.str_a = hello_en,
		.str_a_len = sizeof(hello_en),
		.str_b = hello_it,
		.str_b_len = sizeof(hello_it),
	});
	my_record_hton(record);

#if 0
	printf("a         %p\n", (uint8_t *)(&record->a) - (uint8_t *)record);
	printf("b         %p\n", (uint8_t *)(&record->b) - (uint8_t *)record);
	printf("c         %p\n", (uint8_t *)(&record->c) - (uint8_t *)record);
	printf("d         %p\n", (uint8_t *)(&record->d) - (uint8_t *)record);
	printf("e         %p\n", (uint8_t *)(&record->e) - (uint8_t *)record);
	printf("f         %p\n", (uint8_t *)(&record->f) - (uint8_t *)record);
	printf("str       %p\n", (uint8_t *)(&record->str) - (uint8_t *)record);
	printf("str_a     %p\n", (uint8_t *)(&record->str_a) - (uint8_t *)record);
	printf("str_a_len %p\n", (uint8_t *)(&record->str_a_len) - (uint8_t *)record);
	printf("str_b     %p\n", (uint8_t *)(&record->str_b) - (uint8_t *)record);
	printf("str_b_len %p\n", (uint8_t *)(&record->str_b_len) - (uint8_t *)record);
#endif

	for (int i = 0; i < struct_len; i++) {
		printf("%02x", ((unsigned char *)record)[i]);
	}

	return 0;
}
