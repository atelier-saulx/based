const c = @import("../../c.zig");
const errors = @import("../../errors.zig");
const napi = @import("../../napi.zig");
const std = @import("std");
const runCondition = @import("./conditions.zig").runConditions;
const QueryCtx = @import("../ctx.zig").QueryCtx;
const db = @import("../../db/db.zig");

pub fn filter(
    queryId: u32,
    id: u32,
    typePrefix: [2]u8,
    conditions: []u8,
    currentShard: u16,
) bool {
    var fieldIndex: usize = 0;
    var main: ?[]u8 = undefined;
    while (fieldIndex < conditions.len) {
        const querySize: u16 = std.mem.readInt(
            u16,
            conditions[fieldIndex + 1 ..][0..2],
            .little,
        );
        const field = conditions[fieldIndex];
        const operation = conditions[fieldIndex + 1 ..];

        if (field == 254) {
            const refTypePrefix: [2]u8 = .{ operation[4], operation[5] };
            if (main == null) {
                main = db.getField(id, 0, typePrefix, currentShard, queryId);
                if (main.?.len == 0) {
                    return false;
                }
            }
            const refStart: u16 = std.mem.readInt(u16, operation[2..4], .little);
            const refId = std.mem.readInt(u32, main.?[refStart..][0..4], .little);
            if (refId > 0) {
                const refConditions: []u8 = operation[6 .. 2 + querySize];
                if (!filter(queryId, refId, refTypePrefix, refConditions, db.idToShard(refId))) {
                    return false;
                }
            } else {
                return false;
            }
        } else {
            const query = operation[2 .. 2 + querySize];
            if (field == 0) {
                if (main == null) {
                    main = db.getField(id, field, typePrefix, currentShard, queryId);
                    if (main.?.len == 0) {
                        return false;
                    }
                }
                if (!runCondition(main.?, query)) {
                    return false;
                }
            } else {
                const value = db.getField(id, field, typePrefix, currentShard, queryId);
                if (value.len == 0) {
                    return false;
                }
                if (!runCondition(value, query)) {
                    return false;
                }
            }
        }
        fieldIndex += querySize + 3;
    }
    return true;
}
