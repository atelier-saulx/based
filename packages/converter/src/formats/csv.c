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

// https://www.microsoft.com/en-us/research/wp-content/uploads/2019/04/chunker-sigmod19.pdf
const int8_t fsm[6][4] = {
    {3, 1, 0, 2},
    {3, 1, 0, 2},
    {5, 1, 0, 2},
    {4, 3, 3, 3},
    {3, 1, 0, 5},
    {5, 5, 5, 5}
};

char* append_char(char* buffer, char ch, size_t* size, size_t* capacity) {
    if (*size + 1 >= *capacity) {
        *capacity *= 2;
        buffer = realloc(buffer, *capacity);
        if (!buffer) {
            perror("Failed to reallocate buffer");
            return NULL;
        }
    }
    buffer[(*size)++] = ch;
    return buffer;
}

void add_field_to_record(CSVData* csv_data, char* field, int* current_col, bool is_header) {
    if (is_header) {
        csv_data->headers = realloc(csv_data->headers, (csv_data->col_count + 1) * sizeof(char*));
        if (!csv_data->headers) {
            perror("Failed to reallocate headers");
            exit(EXIT_FAILURE);
        }
        csv_data->headers[csv_data->col_count] = field;
        csv_data->col_count++;
    } else {
        if (*current_col >= csv_data->col_count) {
            csv_data->data[csv_data->row_count - 1] = realloc(csv_data->data[csv_data->row_count - 1], (*current_col + 1) * sizeof(char*));
        }
        csv_data->data[csv_data->row_count - 1][*current_col] = field;
        (*current_col)++;
    }
}

void add_new_record(CSVData* csv_data, int* current_col) {
    if (csv_data->row_count > 0 && *current_col < csv_data->col_count) {
        for (int i = *current_col; i < csv_data->col_count; i++) {
            csv_data->data[csv_data->row_count - 1][i] = NULL;
        }
    }
    csv_data->data = realloc(csv_data->data, (csv_data->row_count + 1) * sizeof(char**));
    if (!csv_data->data) {
        perror("Failed to reallocate data rows");
        exit(EXIT_FAILURE);
    }
    csv_data->data[csv_data->row_count] = malloc(csv_data->col_count * sizeof(char*));
    if (!csv_data->data[csv_data->row_count]) {
        perror("Failed to allocate data row");
        exit(EXIT_FAILURE);
    }
    csv_data->row_count++;
    *current_col = 0;
}

bool csv_read(const char* filename, void** data) {
    FILE* file = fopen(filename, "r");
    if (!file) {
        perror("Failed to open CSV file");
        return false;
    }

    CSVData* csv_data = malloc(sizeof(CSVData));
    if (!csv_data) {
        perror("Failed to allocate CSVData");
        fclose(file);
        return false;
    }
    memset(csv_data, 0, sizeof(CSVData));

    int current_state = RECORD_START;
    int current_char_type;
    char ch;

    size_t current_field_capacity = 16;
    size_t current_field_size = 0;
    char* current_field_buffer = malloc(current_field_capacity);
    if (!current_field_buffer) {
        perror("Failed to allocate field buffer");
        fclose(file);
        free(csv_data);
        return false;
    }

    bool is_header = true;
    int current_col = 0;

    while ((ch = fgetc(file)) != EOF) {
        if (current_state == RECORD_START) {
            current_field_buffer = append_char(current_field_buffer, '\0', &current_field_size, &current_field_capacity);
            add_field_to_record(csv_data, strdup(current_field_buffer), &current_col, is_header);
            current_field_size = 0;
            is_header = false;
            add_new_record(csv_data, &current_col);
        }

        current_char_type = parse_char(ch);
        int next_state = fsm[current_state][current_char_type];

        if (next_state != RECORD_START && next_state != ERROR){
            current_field_buffer = append_char(current_field_buffer, ch, &current_field_size, &current_field_capacity);
        }
        if (next_state == ERROR) {
            fprintf(stderr, "Parsing error at char '%c'.\n", ch);
            fclose(file);
            free(current_field_buffer);
            *data = NULL;
            return false;
        };
        
        current_state = next_state;
    }

    if (current_state != ERROR) {
        current_field_buffer = append_char(current_field_buffer, '\0', &current_field_size, &current_field_capacity);
        add_field_to_record(csv_data, strdup(current_field_buffer), &current_col, is_header);
        is_header = false;
    }
    
    free(current_field_buffer);
    fclose(file);
    *data = csv_data;
    
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