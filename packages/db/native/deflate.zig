pub const c = @cImport({
    @cDefine("__zig", "1");

    @cDefine("true", "(_Bool)1");
    @cDefine("false", "(_Bool)0");
    @cInclude("stdbool.h");
    @cUndef("true");
    @cUndef("false");
    @cDefine("true", "(_Bool)1");
    @cDefine("false", "(_Bool)0");

    @cInclude("cdefs.h");

    @cInclude("libdeflate.h");
});
const dbCtx = @import("./db/ctx.zig");
const std = @import("std");
const db = @import("./db/db.zig");

pub const Compressor = c.libdeflate_compressor;
pub const Decompressor = c.libdeflate_decompressor;
pub const BlockState = c.libdeflate_block_state;

pub const Result = enum(c_uint) {
    success = c.LIBDEFLATE_SUCCESS,
    badData = c.LIBDEFLATE_BAD_DATA,
    shortOutput = c.LIBDEFLATE_SHORT_OUTPUT,
    insufficientSpace = c.LIBDEFLATE_INSUFFICIENT_SPACE,
    more = c.LIBDEFLATE_MORE,
};

pub const DeflateError = error{
    INVALID_ARGUMENT,
    BAD_DATA,
    SHORT_OUTPUT,
    INSUFFICIENT_SPACE,
};

fn deflateErrors(rc: c.libdeflate_result) DeflateError!void {
    try switch (rc) {
        c.LIBDEFLATE_SUCCESS => {},
        c.LIBDEFLATE_BAD_DATA => DeflateError.BAD_DATA,
        c.LIBDEFLATE_SHORT_OUTPUT => DeflateError.SHORT_OUTPUT,
        c.LIBDEFLATE_INSUFFICIENT_SPACE => DeflateError.INSUFFICIENT_SPACE,
        c.LIBDEFLATE_MORE => {},
        else => {},
    };
}

pub fn createCompressor(compressionLevel: c_int) !*Compressor {
    if (c.libdeflate_alloc_compressor(compressionLevel)) |compressor| {
        return compressor;
    } else {
        return DeflateError.INVALID_ARGUMENT;
    }
}

pub fn destroyCompressor(compressor: *Compressor) void {
    c.libdeflate_free_compressor(@ptrCast(compressor));
}

pub fn compress(compressor: *Compressor, in: []u8, out: []u8) usize {
  return c.libdeflate_compress(compressor, in.ptr, in.len, out.ptr, out.len);
}

pub fn createDecompressor() *Decompressor {
    return c.libdeflate_alloc_decompressor().?; // never fails
}

pub fn destroyDecompressor(decompressor: *Decompressor) void {
    c.libdeflate_free_decompressor(decompressor);
}

pub fn initBlockState(maxBlockSize: usize) BlockState {
    return c.libdeflate_block_state_init(maxBlockSize);
}

pub fn deinitBlockState(bs: *BlockState) void {
    c.libdeflate_block_state_deinit(bs);
}

pub fn decompress(decompressor: *Decompressor, in: []u8, out: []u8) !void {
    return deflateErrors(c.libdeflate_decompress(decompressor, in.ptr, in.len, out.ptr, out.len, null));
}

// Decompress as many bytes as will fit to output or available in the compressed buffer
pub inline fn decompressFirstBytes(decompressor: *Decompressor, input: []u8, output: []u8) ![]u8 {
    // TODO Move to higher up in the call chain
    var nbytes: usize = 0;

    try deflateErrors(c.libdeflate_decompress_short(decompressor, input[6..input.len].ptr, input.len - 10, output.ptr, output.len, &nbytes));
    return output[0..nbytes];
}

const CtxC = struct { result: []u8 };

pub fn stream_cb(
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

pub fn decompressStream(
    d: *Decompressor,
    state: *BlockState,
    in: []u8,
    cb: c.libdeflate_decompress_stream_cb_t,
    ctx: ?*anyopaque,
    result: *c_int) Result {
    return @enumFromInt(c.libdeflate_decompress_stream(d, state, in.ptr, in.len, cb, ctx, result));
}

pub fn blockStateGrowbuf(bs: *BlockState) bool {
    return c.libdeflate_block_state_growbuf(bs);
}
