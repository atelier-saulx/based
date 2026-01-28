const std = @import("std");
const t = @import("../../types.zig");
const Compare = @import("compare.zig");

pub const OpMeta = struct {
    invert: bool = false,
    cmp: Compare.Op = .eq,
    func: Compare.Function = .Single,
};

fn getCmp(comptime tag: t.FilterOpCompare) Compare.Op {
    return switch (tag) {
        .lt, .ltBatch, .ltBatchSmall => .lt,
        .le, .leBatch, .leBatchSmall => .le,
        .gt, .gtBatch, .gtBatchSmall => .gt,
        .ge, .geBatch, .geBatchSmall => .ge,
        else => .eq,
    };
}

fn getFunc(comptime tag: t.FilterOpCompare) Compare.Function {
    return switch (tag) {
        .range, .nrange => .Range,
        .eqBatch, .neqBatch, .ltBatch, .leBatch, .gtBatch, .geBatch => .Batch,
        .eqBatchSmall, .neqBatchSmall, .ltBatchSmall, .leBatchSmall, .gtBatchSmall, .geBatchSmall => .BatchSmall,
        else => .Single,
    };
}

pub fn parseOp(comptime op: t.FilterOpCompare) OpMeta {
    return .{
        .cmp = getCmp(op),
        .func = getFunc(op),
        .invert = switch (op) {
            .neq, .neqBatch, .neqBatchSmall, .nrange => true,
            else => false,
        },
    };
}
