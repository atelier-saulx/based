CC = clang
CFLAGS = -Wall -Wextra -std=gnu23 -g
INCLUDES = -Iinclude -Isrc

SRC = src/main.c src/converter.c src/formats/csv.c
OBJ = $(SRC:.c=.o)
TARGET = bin/converter

.PHONY: all clean

all: $(TARGET)

$(TARGET): $(OBJ)
	$(CC) $(CFLAGS) $(INCLUDES) -o $@ $^

%.o: %.c
	$(CC) $(CFLAGS) $(INCLUDES) -c -o $@ $<

clean:
	rm -f $(OBJ) $(TARGET)