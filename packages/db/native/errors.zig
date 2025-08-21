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
    CannotGetInt,
    CannotGetType,
    CannotGetBool,
    CannotGetExternal,
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
    SELVA_NO_EDGE_FIELDSCHEMA,
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


pub const DeflateError = error{
    BAD_DATA,
    SHORT_OUTPUT,
    INSUFFICIENT_SPACE,
};

pub fn deflate(rc: selvaLib.libdeflate_result) DeflateError!void {
    try switch (rc) {
        selvaLib.LIBDEFLATE_SUCCESS => {},
        selvaLib.LIBDEFLATE_BAD_DATA => DeflateError.BAD_DATA,
        selvaLib.LIBDEFLATE_SHORT_OUTPUT => DeflateError.SHORT_OUTPUT,
        selvaLib.LIBDEFLATE_INSUFFICIENT_SPACE => DeflateError.INSUFFICIENT_SPACE,
        selvaLib.LIBDEFLATE_MORE => {},
        else => {},
    };
}

pub const DbError = error{
    SHARD_NOT_CREATED,
    WRONG_SORTFIELD_TYPE,
    INCORRECT_QUERY_TYPE,
};
