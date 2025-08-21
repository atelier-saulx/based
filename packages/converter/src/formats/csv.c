#include "../include/csv.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// dummy
bool csv_read(const char* filename, void** data) {
    FILE* file = fopen(filename, "r");
    if (!file) {
        perror("Failed to open CSV file");
        return false;
    }

    CSVData* csv_data = malloc(sizeof(CSVData));
    
    csv_data->row_count = 3;
    csv_data->col_count = 2;
    csv_data->headers = malloc(2 * sizeof(char*));
    csv_data->headers[0] = strdup("Column1");
    csv_data->headers[1] = strdup("Column2");
    
    csv_data->data = malloc(3 * sizeof(char**));
    for (int i = 0; i < 3; i++) {
        csv_data->data[i] = malloc(2 * sizeof(char*));
        csv_data->data[i][0] = strdup("Data1");
        csv_data->data[i][1] = strdup("Data2");
    }

    *data = csv_data;
    fclose(file);
    return true;
}

// dummy
bool csv_write(const char* filename, const void* data) {
    const CSVData* csv_data = (const CSVData*)data;
    FILE* file = fopen(filename, "w");
    if (!file) {
        perror("Failed to create CSV file");
        return false;
    }

    for (int i = 0; i < csv_data->col_count; i++) {
        fprintf(file, "%s%s", csv_data->headers[i], 
                (i == csv_data->col_count - 1) ? "\n" : ",");
    }

    for (int i = 0; i < csv_data->row_count; i++) {
        for (int j = 0; j < csv_data->col_count; j++) {
            fprintf(file, "%s%s", csv_data->data[i][j], 
                    (j == csv_data->col_count - 1) ? "\n" : ",");
        }
    }

    fclose(file);
    return true;
}

void csv_free(void* data) {
    CSVData* csv_data = (CSVData*)data;
    if (!csv_data) return;

    for (int i = 0; i < csv_data->col_count; i++) {
        free(csv_data->headers[i]);
    }
    free(csv_data->headers);

    for (int i = 0; i < csv_data->row_count; i++) {
        for (int j = 0; j < csv_data->col_count; j++) {
            free(csv_data->data[i][j]);
        }
        free(csv_data->data[i]);
    }
    free(csv_data->data);
    free(csv_data);
}