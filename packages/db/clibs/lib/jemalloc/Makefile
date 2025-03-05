# Copyright (c) 2022-2025 SAULX
#
# SPDX-License-Identifier: MIT

JEMALLOC_VER := 5.3.0
JEMALLOC_CONFIG := --with-version=VERSION \
				   --with-lg-quantum=3 \
				   --disable-cxx \
				   --enable-xmalloc \
				   --disable-initial-exec-tls \
				   --enable-prof \
				   --with-jemalloc-prefix=selva_ \
				   --with-private-namespace=selva_ \
				   --with-install-suffix=_selva \
				   --with-malloc-conf=xmalloc:true
JEMALLOC_CFLAGS := -std=gnu99 -fPIC -Wall -Wno-missing-braces -pipe -g3 -O3 -funroll-loops
JEMALLOC_LDFLAGS := $(LDFLAGS)

ifeq ($(uname_S),Darwin)
	JEMALLOC_LIBDIR := "@rpath"
	# the configure script calls cpuid, but it does not work properly on Rosetta 2 and QEMU
	JEMALLOC_CONFIG += --with-lg-vaddr=48
	# TODO Might be unnecessary
	JEMALLOC_SYS_WITH_LG_VADDR := 48
	JEMALLOC_CFLAGS += -Wno-typedef-redefinition -Wno-frame-address
endif

.make-prerequisites:
	@touch jemalloc-$(JEMALLOC_VER)

all: .make-prerequisites jemalloc-$(JEMALLOC_VER)/config.status
	cd jemalloc-$(JEMALLOC_VER) && $(MAKE) CFLAGS="$(JEMALLOC_CFLAGS)" LDFLAGS="$(JEMALLOC_LDFLAGS)" LIBDIR="$(JEMALLOC_LIBDIR)" build_lib_shared
	cp -P jemalloc-$(JEMALLOC_VER)/lib/* "$(LIB_PATH)"
	rsync --checksum "jemalloc-$(JEMALLOC_VER)/include/jemalloc/jemalloc_selva.h" "../../include/jemalloc_selva.h"

jemalloc-$(JEMALLOC_VER)/config.status:
	cd jemalloc-$(JEMALLOC_VER) && ./configure $(JEMALLOC_CONFIG) CFLAGS="$(JEMALLOC_CFLAGS)" LDFLAGS="$(JEMALLOC_LDFLAGS)" LIBDIR="$(JEMALLOC_LIBDIR)"

clean:
	cd jemalloc-$(JEMALLOC_VER) && $(MAKE) clean
