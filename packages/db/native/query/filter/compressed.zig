const selva = @import("../../selva.zig");
const std = @import("std");
const db = @import("../../db/db.zig");

fn Ctx(dataType: type) type {
    return struct {
        query: []u8,
        notFirstBlock: bool,
        data: dataType,
    };
}

pub fn Compare(comptime DataType: type) type {
    if (DataType == void) {
        return (fn (value: []u8, query: []u8) bool);
    } else {
        return (fn (value: []u8, query: []u8, data: DataType) bool);
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
        ) callconv(.C) c_int {
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
                    value,
                    ctx.query,
                );
            } else {
                found = compare(
                    value,
                    ctx.query,
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

fn createCtx(comptime DataType: type, query: []u8, data: DataType) Ctx(DataType) {
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

pub inline fn decompress(
    comptime DataType: type,
    comptime compare: Compare(DataType),
    query: []u8,
    value: []u8,
    dbCtx: *db.DbCtx,
    data: DataType,
) bool {
    var ctx: Ctx(DataType) = createCtx(DataType, query, data);
    var loop: bool = true;
    var hasMatch: c_int = 0;
    while (loop) {
        const result = selva.libdeflate_decompress_stream(
            dbCtx.decompressor, // gimme from selva
            &dbCtx.libdeflate_block_state,
            value[6..value.len].ptr,
            value.len - 10,
            comptimeCb(DataType, compare).func,
            @ptrCast(&ctx),
            &hasMatch,
        );
        loop = result == selva.LIBDEFLATE_INSUFFICIENT_SPACE and selva.libdeflate_block_state_growbuf(
            &dbCtx.libdeflate_block_state,
        );
    }
    return hasMatch == 1;
}
