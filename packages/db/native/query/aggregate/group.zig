const selva = @import("../../selva.zig");
const std = @import("std");
const utils = @import("../../utils.zig");
const copy = utils.copy;
const writeInt = utils.writeIntExact;
const types = @import("../../types.zig");
const SimpleHashMap = std.AutoHashMap([2]u8, []u8);
const read = utils.read;
const db = @import("../../db/db.zig");
const QueryCtx = @import("../types.zig").QueryCtx;

pub const ProtocolLen = 8;

// add COMPTIME thing for different types
pub const GroupCtx = struct {
    hashMap: SimpleHashMap,
    resultsSize: u16,
    fieldSchema: db.FieldSchema,
    start: u16,
    field: u8,
    len: u16,
    propType: types.Prop,
    empty: [2]u8,
};

pub inline fn setGroupResults(
    data: []u8,
    ctx: *GroupCtx,
) !void {
    var it = ctx.hashMap.iterator();
    var i: usize = 0;
    while (it.next()) |entry| {
        copy(data[i .. i + 2], entry.key_ptr);
        i += 2;
        copy(data[i .. i + ctx.resultsSize], entry.value_ptr.*);
        i += ctx.resultsSize;
    }
    writeInt(u32, data, data.len - 4, selva.crc32c(4, data.ptr, data.len - 4));
}

pub fn createGroupCtx(aggInput: []u8, typeEntry: db.Type, ctx: *QueryCtx) !*GroupCtx {
    const field = aggInput[0];
    const propType: types.Prop = if (field == types.MAIN_PROP) types.Prop.MICRO_BUFFER else @enumFromInt(aggInput[1]);
    const start = read(u16, aggInput, 2);
    const len = read(u16, aggInput, 4);
    const fieldSchema = try db.getFieldSchema(field, typeEntry);
    const resultsSize = read(u16, aggInput, 6);
    const emptyKey = [_]u8{0} ** 2;

    const groupCtx: *GroupCtx = try ctx.allocator.create(GroupCtx);
    groupCtx.* = .{
        .field = field,
        .propType = propType,
        .start = start,
        .len = len,
        .fieldSchema = fieldSchema,
        .hashMap = SimpleHashMap.init(ctx.allocator),
        .empty = emptyKey,
        .resultsSize = resultsSize,
    };

    return groupCtx;
}
