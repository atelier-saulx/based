const deflate = @import("../../../deflate.zig");
const Thread = @import("../../../thread/thread.zig");
const std = @import("std");

fn Ctx(dataType: type) type {
    return struct {
        query: []const u8,
        notFirstBlock: bool,
        data: dataType,
    };
}

fn Compare(comptime DataType: type) type {
    if (DataType == void) {
        return (fn (
            query: []const u8,
            value: []u8,
        ) bool);
    } else {
        return (fn (query: []u8, value: []u8, data: DataType) bool);
    }
}

fn comptimeCb(
    comptime DataType: type,
    comptime compare: Compare(DataType),
) type {
    return struct {
        pub fn func(
            ctxC: ?*anyopaque,
            b: [*c]const u8,
            dictSize: usize,
            dataSize: usize,
        ) callconv(.c) c_int {
            const buf: [*c]u8 = @constCast(b);
            const ctx: *Ctx(DataType) = @ptrCast(@alignCast(ctxC.?));
            var value: []u8 = undefined;
            if (ctx.notFirstBlock) {
                value = buf[dictSize - ctx.query.len .. dictSize + dataSize];
            } else {
                value = buf[dictSize .. dictSize + dataSize];
            }

            var found: bool = undefined;
            if (DataType == void) {
                found = compare(
                    ctx.query,
                    value,
                );
            } else {
                found = compare(
                    ctx.query,
                    value,
                    ctx.data,
                );
            }
            if (found) {
                return 1;
            }
            ctx.notFirstBlock = true;
            return 0;
        }
    };
}

fn createCtx(comptime DataType: type, query: []const u8, data: DataType) Ctx(DataType) {
    if (DataType == void) {
        return .{
            .query = query,
            .notFirstBlock = false,
            .data = undefined,
        };
    } else {
        return .{
            .query = query,
            .notFirstBlock = false,
            .data = data,
        };
    }
}

pub fn decompress(
    thread: *Thread.Thread,
    comptime DataType: type,
    comptime compare: Compare(DataType),
    query: []const u8,
    value: []const u8,
    data: DataType,
) bool {
    var ctx: Ctx(DataType) = createCtx(DataType, query, data);
    var loop: bool = true;
    var hasMatch: c_int = 0;
    while (loop) {
        const result = deflate.decompressStream(
            thread.decompressor,
            &thread.libdeflateBlockState,
            value[6 .. value.len - 4],
            comptimeCb(DataType, compare).func,
            @ptrCast(&ctx),
            &hasMatch,
        );
        loop = result == .insufficientSpace and
            deflate.blockStateGrowbuf(&thread.libdeflateBlockState);
    }
    return hasMatch == 1;
}
