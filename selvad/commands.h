/*
 * Copyright (c) 2023-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

/**
 * Traditional ping/pong.
 * module: server
 * cmd: ping
 */
#define CMD_ID_PING 0

/**
 * Echoes back the same strings that were present in the request.
 * module: server
 * cmd: echo
 */
#define CMD_ID_ECHO 1

/**
 * List all currently registered commands.
 * Can be used for commands discovery.
 * module: server
 * cmd: lscmd
 */
#define CMD_ID_LSCMD 2

/**
 * Start a server heartbeat.
 * module: server
 * cmd: hrt
 */
#define CMD_ID_HRT 3

/**
 * List supported languages.
 * module: server
 * cmd: lslang
 */
#define CMD_ID_LSLANG 4

/**
 * List loaded modules.
 * module: server
 * cmd: lsmod
 */
#define CMD_ID_LSMOD 5

/**
 * Show running configuration.
 * module: server
 * cmd: config
 */
#define CMD_ID_CONFIG 6

/**
 * Set or get loglevel.
 * module: server
 * cmd: loglevel
 */
#define CMD_ID_LOGLEVEL 7

/**
 * Toggle debug messages.
 * module: server
 * cmd: dbg
 */
#define CMD_ID_DBG 8

/**
 * Show malloc stats.
 * module: server
 * cmd: mallocstats
 */
#define CMD_ID_MALLOCSTATS 9

/**
 * Dump a jemalloc prof file.
 * module: server
 * cmd: mallocprofdump
 */
#define CMD_ID_MALLOCPROFDUMP 10

/**
 * Show resource usage info.
 * module: server
 * cmd: meminfo
 */
#define CMD_ID_RUSAGE 11

/**
 * Client ops.
 * module: server
 * cmd: client
 */
#define CMD_ID_CLIENT 12

/**
 * Load db.
 * module: io
 * cmd: load
 */
#define CMD_ID_LOAD 14

/**
 * Save db.
 * module: io
 * cmd: save
 */
#define CMD_ID_SAVE 15

/**
 * Flush the in-mem database.
 * module: io
 * cmd: flush
 */
#define CMD_ID_FLUSH 16

/**
 * Purge old SDB dumps.
 * module: io
 * cmd: purge
 */
#define CMD_ID_PURGE 17

/**
 * Resolve name to a nodeid.
 * module: db
 * cmd: resolve.nodeid
 */
#define CMD_ID_RESOLVE_NODEID 18

/**
 * Find.
 * module: db
 * cmd: hierarchy.find
 */
#define CMD_ID_HIERARCHY_FIND 19

/**
 * Aggregate.
 * module: db
 * cmd: hierarchy.aggregate
 */
#define CMD_ID_HIERARCHY_AGGREGATE 21

/*
 * HOLE 22
 */

/**
 * Edge add constraints.
 * module: db
 * cmd: hierarchy.addConstraint
 */
#define CMD_ID_HIERARCHY_ADDCONSTRAINT 23

/**
 * Edge list constraints.
 * module: db
 * cmd: hierarchy.listConstraints
 */
#define CMD_ID_HIERARCHY_LIST_CONSTRAINTS 24

/**
 * Delete node.
 * module: db
 * cmd: hierarchy.del
 */
#define CMD_ID_HIERARCHY_DEL 25

/**
 * Set node TTL.
 * module: db
 * cmd: hierarchy.expire
 */
#define CMD_ID_HIERARCHY_EXPIRE 26

/**
 * List hierarchy heads.
 * module: db
 * cmd: hierarchy.heads
 */
#define CMD_ID_HIERARCHY_HEADS 27

/**
 * List node parents.
 * module: db
 * cmd: hierarchy.parents
 */
#define CMD_ID_HIERARCHY_PARENTS 28

/**
 * List node children.
 * module: db
 * cmd: hierarchy.children
 */
#define CMD_ID_HIERARCHY_CHILDREN 29

/**
 * List node edges.
 * module: db
 * cmd: hierarchy.edgeList
 */
#define CMD_ID_HIERARCHY_EDGE_LIST 30

/**
 * Get node edges.
 * module: db
 * cmd: hierarchy.edgeGet
 */
#define CMD_ID_HIERARCHY_EDGE_GET 31

/**
 * Get node edge metadata.
 * module: db
 * cmd: hierarchy.edgeGetMetadata
 */
#define CMD_ID_HIERARCHY_EDGE_GET_METADATA 32

