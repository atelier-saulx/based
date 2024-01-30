/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

/*
 * See include/event_loop.h for event loop limits.
 */

/*
 * Generic tunables.
 */

#define FALLBACK_LANG "en"

/**
 * Debug memory usage.
 * 0 or undefined = Nothing
 * 1 = Clear some memory areas before freeing
 */
#define MEM_DEBUG 1

#define TCP_KEEPALIVE_TIME 7200
#define TCP_KEEPALIVE_INTVL 75
#define TCP_KEEPALIVE_PROBES 9

/*
 * SVector tunables.
 */

/**
 * Threshold to migrate from an SVECTOR_MODE_ARRAY to SVECTOR_MODE_RBTREE.
 */
#define SVECTOR_THRESHOLD 100

/**
 * How much memory to allocate when more memory is needed in
 * SVECTOR_MODE_RBTREE mode.
 */
#define SVECTOR_SLAB_SIZE 4194304

/*
 * Server tunables.
 */

/**
 * Maximum number of streams per client.
 * Keep in mind that increasing this tunable increases the memory consumption
 * extremely heavily.
 */
#define SERVER_MAX_STREAMS 3

/**
 * Maximum number of query fork processes.
 */
#define MAX_QUERY_FORKS 16

/*
 * Replication tunables.
 */

/**
 * Size of the origin ring buffer for replication.
 */
#define REPLICATION_RING_BUFFER_SIZE 1024

/**
 * Maximum number of replica clients to an origin.
 */
#define REPLICATION_MAX_REPLICAS 32

/*
 * Hierarchy tunables.
 */

/**
 * Hierarchy node pool slab size in bytes.
 */
#define HIERARCHY_SLAB_SIZE 33554432

/**
 * How many inactive nodes can be tracked simultaneously.
 * Adjusting this shouldn't affect much unless the lest remains full all the
 * time.
 */
#define HIERARCHY_AUTO_COMPRESS_INACT_NODES_LEN (4096 / SELVA_NODE_ID_SIZE)

/*
 * Command tunables.
 */

/**
 * Maximum number of update operations per a single command.
 */
#define SELVA_CMD_UPDATE_MAX 300

/*
 * RPN Tunables.
 */

/**
 * Operand buffer size.
 * Small operands don't require malloc and are faster to operate with.
 * In general this should be at least 1 byte bigger than the nodeId size to keep
 * expressions operating on nodeIds fast. It should be also larger than the
 * size of a void pointer to make sure that if a pointer is stored in it but
 * the value is used as a string, still nothing extremely bad will happen.
 */
#define RPN_SMALL_OPERAND_SIZE          11

/**
 * Small operand pool size.
 * Small operands are pooled to speed up evaluating simple expressions.
 */
#define RPN_SMALL_OPERAND_POOL_SIZE     70

/**
 * Max RPN stack depth.
 */
#define RPN_MAX_D                       256

/**
 * Max number of forward jump labels in a single expression.
 */
#define RPN_MAX_LABELS                  128

/*
 * Dynamic Find Query Index Tunables.
 */

#define SELVA_INDEX_MAX_HINTS_CMD       20 /*!< Maximum number of indexing hints per find command. */
#define SELVA_INDEX_MAX_HINTS           500 /*!< Maximum number of indexing hints tracked. */
