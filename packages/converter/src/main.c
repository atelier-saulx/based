#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "converter.h"

void print_usage(const char* program_name) {
    printf("Usage: %s <input_file> <output_file> [options]\n", program_name);
    printf("Options:\n");
    printf("  -v, --verbose    Enable verbose output\n");
    printf("  -o, --overwrite  Overwrite existing files\n");
    printf("  -d, --delimiter  Set delimiter character (for CSV)\n");
}

int main(int argc, char* argv[]) {
    if (argc < 3) {
        print_usage(argv[0]);
        return 1;
    }

    ConverterOptions options = {
        .verbose = false,
        .overwrite = false,
        .delimiter = ','
    };

    for (int i = 3; i < argc; i++) {
        if (strcmp(argv[i], "-v") == 0 || strcmp(argv[i], "--verbose") == 0) {
            options.verbose = true;
        } else if (strcmp(argv[i], "-o") == 0 || strcmp(argv[i], "--overwrite") == 0) {
            options.overwrite = true;
        } else if ((strcmp(argv[i], "-d") == 0 || strcmp(argv[i], "--delimiter") == 0) && i + 1 < argc) {
            options.delimiter = argv[++i][0];
        }
    }

    if (convert_file(argv[1], argv[2], &options)) {
        printf("%s %s\n",argv[1], argv[2]);
        printf("Conversion successful!\n");
        return 0;
    } else {
        fprintf(stderr, "Conversion failed!\n");
        return 1;
    }
}