/**
 * Compress a hierarchy subtree.
 * module: db
 * cmd: hierarchy.compress
 */
#define CMD_ID_HIERARCHY_COMPRESS 33

/**
 * List compressed hierarchy subtrees.
 * module: db
 * cmd: hierarchy.listCompressed
 */
#define CMD_ID_HIERARCHY_LIST_COMPRESSED 34

/**
 * Get io version information.
 * module: io
 * cmd: ver
 */
#define CMD_ID_VER 35

/**
 * Add a new node type.
 * module: db
 * cmd: hierarchy.types.add
 */
#define CMD_ID_HIERARCHY_TYPES_ADD 36

/**
 * Clear all node types.
 * module: db
 * cmd: hierarchy.types.clear
 */
#define CMD_ID_HIERARCHY_TYPES_CLEAR 37

/**
 * List all known node types.
 * module: db
 * cmd: hierarchy.types.list
 */
#define CMD_ID_HIERARCHY_TYPES_LIST 38

/**
 * List find indices.
 * module: db
 * cmd: index.list
 */
#define CMD_ID_INDEX_LIST 39

/**
 * Create a new find index.
 * module: db
 * cmd: index.new
 */
#define CMD_ID_INDEX_NEW 40

/**
 * Delete a find index.
 * module: db
 * cmd: index.del
 */
#define CMD_ID_INDEX_DEL 41

/**
 * Update indexing accounting.
 * module: db
 * cmd: index.acc
 */
#define CMD_ID_INDEX_ACC 91

/**
 * Describe a find index.
 * module: db
 * cmd: index.debug
 */
#define CMD_ID_INDEX_DEBUG 42

/**
 * Indexing info.
 * module: db
 * cmd: index.debug
 */
#define CMD_ID_INDEX_INFO 43

/**
 * Evaluate an RPN expression into a bool.
 * module: db
 * cmd: rpn.evalBool
 */
#define CMD_ID_RPN_EVAL_BOOL 44

/**
 * Evaluate an RPN expression into a double.
 * module: db
 * cmd: rpn.evalDouble
 */
#define CMD_ID_RPN_EVAL_DOUBLE 45

/**
 * Evaluate an RPN expression into a string.
 * module: db
 * cmd: rpn.evalString
 */
#define CMD_ID_RPN_EVAL_STRING 46

/**
 * Evaluate an RPN expression into a set.
 * module: db
 * cmd: rpn.evalSet
 */
#define CMD_ID_RPN_EVAL_SET 47

/**
 * Delete a node data object field value.
 * module: db
 * cmd: object.del
 */
#define CMD_ID_OBJECT_DEL 48

/**
 * Check if a node data object field exists.
 * module: db
 * cmd: object.exists
 */
#define CMD_ID_OBJECT_EXISTS 49

/**
 * Get node data object or field.
 * module: db
 * cmd: object.get
 */
#define CMD_ID_OBJECT_GET 50

/**
 * Increment field value by long long.
 * module: db
 * cmd: object.incrby
 */
#define CMD_ID_OBJECT_INCRBY 51

/**
 * Increment field value by double.
 * module: db
 * cmd: object.incrbydouble
 */
#define CMD_ID_OBJECT_INCRBY_DOUBLE 52

/**
 * Get the length of a node data object field value.
 * module: db
 * cmd: object.len
 */
#define CMD_ID_OBJECT_LEN 53

/**
 * Set the value of a node data object field.
 * module: db
 * cmd: object.set
 */
#define CMD_ID_OBJECT_SET 54

/**
 * module: db
 * cmd: object.keys
 */
#define CMD_ID_OBJECT_KEYS 55

/**
 * Get the type of a node data object field.
 * module: db
 * cmd: object.type
 */
#define CMD_ID_OBJECT_TYPE 56

/**
 * Get the metadata associated with a node data object field.
 * module: db
 * cmd: object.getMeta
 */
#define CMD_ID_OBJECT_GETMETA 57

/**
 * Set the metadata associated with a node data object field.
 * module: db
 * cmd: object.setMeta
 */
#define CMD_ID_OBJECT_SETMETA 58

/**
 * Add subscription marker.
 * module: db
 * cmd: subscriptions.addMarker
 */
#define CMD_ID_SUBSCRIPTIONS_ADD_MARKER 59

/**
 * Add subscription marker.
 * module: db
 * cmd: subscriptions.addAlias
 */
