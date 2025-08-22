#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "converter.h"

void print_usage(const char* program_name) {
    printf("Usage: %s <input_file> <output_file> [options]\n", program_name);
    printf("Options:\n");
    printf("  -v, --verbose    Enable verbose output\n");
}

int main(int argc, char* argv[]) {
    if (argc < 3) {
        print_usage(argv[0]);
        return 1;
    }

    ConverterOptions options = {
        .verbose = false,
    };

    for (int i = 3; i < argc; i++) {
        if (strcmp(argv[i], "-v") == 0 || strcmp(argv[i], "--verbose") == 0) {
            options.verbose = true;
        } 
    }

    if (convert_file(argv[1], argv[2], &options)) {
        printf("Conversion successful!\n");
        return 0;
    } else {
        fprintf(stderr, "Conversion failed!\n");
        return 1;
    }
}