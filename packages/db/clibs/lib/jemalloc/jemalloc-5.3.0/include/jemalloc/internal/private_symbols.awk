#!/usr/bin/env awk -f

BEGIN {
  sym_prefix = "_"
  split("\
        _selva_aligned_alloc \
        _selva_calloc \
        _selva_dallocx \
        _selva_free \
        _selva_mallctl \
        _selva_mallctlbymib \
        _selva_mallctlnametomib \
        _selva_malloc \
        _selva_malloc_conf \
        _selva_malloc_conf_2_conf_harder \
        _selva_malloc_message \
        _selva_malloc_stats_print \
        _selva_malloc_usable_size \
        _selva_mallocx \
        _selva_smallocx_54eaed1d8b56b1aa528be3bdd1877e59c56fa90c \
        _selva_nallocx \
        _selva_posix_memalign \
        _selva_rallocx \
        _selva_realloc \
        _selva_sallocx \
        _selva_sdallocx \
        _selva_xallocx \
        _selva_valloc \
        _selva_malloc_size \
        _pthread_create \
        ", exported_symbol_names)
  # Store exported symbol names as keys in exported_symbols.
  for (i in exported_symbol_names) {
    exported_symbols[exported_symbol_names[i]] = 1
  }
}

# Process 'nm -a <c_source.o>' output.
#
# Handle lines like:
#   0000000000000008 D opt_junk
#   0000000000007574 T malloc_initialized
(NF == 3 && $2 ~ /^[ABCDGRSTVW]$/ && !($3 in exported_symbols) && $3 ~ /^[A-Za-z0-9_]+$/) {
  print substr($3, 1+length(sym_prefix), length($3)-length(sym_prefix))
}

# Process 'dumpbin /SYMBOLS <c_source.obj>' output.
#
# Handle lines like:
#   353 00008098 SECT4  notype       External     | opt_junk
#   3F1 00000000 SECT7  notype ()    External     | malloc_initialized
($3 ~ /^SECT[0-9]+/ && $(NF-2) == "External" && !($NF in exported_symbols)) {
  print $NF
}