#define CMD_ID_SUBSCRIPTIONS_ADD_ALIAS 60

/**
 * Add subscription trigger.
 * module: db
 * cmd: subscriptions.addTrigger
 */
#define CMD_ID_SUBSCRIPTIONS_ADD_TRIGGER 62

/**
 * Refresh subscription.
 * module: db
 * cmd: subscriptions.refresh
 */
#define CMD_ID_SUBSCRIPTIONS_REFRESH 63

/**
 * Refresh subscription marker.
 * module: db
 * cmd: subscriptions.refreshMarker
 */
#define CMD_ID_SUBSCRIPTIONS_REFRESH_MARKER 64

/**
 * List all current subscriptions or markers on this server.
 * module: db
 * cmd: subscriptions.list
 */
#define CMD_ID_SUBSCRIPTIONS_LIST 65

/**
 * Describe a subscription or marker.
 * module: db
 * cmd: subscriptions.debug
 */
#define CMD_ID_SUBSCRIPTIONS_DEBUG 67

/**
 * Delete a subscription.
 * module: db
 * cmd: subscriptions.del
 */
#define CMD_ID_SUBSCRIPTIONS_DEL 68

/**
 * Delete a subscription marker.
 * module: db
 * cmd: subscriptions.delMarker
 */
#define CMD_ID_SUBSCRIPTIONS_DELMARKER 69

/**
 * Modify a single node.
 * module: db
 * cmd: modify
 */
#define CMD_ID_MODIFY 70

/**
 * Update nodes using a query.
 * module: db
 * cmd: update
 */
#define CMD_ID_UPDATE 71

/**
 * List node aliases.
 * module: db
 * cmd: lsaliases
 */
#define CMD_ID_LSALIASES 72

/**
 * Start replication stream.
 * module: io
 * cmd: replicasync
 */
#define CMD_ID_REPLICASYNC 73

/**
 * Set this node as a replica of another node.
 * module: io
 * cmd: replicaof
 */
#define CMD_ID_REPLICAOF 74

/**
 * Show the current status of the replication module.
 * module: io
 * cmd: replicainfo
 */
#define CMD_ID_REPLICAINFO 75

/**
 * Replica status message.
 * Sent by a replica to the origin.
 * module: io
 * cmd: replicastatus
 */
#define CMD_ID_REPLICASTATUS 76

/**
 * Wait for replicas to sync.
 * Waits until all replicas are at current or newer eid (if new sync points are
 * created during the execution of this command).
 * module: io
 * cmd: replicawait
 */
#define CMD_ID_REPLICAWAIT 77

/**
 * Publish a message to a channel.
 * module: server
 * cmd: publish
 */
#define CMD_ID_PUBLISH 78

/**
 * Subscribe to a channel.
 * module: server
 * cmd: subscribe
 */
#define CMD_ID_SUBSCRIBE 79

/**
 * Unsubscribe from a channel.
 * module: server
 * cmd: unsubscribe
 */
#define CMD_ID_UNSUBSCRIBE 80

/**
 * Get a selva_string field flags, crc, and value.
 * module: db
 * cmd: object.getString
 */
#define CMD_ID_OBJECT_GET_STRING 81

/**
 * Compare & Swap a string.
 * module: db
 * cmd: object.cas
 */
#define CMD_ID_OBJECT_CAS 82

/**
 * Pipe.
 * module: piper
 * cmd: pipe
 */
#define CMD_ID_PIPE 83

/**
 * Create MQ.
 * module: mq
 * cmd: mq.create
 */
#define CMD_ID_MQ_CREATE 84

/**
 * Delete MQ.
 * module: mq
 * cmd: mq.delete
 */
#define CMD_ID_MQ_DELETE 85

/**
 * List MQs.
 * module: mq
 * cmd: mq.list
 */
#define CMD_ID_MQ_LIST 86

/**
 * MQ post.
 * module: mq
 * cmd: mq.post
 */
#define CMD_ID_MQ_POST 87

/**
 * MQ receive msg.
 * module: mq
 * cmd: mq.recv
 */
#define CMD_ID_MQ_RECV 88

/**
 * MQ ack msg.
 * module: mq
 * cmd: mq.ack
 */
#define CMD_ID_MQ_ACK 89

/**
 * MQ nack msg.
 * module: mq
 * cmd: mq.nack
 */
#define CMD_ID_MQ_NACK 90
