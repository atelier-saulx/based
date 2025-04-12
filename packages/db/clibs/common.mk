# Copyright (c) 2022-2025 SAULX
# SPDX-License-Identifier: MIT

# Anything defined here will generally shared by all build goals except
# libraries, unless the library Makefile explicitly imports this file.

lc = $(subst A,a,$(subst B,b,$(subst C,c,$(subst D,d,$(subst E,e,$(subst F,f,$(subst G,g,$(subst H,h,$(subst I,i,$(subst J,j,$(subst K,k,$(subst L,l,$(subst M,m,$(subst N,n,$(subst O,o,$(subst P,p,$(subst Q,q,$(subst R,r,$(subst S,s,$(subst T,t,$(subst U,u,$(subst V,v,$(subst W,w,$(subst X,x,$(subst Y,y,$(subst Z,z,$1))))))))))))))))))))))))))

# OS name (Linux, Darwin)
uname_S := $(shell sh -c 'uname -s 2>/dev/null || echo not')
uname_M := $(subst arm64,aarch64,$(shell sh -c 'uname -m 2>/dev/null || echo not'))
PLATFORM := $(call lc,$(uname_S))_$(call lc,$(uname_M))

EN_VALGRIND_CFLAGS := -Dselva_malloc=malloc -Dselva_calloc=calloc -Dselva_realloc=realloc -Dselva_aligned_alloc=aligned_alloc -Dselva_free=free -DEN_VALGRIND

# Set _DATE__ and __TIME__ macros to a deterministic value
export SOURCE_DATE_EPOCH := $(shell sh -c 'git log -1 --pretty=%ct || date +%s')
export ZERO_AR_DATE := 1

CC += -fdiagnostics-color=always

# CFLAGS shared with all compilation units.
CFLAGS := -std=gnu23 -pthread -O2 -MMD -fstack-protector \
		  -Wall -Wextra -Wpointer-arith -Wdate-time -Wmissing-prototypes \
		  -DDCACHE_LINESIZE=64

LDFLAGS += -pthread

# Normally you don't want to set this here but if you do, then it must be exported
#export EN_VALGRIND := 1

# Add these for valgrind
ifeq ($(EN_VALGRIND),1)
	CFLAGS += $(EN_VALGRIND_CFLAGS)
endif

# Must use LD_PRELOAD=/usr/lib/gcc/aarch64-linux-gnu/12/libasan.so to load libasan
# or /lib64/libasan.so.8 on Fedora
ifeq ($(EN_SANIT),1)
	SANITIZERS := address,leak,undefined
	CFLAGS += -fsanitize=$(SANITIZERS) -fno-omit-frame-pointer
	CFLAGS += -fanalyzer -Wno-analyzer-possible-null-dereference -Wno-analyzer-null-dereference
	LDFLAGS += -fsanitize=$(SANITIZERS)
endif

ifeq ($(uname_S),Linux)
	CFLAGS += -g -ggdb3 -fno-math-errno -ftree-vectorize -Wstrict-aliasing=3
	#CFLAGS += -opt-info-vec-optimized
	#CFLAGS += -ftree-vectorizer-verbose=5 -fopt-info-vec-missed

	CFLAGS += -D_FORTIFY_SOURCE=3
	# Not yet available on macOS
	CFLAGS += -fstack-clash-protection

	#CFLAGS += -fharden-compares -fstack-protector-strong -D_GLIBCXX_ASSERTIONS
	#LDFLAGS += -fharden-compares -fstack-protector-strong -fstack-clash-protection

	ifeq ($(uname_M),x86_64)
		ASFLAGS += -march=x86-64 -mtune=intel
		CFLAGS += -march=x86-64 -mtune=intel -mfpmath=sse -mavx -mavx2 -mbmi -mbmi2 -mlzcnt -mmovbe -mprfchw
		CFLAGS += -fcf-protection=full
	endif
	ifeq ($(uname_M),aarch64)
		CFLAGS += -march=armv8.2-a+simd+fp16+crc+crypto
		CFLAGS += -mbranch-protection=standard
	endif

	LDFLAGS += -Wl,--no-as-needed -z noexecstack -z relro -z now

	LIB_SUFFIX := .so
endif
ifeq ($(uname_S),Darwin) # Assume macOS
	CFLAGS += -g -Wno-c11-extensions -Wno-unknown-attributes

	ifeq ($(uname_M),x86_64)
		$(error Unsupported platform darwin_x86_64)
	endif
	ifeq ($(uname_M),aarch64)
		CFLAGS += -mcpu=apple-m1
		CFLAGS += -mbranch-protection=standard
	endif

	LIB_SUFFIX := .dylib
endif

ifndef LIB_SUFFIX
$(error LIB_SUFFIX is not set)
endif
