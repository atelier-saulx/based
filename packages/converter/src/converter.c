#include "converter.h"
#include "csv.h"
#include "sdb.h"
#include <string.h>
#include <stdio.h>

static FormatHandler format_handlers[] = {
    {
        FORMAT_SDB,
        ".sdb",
        csv_read, // dummy
        NULL,
        csv_free, // dummy
    },
    {
        FORMAT_CSV,
        ".csv",
        NULL,
        csv_write,
        csv_free,
    },
    {FORMAT_UNKNOWN, NULL, NULL, NULL, NULL},
};

OutputFormat detect_format_from_extension(const char* filename) {
    const char* dot = strrchr(filename, '.');
    if (!dot) return FORMAT_UNKNOWN;

    for (int i = 0; format_handlers[i].format != FORMAT_UNKNOWN; i++) {
        if (strcasecmp(dot, format_handlers[i].extension) == 0) {
            return format_handlers[i].format;
        }
    }
    return FORMAT_UNKNOWN;
}

const char* format_to_string(OutputFormat format) {
    switch (format) {
        case FORMAT_CSV: return "CSV";
        case FORMAT_PARQUET: return "Parquet";
        default: return "Unknown";
    }
}

bool convert_file(const char* input_file, const char* output_file, 
                 ConverterOptions* options) {

    OutputFormat output_format =  detect_format_from_extension(output_file);
    if (output_format == FORMAT_UNKNOWN) {
        fprintf(stderr, "Unsupported file format\n");
        return false;
    }

    if (options->verbose) {
        printf("Converting dumpfile %s to %s\n", 
               input_file,format_to_string(output_format));
    }

    FormatHandler* input_handler = &format_handlers[FORMAT_SDB];
    FormatHandler* output_handler = NULL;
    
    for (int i = 0; format_handlers[i].format != FORMAT_UNKNOWN; i++) {
        if (format_handlers[i].format == output_format) {
            output_handler = &format_handlers[i];
        }
    }

    if (!output_handler) {
        fprintf(stderr, "Output format not found\n");
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