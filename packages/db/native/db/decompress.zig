const dbCtx = @import("../db/ctx.zig");
const selva = @import("../selva.zig").c;
const std = @import("std");
const db = @import("./db.zig");
const deflateErrors = @import("../errors.zig").deflate;

pub const LibdeflateDecompressor = selva.libdeflate_decompressor;
pub const LibdeflateBlockState = selva.libdeflate_block_state;

const CtxC = struct { result: []u8 };

pub fn cb(
    ctxC: ?*anyopaque,
    b: [*c]const u8,
    dictSize: usize,
    dataSize: usize,
) callconv(.c) c_int {
    const buf: [*c]u8 = @constCast(b);
    const ctx: *CtxC = @ptrCast(@alignCast(ctxC.?));
    var value: []u8 = undefined;
    value = buf[dictSize .. dictSize + dataSize];
    ctx.result = value;
    return 1;
}

// Decompress as many bytes as will fit to output or available in the compressed buffer
pub inline fn decompressFirstBytes(decompressor: *LibdeflateDecompressor, input: []u8, output: []u8) ![]u8 {
    var nbytes: usize = 0;
    try deflateErrors(selva.libdeflate_decompress_short(decompressor, input[6..input.len].ptr, input.len - 10, output.ptr, output.len, &nbytes));
    return output[0..nbytes];
}
