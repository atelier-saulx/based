# Copyright (c) 2022-2023, 2025 SAULX
# SPDX-License-Identifier: MIT

include ../../common.mk

# Add here one or more include directories.
IDIR := ../../include ../../lib/selva/include

# Set this to 1 if you will use asserts that compares floats or doubles;
# or 0 disable
PU_LMATH := 1

# Enable Unix Unit (incl. stdin_writer)
PU_UU := 1

# Report oriented mode prints more additional information like test module and
# test case descriptions. 0 = disabled; 1 = enabled.
PU_REPORT_ORIENTED := 1

CFLAGS := $(CFLAGS) \
		   -Wextra -Wno-unused-value -Wno-unused-parameter -Wno-implicit-function-declaration \
		   -Wno-unknown-attributes \
		   $(EN_VALGRIND_CFLAGS) \
		   -g3

ifeq ($(uname_S),Linux)
LDFLAGS := -Wl,-rpath,'$$ORIGIN'/../../../../dist/lib/$(PLATFORM)
endif
ifeq ($(uname_S),Darwin)
LDFLAGS := -Wl,-rpath,@executable_path/../../../../dist/lib/$(PLATFORM)
endif
LDFLAGS += -L ../../../dist/lib/$(PLATFORM) -ljemalloc_selva -ldeflate

#export LD_LIBRARY_PATH=`echo $LD_LIBRARY_PATH`:$(LIBDIR)

# Location of punit makefile
# Do not touch
include ../punit/Makefile.punit
