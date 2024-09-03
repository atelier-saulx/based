const std = @import("std");
const c = @import("c.zig");
const selvaLib = @import("selva.zig");

pub fn jsThrow(env: c.napi_env, message: [:0]const u8) c.napi_value {
    const result = c.napi_throw_error(env, null, message);
    switch (result) {
        c.napi_ok, c.napi_pending_exception => {},
        else => unreachable,
    }
    return null;
}

pub const Napi = error{
    CannotGetBuffer,
    CannotInitCtx,
    CannotGetString,
    CannotGetInt32,
    CannotGetUint64,
};

pub const SelvaError = error{
    DB_NOT_CREATED,
    SELVA_EGENERAL,
    SELVA_ENOTSUP,
    SELVA_EINVAL,
    SELVA_ERANGE,
    SELVA_EINTYPE,
    SELVA_ENAMETOOLONG,
    SELVA_ENOMEM,
    SELVA_ENOENT,
    SELVA_EEXIST,
    SELVA_EACCES,
    SELVA_ENOBUFS,
    SELVA_EINPROGRESS,
    SELVA_EIO,

    // Other errors
    UNKNOWN_ERROR,
    SELVA_CANNOT_UPSERT,
};

pub fn selva(rc: c_int) SelvaError!void {
    // errors enum is never 0 so this return void when rc == 0
    try switch (rc) {
        0 => {},
        selvaLib.SELVA_EGENERAL => SelvaError.SELVA_EGENERAL,
        selvaLib.SELVA_ENOTSUP => SelvaError.SELVA_ENOTSUP,
        selvaLib.SELVA_EINVAL => SelvaError.SELVA_EINVAL,
        selvaLib.SELVA_ERANGE => SelvaError.SELVA_ERANGE,
        selvaLib.SELVA_EINTYPE => SelvaError.SELVA_EINTYPE,
        selvaLib.SELVA_ENAMETOOLONG => SelvaError.SELVA_ENAMETOOLONG,
        selvaLib.SELVA_ENOMEM => SelvaError.SELVA_ENOMEM,
        selvaLib.SELVA_ENOENT => SelvaError.SELVA_ENOENT,
        selvaLib.SELVA_EEXIST => SelvaError.SELVA_EEXIST,
        selvaLib.SELVA_EACCES => SelvaError.SELVA_EACCES,
        selvaLib.SELVA_ENOBUFS => SelvaError.SELVA_ENOBUFS,
        selvaLib.SELVA_EINPROGRESS => SelvaError.SELVA_EINPROGRESS,
        selvaLib.SELVA_EIO => SelvaError.SELVA_EIO,
        else => SelvaError.UNKNOWN_ERROR,
    };
}

pub const DbError = error{SHARD_NOT_CREATED};

pub const MdbError = error{
    // OS errors
    INVAL,
    ACCES,
    NOMEM,
    NOENT,
    AGAIN,
    NOSPC,
    BUSY,
    INTR,
    PIPE,
    IO,

    // MDB errors
    MDB_KEYEXIST,
    MDB_NOTFOUND,
    MDB_PAGE_NOTFOUND,
    MDB_CORRUPTED,
    MDB_PANIC,
    MDB_VERSION_MISMATCH,
    MDB_INVALID,
    MDB_MAP_FULL,
    MDB_DBS_FULL,
    MDB_READERS_FULL,
    MDB_TLS_FULL,
    MDB_TXN_FULL,
    MDB_CURSOR_FULL,
    MDB_PAGE_FULL,
    MDB_MAP_RESIZED,
    MDB_INCOMPATIBLE,
    MDB_BAD_RSLOT,
    MDB_BAD_TXN,
    MDB_BAD_VALSIZE,
    MDB_BAD_DBI,

    // Other errors
    UNKNOWN_ERROR,
};

pub fn mdb(rc: c_int) MdbError!void {
    // errors enum is never 0 so this return void when rc == 0
    try switch (rc) {
        c.MDB_SUCCESS => {},

        // Key/data pair already exists
        c.MDB_KEYEXIST => MdbError.MDB_KEYEXIST,

        // No matching key/data pair found
        c.MDB_NOTFOUND => MdbError.MDB_NOTFOUND,

        // Requested page not found
        c.MDB_PAGE_NOTFOUND => MdbError.MDB_PAGE_NOTFOUND,

        // Located page was wrong type
        c.MDB_CORRUPTED => MdbError.MDB_CORRUPTED,

        // Update of meta page failed or environment had fatal error
        c.MDB_PANIC => MdbError.MDB_PANIC,

        // Database environment version mismatch
        c.MDB_VERSION_MISMATCH => MdbError.MDB_VERSION_MISMATCH,

        // File is not an LMDB file
        c.MDB_INVALID => MdbError.MDB_INVALID,

        // Environment mapsize limit reached
        c.MDB_MAP_FULL => MdbError.MDB_MAP_FULL,

        // Environment maxdbs limit reached
        c.MDB_DBS_FULL => MdbError.MDB_DBS_FULL,

        // Environment maxreaders limit reached
        c.MDB_READERS_FULL => MdbError.MDB_READERS_FULL,

        // Thread-local storage keys full - too many environments open
        c.MDB_TLS_FULL => MdbError.MDB_TLS_FULL,

        // Transaction has too many dirty pages - transaction too big
        c.MDB_TXN_FULL => MdbError.MDB_TXN_FULL,

        // Internal error - cursor stack limit reached
        c.MDB_CURSOR_FULL => MdbError.MDB_CURSOR_FULL,

        // Internal error - page has no more space
        c.MDB_PAGE_FULL => MdbError.MDB_PAGE_FULL,

        // Database contents grew beyond environment mapsize
        c.MDB_MAP_RESIZED => MdbError.MDB_MAP_RESIZED,

        // Operation and DB incompatible, or DB flags changed
        c.MDB_INCOMPATIBLE => MdbError.MDB_INCOMPATIBLE,

        // Invalid reuse of reader locktable slot
        c.MDB_BAD_RSLOT => MdbError.MDB_BAD_RSLOT,

        // Transaction must abort, has a child, or is invalid
        c.MDB_BAD_TXN => MdbError.MDB_BAD_TXN,

        // Unsupported size of key/DB name/data, or wrong DUPFIXED size
        c.MDB_BAD_VALSIZE => MdbError.MDB_BAD_VALSIZE,

        // The specified DBI handle was closed/changed unexpectedly
        c.MDB_BAD_DBI => MdbError.MDB_BAD_DBI,

        @intFromEnum(std.posix.E.INVAL) => MdbError.INVAL,
        @intFromEnum(std.posix.E.ACCES) => MdbError.ACCES,
        @intFromEnum(std.posix.E.NOMEM) => MdbError.NOMEM,
        @intFromEnum(std.posix.E.NOENT) => MdbError.NOENT,
        @intFromEnum(std.posix.E.AGAIN) => MdbError.AGAIN,
        @intFromEnum(std.posix.E.NOSPC) => MdbError.NOSPC,
        @intFromEnum(std.posix.E.BUSY) => MdbError.BUSY,
        @intFromEnum(std.posix.E.INTR) => MdbError.INTR,
        @intFromEnum(std.posix.E.PIPE) => MdbError.PIPE,
        @intFromEnum(std.posix.E.IO) => MdbError.IO,

        else => MdbError.UNKNOWN_ERROR,
    };
}
