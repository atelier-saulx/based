<!--
Copyright (c) 2022-2024 SAULX

SPDX-License-Identifier: MIT
-->

# Module: IO

## SDB Serialization Format

Selva binary dump serialization format (.sdb).

```
   | 00 01 02 03 04 05 06 07
===+=========================+
00 | 53 45 4C 56 41 00 00 00 | Magic string "SELVA\0\0\0"
   |-------------------------|
08 | 00 00 00 00 00 00 00 00 | Created with version hash
10 | 00 00 00 00 00 00 00 00 | 40 bytes
18 | 00 00 00 00 00 00 00 00 | human-readable
20 | 00 00 00 00 00 00 00 00 |
28 | 00 00 00 00 00 00 00 00 |
   |-------------------------|
30 | 00 00 00 00 00 00 00 00 | Updated with version hash
38 | 00 00 00 00 00 00 00 00 | 40 bytes
40 | 00 00 00 00 00 00 00 00 | human-readable
48 | 00 00 00 00 00 00 00 00 |
50 | 00 00 00 00 00 00 00 00 |
   |-------------------------|
58 | 01 00 00 00 00 00 00 00 | uin32_t version | uint32_t flags
   |=========================|
60 |                         | Data stored as selva_proto structs:
   |          UDATA          | - selva_proto_double
   |          UDATA          | - selva_proto_longlong (signed and unsigned)
   |                         | - selva_proto_string (char* and selva_string)
   |=========================|
   | 00 00 00 41 56 4C 45 53 | Magic string "\0\0\0AVLES"
   |-------------------------|
   | XX XX XX XX XX XX XX XX | SHA-3 of the file
   | XX XX XX XX XX XX XX XX | from 0 to the beginning last magic string but
   | XX XX XX XX XX XX XX XX | over uncompressed data.
   | XX XX XX XX XX XX XX XX | binary
```

## Replication

The replication protocol has two roles *origin* and *replica*. There can be
only one *origin* in the system and multiple *replica* nodes that are
registered to the origin node.

The replication protocol is technically a regular `selva_proto` commands stream
sent as a response to `replica_sync` command, which utilizes a few special
commands and message types to carry out the replication.

### Replication Related Commands

```
CMD_ID_REPLICAOF port addr
```

This command is executed by the user to tell a *replica* node where the
designated *origin* is located. The origin doesn't need to be running yet at
this point as the *replica* will keep retrying to establish the connection
indefinitely.

```
CMD_ID_REPLICASYNC [known_sdb_hash, known_sdb_eid]
```

This command is sent by the replica node to the origin to start the replication
message stream.

When the `sdb_hash` and `sdb_eid` tuple is given a partial sync is attempted,
where the existing state (loaded from a dump) of the replica is set as the epoch
of the replication protocol.

If the partial sync fails, due to the origin not agreeing on the epoch state or
any other reason, the replica can try to send the same command without any
arguments to trigger a full sync. In full sync the origin will send the replica
a full SDB dump that the replica can load to act as an epoch state.

The response stream can contain three message types:
- `SELVA_PROTO_ERROR` to signal an error and finish the current connection,
- `SELVA_PROTO_REPLICATION_CMD` to replicate a command, and
- `SELVA_PROTO_REPLICATION_SDB` to send SDB metadata and load a new SDB.

```
CMD_ID_REPLICASTATUS EID
```

This command is sent periodically from the replicas to the origin so that the
origin will know where the replicas are.

```
CMD_ID_PING
```

This command isn't directly related to the replication protocol, but it's used
by the origin to determine if a replica is still alive. The ping command is sent
periodically to each replica encapsulated in a `SELVA_PROTO_REPLICATION_CMD`
message.

```
CMD_ID_REPLICAWAIT opt_timeout
```

This command can be sent by the user to the origin. The command will block the
caller until all replicas considered active at the moment have caught up with
the origin.

```
CMD_ID_REPLICAINFO
```

This command can be sent by the user to any node to inspect the current observed
state of the replication protocol. On a replica it will show the latest state
received from the origin and on the origin it will show the origin's state as
well as the last known state of each replica it considers to be active.

### Operation

**Symbols**

- ○ command
- ◌ incomplete dump
- ● dump (SDB)
- ◎ known dump state

**Normal Replication Operation**

```
Origin

eid 0   1   2   3   4         5   6   7   8   9
    ●---○---○---○---●---------○---○---◌---○---○


Replica

    ●---○---○---○---◎---------○---○---◌---○---
```

Replica either originally had the dump for eid=0 or it received it in full-sync
when the replication protocol was started. This is called the epoch of the
replication protocol.

Replica has successfully received and applied commands 1 to 3.

Replica has been informed about the dump 4 but it hasn't received the file. The
information was sent to the replica when the dump was already finished. If
Replica should disconnect or restart now and join the replication protocol
again, then Origin would send this SDB dump as the new epoch for the replication
protocol and replicate (repeat) all the other commands in the same order.

Replica has received and applied commands 5 and 6.

Replica has received information about the incomplete dump of eid 7 that's still
running in a separate process on Origin's machine. In this case Replica was
informed about this dump almost immediately when the dump process was started.
Either can happen as the dumps are not hard-sync points for the replication
protocol and thus incomplete dump metadata can be sent right away.

Replica has received and applied eid=8. 
Replica hasn't yet received the change described in eid=9.

**Rollback or loading an unrelated SDB**

```
Origin

eid 0   1   2   3   4         5   6   7   8   9
    ●---○---○---○---●---------○---○---◌---○---○


Replica

    ●---○---○---○---●---------○---○---◎---○---
```

Everything works similar to the previous example except that in case of eid=4
Origin will send not only the dump metadata but also the dump file, which forces
Replica to load the received dump and replace its current state. This event
starts a new epoch in the replication protocol.
