#ifndef CSV_HANDLER_H
#define CSV_HANDLER_H

#include "../include/converter.h"

typedef struct {
    char** headers;
    char*** data;
    int row_count;
    int col_count;
} CSVData;

bool csv_read(const char* filename, void** data);
bool csv_write(const char* filename, const void* data);
void csv_free(void* data);

CSVData* create_csv_data(int rows, int cols);
void print_csv_data(const CSVData* csv_data);

#endif