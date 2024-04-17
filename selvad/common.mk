# Copyright (c) 2022-2024 SAULX
# SPDX-License-Identifier: MIT

# Anything defined here will generally shared by all build goals except
# libraries, unless the library Makefile explicitly imports this file.

# OS name (Linux, Darwin)
uname_S := $(shell sh -c 'uname -s 2>/dev/null || echo not')
uname_M := $(shell sh -c 'uname -m 2>/dev/null || echo not')

EN_VALGRIND_CFLAGS := -Dselva_malloc=malloc -Dselva_calloc=calloc -Dselva_realloc=realloc -Dselva_free=free

# Set _DATE__ and __TIME__ macros to a deterministic value
export SOURCE_DATE_EPOCH := $(shell sh -c 'git log -1 --pretty=%ct || date +%s')
export ZERO_AR_DATE := 1

CC += -fdiagnostics-color=always

# CFLAGS shared with all compilation units.
# TODO gnu23 when available
CFLAGS := -std=gnu2x -pthread -O2 -MMD -Wall -Wextra -Wpointer-arith -Wdate-time -Wmissing-prototypes
CFLAGS += -DDCACHE_LINESIZE=64
CFLAGS += -fstack-protector

LDFLAGS += -pthread

# Add these for valgrind
ifeq ($(EN_VALGRIND),1)
CFLAGS += $(EN_VALGRIND_CFLAGS)
endif

ifeq ($(uname_S),Linux) # Assume Intel x86-64 Linux
	CFLAGS += -g -ggdb3 -fno-math-errno -ftree-vectorize
	#CFLAGS += -fanalyzer -Wno-analyzer-null-dereference
	#CFLAGS += -opt-info-vec-optimized
	#CFLAGS += -ftree-vectorizer-verbose=5 -fopt-info-vec-missed

	TARGET_CFLAGS += -D_FORTIFY_SOURCE=3
	# Not yet available on macOS
	TARGET_CFLAGS += -fstack-clash-protection
	ifeq ($(uname_M),x86_64)
		TARGET_CFLAGS += -march=x86-64 -mtune=intel -mfpmath=sse -mavx -mavx2 -mbmi -mbmi2 -mlzcnt -mmovbe -mprfchw
		TARGET_CFLAGS += -fcf-protection=full
	endif

	CFLAGS += $(TARGET_CFLAGS) -Wstrict-aliasing=3
	LDFLAGS += -Wl,--no-as-needed -z noexecstack -z relro -z now

	LIB_SUFFIX := .so
	MOD_SUFFIX := .so
endif
ifeq ($(uname_S),Darwin) # Assume macOS
	ROSETTA2 := $(shell sh -c 'sysctl -n sysctl.proc_translated 2>/dev/null || echo 0')

	CFLAGS += -g -Wno-c11-extensions -Wno-unknown-attributes

	ifeq ($(uname_M),x86_64)
		TARGET_CFLAGS += -march=x86-64
		ifeq ($(ROSETTA2),0)
			TARGET_CFLAGS += -mtune=core-avx2 -mfpmath=sse -mavx -mavx2
			TARGET_CFLAGS += -fcf-protection=full
		endif
	endif
	ifeq ($(uname_M),arm64)
		TARGET_CFLAGS += -mcpu=apple-m1
		TARGET_CFLAGS += -mbranch-protection=standard
	endif

	CFLAGS += $(TARGET_CFLAGS)

	LIB_SUFFIX := .dylib
	MOD_SUFFIX := .so
endif
