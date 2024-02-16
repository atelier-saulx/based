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

**Symbols**

- ○ mutating command
- ◌ incomplete dump
- ● dump (SDB)
- ◎ known dump state

### Normal Replication Operation

```
Origin

eid 0   1   2   3   4         5   6   7   8   9
    ●---○---○---○---●---------○---○---◌---○---○


Replica

    ●---○---○---○---◌---------○---○---◌---○---
```

Replica either originally had the dump for eid=0 or it received it in full-sync
when the replication protocol was started. This is called the epoch of the
replication protocol.

Replica has successfully received and applied commands 1 to 3.

Replica has been informed about the dump 4 but it hasn't received the file.

Replica has received and applied commands 5 and 6.

Replica has received information about the incomplete dump of eid 7 that's still
running in a separate process on Origin's machine.

Replica has received and applied eid=8. If Replica should disconnect or restart
and join the replication protocol again, then Origin would send this SDB dump as
the new epoch for the replication protocol.

Replica hasn't yet received the change described in eid=9.

### Rollback or Loading Another DB

```
Origin

eid 0   1   2   3   4         5   6   7   8   9
    ●---○---○---○---●---------○---○---◌---○---○


Replica

    ●---○---○---○---●---------○---○---◌---○---
```

Everything works similar to the previous example except that in case of eid=4
Origin will send not only the dump metadata but also the dump file, which forces
Replica to load the received dump and replace its current state. This event
starts a new epoch in the replication protocol.
