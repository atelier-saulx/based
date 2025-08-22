#ifndef CONVERTER_H
#define CONVERTER_H

#include <stdbool.h>

typedef enum {
    FORMAT_SDB,
    FORMAT_CSV,
    FORMAT_PARQUET,
    FORMAT_UNKNOWN,
} FileFormat;

typedef struct {
    bool verbose;
    bool overwrite;
    char delimiter;
} ConverterOptions;

typedef bool (*ReadFunc)(const char* filename, void** data);
typedef bool (*WriteFunc)(const char* filename, const void* data);
typedef void (*FreeFunc)(void* data);

typedef struct {
    FileFormat format;
    const char* extension;
    ReadFunc read;
    WriteFunc write;
    FreeFunc free;
} FormatHandler;

bool convert_file(const char* input_file, const char* output_file, 
                 ConverterOptions* options);
const char* format_to_string(FileFormat format);

#endif