#include "../include/csv.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

enum state {
    RECORD_START,
    FIELD_START,
    UNQUOTED_FIELD,
    QUOTED_FIELD,
    QUOTED_END,
    ERROR,
};

const char states[] = {'R','F','U','Q','E','X'};

enum chars {
    QUOTE,
    COMMA,
    NEWLINE,
    OTHER,
};

int parse_char (char ch){
    switch (ch){
        case '"':
            return QUOTE;
            break;
        case ',':
            return COMMA;
            break;
        case '\n':
            return NEWLINE;
            break;
        default:
            return OTHER;
            break;
    }
}

const int8_t fsm[6][4] = {
    {3, 1, 0, 2},
    {3, 1, 0, 2},
    {5, 1, 0, 2},
    {4, 3, 3, 3},
    {3, 1, 0, 5},
    {5, 5, 5, 5}
};

bool csv_read(const char* filename, void** data) {
    FILE* file = fopen(filename, "r");
    if (!file) {
        perror("Failed to open CSV file");
        return false;
    }

    CSVData* csv_data = malloc(sizeof(CSVData));

    int current_state = 0;
    char ch;
    
    while ((ch = fgetc(file)) != EOF) {
        current_state = fsm[current_state][parse_char(ch)];
        printf(" %c = %c", states[current_state], ch);
    }

    csv_data->row_count = 3;
    csv_data->col_count = 2;
    csv_data->headers = malloc(2 * sizeof(char*));
    csv_data->headers[0] = strdup("\"Column1\"");
    csv_data->headers[1] = strdup("\"Column2\"");
    
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