const std = @import("std");
const t = @import("../../types.zig");
const Compare = @import("compare.zig");

fn createEnumField(propType: t.PropType, cmp: t.FilterOpCompare) std.builtin.Type.EnumField {
    const val: u16 = (@as(u16, cmp.value) << 8) | propType.value;
    return .{
        .name = propType.name ++ cmp.name,
        .value = val,
    };
}

fn createInstructionEnum() type {
    const propTypeInfo = @typeInfo(t.PropType).@"enum";
    const compareInfo = @typeInfo(t.FilterOpCompare).@"enum";

    var total = 0;

    for (propTypeInfo.fields) |propType| {
        const p: t.PropType = @enumFromInt(propType.value);
        switch (p) {
            .boolean, .@"enum" => {
                total += 2; // neq, eq
            },
            else => {
                if (p.isFixed()) {
                    for (compareInfo.fields) |_| {
                        total += 1;
                    }
                } else {
                    // bla
                }
            },
        }
    }

    // @setEvalBranchQuota(total);

    var new_fields: [total]std.builtin.Type.EnumField = undefined;

    var i: usize = 0;
    for (propTypeInfo.fields) |propType| {
        const p: t.PropType = @enumFromInt(propType.value);
        if (p.isFixed()) {
            const fields = switch (p) {
                .boolean, .@"enum" => [_]std.builtin.Type.EnumField{
                    .{ .name = "eq", .value = @intFromEnum(t.FilterOpCompare.eq) },
                    .{ .name = "neq", .value = @intFromEnum(t.FilterOpCompare.neq) },
                },
                else => if (p.isFixed()) compareInfo.fields else [_]std.builtin.Type.EnumField{},
            };
            for (fields) |compare| {
                const val: u16 = (@as(u16, compare.value) << 8) | propType.value;
                new_fields[i] = .{
                    .name = propType.name ++ compare.name,
                    .value = val,
                };
                i += 1;
            }
        }
    }

    return @Type(.{
        .@"enum" = .{
            .tag_type = u16,
            .fields = &new_fields,
            .decls = &.{},
            .is_exhaustive = true,
        },
    });
}

// This is a hack to use a single switch statement...
pub const CombinedOp = createInstructionEnum();

pub const OpMeta = struct {
    invert: bool = false,
    // this is just OP
    cmp: Compare.Op = .eq,
    func: Compare.Function = .Single,
    T: type,
};

pub fn parseOp(comptime tag: CombinedOp) OpMeta {
    const val = @intFromEnum(tag);

    const op: t.FilterOpCompare = @enumFromInt(@as(u8, @truncate(val >> 8)));
    const propType: t.PropType = @enumFromInt(@as(u8, @truncate(val)));

    return .{
        .T = propTypeToPrimitive(propType),
        .cmp = getCmp(op),
        .func = getFunc(op),
        .invert = switch (op) {
            .neq, .neqBatch, .neqBatchSmall, .nrange => true,
            else => false,
        },
    };
}

fn getCmp(comptime tag: t.FilterOpCompare) Compare.Op {
    return switch (tag) {
        .lt, .ltBatch, .ltBatchSmall => .lt,
        .le, .leBatch, .leBatchSmall => .le,
        .gt, .gtBatch, .gtBatchSmall => .gt,
        .ge, .geBatch, .geBatchSmall => .ge,
        // Add now CMP
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

fn propTypeToPrimitive(comptime propType: t.PropType) type {
    return switch (propType) {
        .uint32, .id => u32,
        .int32 => i32,
        .uint16 => u16,
        .int16 => i16,
        .uint8 => u8,
        .int8 => i8,
        .timestamp => i64,
        .number => f64,

        // .boolean, .enum => u8,

        else => u8,
    };
}
