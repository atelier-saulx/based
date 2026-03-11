const std = @import("std");
const t = @import("../../types.zig");

const VarFunction = enum(u8) {
    inc,
    incLcase,
    incLcaseFast,
    incBatch,
    incBatchLcase,
    incBatchLcaseFast,
    eqVar,
    eqVarBatch,
    eqCrc32,
    eqCrc32Batch,
    like,
    likeBatch,
};

const FixedFunction = enum(u8) {
    eq,
    eqBatch,
    eqBatchSmall,
    lt,
    gt,
    le,
    ge,
    range,
};

pub fn OpMeta(comptime isVar: bool) type {
    return struct {
        invert: bool,
        func: if (isVar) VarFunction else FixedFunction,
    };
}

fn getFunc(
    comptime isVar: bool,
    comptime tag: t.FilterOpCompare,
) if (isVar) VarFunction else FixedFunction {
    if (isVar) {
        return switch (tag) {
            .inc, .ninc => VarFunction.inc,
            .incLcase, .nincLcase => VarFunction.incLcase,
            .incLcaseFast, .nincLcaseFast => VarFunction.incLcaseFast,
            .incBatch, .nincBatch => VarFunction.incBatch,
            .incBatchLcase, .nincBatchLcase => VarFunction.incBatchLcase,
            .incBatchLcaseFast, .nincBatchLcaseFast => VarFunction.incBatchLcaseFast,
            // -------------------
            .eqVarBatch, .neqVarBatch => VarFunction.eqVarBatch,
            // -------------------
            .eqCrc32, .neqCrc32 => VarFunction.eqCrc32,
            .eqCrc32Batch, .neqCrc32Batch => VarFunction.eqCrc32Batch,
            // -------------------
            .like, .nlike => VarFunction.like,
            .likeBatch, .nlikeBatch => VarFunction.likeBatch,
            // -------------------
            // .eqVar, .neqVar => VarFunction.eqVar,
            else => VarFunction.eqVar,
        };
    } else {
        return switch (tag) {
            // -------------------
            else => FixedFunction.eq,
            // .eq, .neq => FixedFunction.eq,
            .eqBatch, .neqBatch => FixedFunction.eqBatch,
            .eqBatchSmall, .neqBatchSmall => FixedFunction.eqBatchSmall,
            // -------------------
            .range, .nrange => FixedFunction.range,
            .le => FixedFunction.le,
            .lt => FixedFunction.le,
            .ge => FixedFunction.ge,
            .gt => FixedFunction.gt,
            // -------------------
        };
    }
}

pub fn parseOp(comptime op: t.FilterOpCompare, comptime isVar: bool) OpMeta(isVar) {
    @setEvalBranchQuota(10000);
    // const isVar = isVarOp(op);
    return .{
        .func = getFunc(isVar, op),
        .invert = switch (op) {
            .neq,
            .neqBatch,
            .neqBatchSmall,
            .nrange,
            .ninc,
            .nincLcase,
            .nincLcaseFast,
            .nincBatch,
            .nincBatchLcase,
            .nincBatchLcaseFast,
            .neqVar,
            .neqCrc32,
            .neqCrc32Batch,
            .neqVarBatch,
            .nlike,
            .nlikeBatch,
            => true,
            else => false,
        },
    };
}
