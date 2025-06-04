const selva = @import("../selva.zig");
const std = @import("std");
const db = @import("./db.zig");

const CtxC = struct { result: []u8 };

pub fn cb(
    ctxC: ?*anyopaque,
    b: [*c]const u8,
    dictSize: usize,
    dataSize: usize,
) callconv(.C) c_int {
    const buf: [*c]u8 = @constCast(b);
    const ctx: *CtxC = @ptrCast(@alignCast(ctxC.?));
    var value: []u8 = undefined;
    value = buf[dictSize .. dictSize + dataSize];
    ctx.result = value;
    return 1;
}

pub inline fn decompressFirstBytes(
    value: []u8,
) []u8 {
    var ctx: CtxC = .{ .result = &.{} };
    var r: c_int = 0;
    // TODO: make a specific fn for this (with max len)
    _ = selva.worker_ctx_libdeflate_decompress_stream(
        value[6..value.len].ptr,
        value.len - 10,
        cb,
        @ptrCast(&ctx),
        &r,
    );
    return ctx.result;
}
