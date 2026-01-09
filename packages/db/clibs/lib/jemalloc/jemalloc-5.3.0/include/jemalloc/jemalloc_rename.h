/*
 * Name mangling for public symbols is controlled by --with-mangling and
 * --with-jemalloc-prefix.  With default settings the je_ prefix is stripped by
 * these macro definitions.
 */
#ifndef JEMALLOC_NO_RENAME
#  define je_aligned_alloc selva_aligned_alloc
#  define je_calloc selva_calloc
#  define je_dallocx selva_dallocx
#  define je_free selva_free
#  define je_mallctl selva_mallctl
#  define je_mallctlbymib selva_mallctlbymib
#  define je_mallctlnametomib selva_mallctlnametomib
#  define je_malloc selva_malloc
#  define je_malloc_conf selva_malloc_conf
#  define je_malloc_conf_2_conf_harder selva_malloc_conf_2_conf_harder
#  define je_malloc_message selva_malloc_message
#  define je_malloc_stats_print selva_malloc_stats_print
#  define je_malloc_usable_size selva_malloc_usable_size
#  define je_mallocx selva_mallocx
#  define je_smallocx_54eaed1d8b56b1aa528be3bdd1877e59c56fa90c selva_smallocx_54eaed1d8b56b1aa528be3bdd1877e59c56fa90c
#  define je_nallocx selva_nallocx
#  define je_posix_memalign selva_posix_memalign
#  define je_rallocx selva_rallocx
#  define je_realloc selva_realloc
#  define je_sallocx selva_sallocx
#  define je_sdallocx selva_sdallocx
#  define je_xallocx selva_xallocx
#  define je_valloc selva_valloc
#  define je_malloc_size selva_malloc_size
#endif
