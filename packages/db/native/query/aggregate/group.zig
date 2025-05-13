const selva = @import("../../selva.zig");
const std = @import("std");
const utils = @import("../../utils.zig");
const copy = utils.copy;
const writeInt = utils.writeIntExact;
const types = @import("../../types.zig");
const SimpleHashMap = @import("./types.zig").GroupByHashMap;
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
};

pub inline fn setGroupResults(
    data: []u8,
    ctx: *GroupCtx,
) !void {
    var it = ctx.hashMap.iterator();
    var i: usize = 0;
    while (it.next()) |entry| {
        const key = entry.key_ptr.*;
        const keyLen: u16 = @intCast(key.len);
        writeInt(u16, data, i, keyLen);
        i += 2;
        const keyOffset = if (keyLen == 0) 4 else keyLen;
        if (keyLen > 0) {
            copy(data[i .. i + keyOffset], key);
            i += keyOffset;
        }
        copy(data[i .. i + ctx.resultsSize], entry.value_ptr.*);
        i += ctx.resultsSize;
    }
}

pub fn createGroupCtx(aggInput: []u8, typeEntry: db.Type, ctx: *QueryCtx) !*GroupCtx {
    const field = aggInput[0];
    const propType: types.Prop = if (field == types.MAIN_PROP) types.Prop.MICRO_BUFFER else @enumFromInt(aggInput[1]);
    const start = read(u16, aggInput, 2);
    const len = read(u16, aggInput, 4);
    const fieldSchema = try db.getFieldSchema(field, typeEntry);
    const resultsSize = read(u16, aggInput, 6);

    const groupCtx: *GroupCtx = try ctx.allocator.create(GroupCtx);
    groupCtx.* = .{
        .field = field,
        .propType = propType,
        .start = start,
        .len = len,
        .fieldSchema = fieldSchema,
        .hashMap = SimpleHashMap.init(ctx.allocator),
        .resultsSize = resultsSize,
    };

    return groupCtx;
}
