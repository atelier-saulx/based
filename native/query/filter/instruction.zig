const std = @import("std");
const t = @import("../../types.zig");
const Compare = @import("compare.zig");

pub const OpMeta = struct { invert: bool = false, func: Compare.Function };

fn getFunc(comptime tag: t.FilterOpCompare) Compare.Function {
    return switch (tag) {
        .range, .nrange => Compare.Function.range,
        .eqBatch,
        .neqBatch,
        => Compare.Function.eqBatch,
        .eqBatchSmall,
        .neqBatchSmall,
        => Compare.Function.eqBatchSmall,
        .eq, .neq => Compare.Function.eq,
        .le => Compare.Function.le,
        .lt => Compare.Function.le,
        .ge => Compare.Function.ge,
        .gt => Compare.Function.gt,
        .inc, .ninc => Compare.Function.inc,
        else => Compare.Function.eq,
    };
}

pub fn parseOp(comptime op: t.FilterOpCompare) OpMeta {
    return .{
        .func = getFunc(op),
        .invert = switch (op) {
            .neq, .neqBatch, .neqBatchSmall, .nrange => true,
            else => false,
        },
    };
}
