#include "converter.h"
#include "csv.h"
#include "sdb.h"
#include <string.h>
#include <stdio.h>

static FormatHandler format_handlers[] = {
    {
        FORMAT_CSV,
        ".csv",
        csv_read,
        csv_write,
        csv_free,
    },
    {FORMAT_UNKNOWN, NULL, NULL, NULL, NULL},
};

FileFormat detect_format_from_extension(const char* filename) {
    const char* dot = strrchr(filename, '.');
    if (!dot) return FORMAT_UNKNOWN;

    for (int i = 0; format_handlers[i].format != FORMAT_UNKNOWN; i++) {
        if (strcasecmp(dot, format_handlers[i].extension) == 0) {
            return format_handlers[i].format;
        }
    }
    return FORMAT_UNKNOWN;
}

const char* format_to_string(FileFormat format) {
    switch (format) {
        case FORMAT_CSV: return "CSV";
        case FORMAT_PARQUET: return "Parquet";
        case FORMAT_SDB: return "Selva";
        default: return "Unknown";
    }
}

bool convert_file(const char* input_file, const char* output_file, ConverterOptions* options) {

    FileFormat input_format =  detect_format_from_extension(input_file);
    FileFormat output_format =  detect_format_from_extension(output_file);
    
    if (input_format == FORMAT_UNKNOWN || output_format == FORMAT_UNKNOWN) {
        fprintf(stderr, "Unsupported file format\n");
        return false;
    }

    if (options->verbose) {
        printf("Converting %s to %s\n", format_to_string(input_format), format_to_string(output_format));
    }

    FormatHandler* input_handler = NULL;
    FormatHandler* output_handler = NULL;
    
    for (int i = 0; format_handlers[i].format != FORMAT_UNKNOWN; i++) {
        if (format_handlers[i].format == input_format) {
            input_handler = &format_handlers[i];
        }
        if (format_handlers[i].format == output_format) {
            output_handler = &format_handlers[i];
        }
    }

    if (!input_handler || !output_handler) {
        fprintf(stderr, "Input format not found\n");
        return false;
    }

    void* data = NULL;
    if (!input_handler->read(input_file, &data)) {
        fprintf(stderr, "Failed to read input file\n");
        return false;
    }

    bool success = output_handler->write(output_file, data);
    
    input_handler->free(data);
    
    return success;
}