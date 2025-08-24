SHELL := /bin/bash
include ../db/clibs/common.mk

CFLAGS += -iquote ./include \
		  -include ../db/clibs/include/cdefs.h
OBJ = src/main.o \
	  src/converter.o \
	  src/formats/csv.o
TARGET = converter

all: $(TARGET)

$(TARGET): $(OBJ)
	$(CC) -o $@ $(LDFLAGS) $^

clean:
	rm -f $(OBJ) $(TARGET)

.PHONY: all clean
