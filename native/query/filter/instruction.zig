const std = @import("std");
const t = @import("../../types.zig");
const Fixed = @import("fixed.zig");

fn createInstructionEnum() type {
    // can be a bit less

    // Add or jump
    // add REFERENCE
    // use proptype
    // make an enum function to find filterfixedpropType

    const propTypeInfo = @typeInfo(t.PropType).@"enum";
    const compareInfo = @typeInfo(t.FilterOpCompare).@"enum";

    var total = 0;
    for (propTypeInfo.fields) |propType| {
        const p: t.PropType = @enumFromInt(propType.value);
        if (p.isFixed()) {
            for (compareInfo.fields) |_| {
                total += 1;
            }
        } else {
            // derp?
        }
    }

    @setEvalBranchQuota(total);

    var new_fields: [total]std.builtin.Type.EnumField = undefined;

    // add OR INDEX
    // select refs

    var i: usize = 0;
    for (propTypeInfo.fields) |propType| {
        const p: t.PropType = @enumFromInt(propType.value);
        if (p.isFixed()) {
            for (compareInfo.fields) |compare| {
                // @compileLog(compare.name, compare.value, propType.name, propType.value);

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
    cmp: Fixed.Op = .eq,
    func: Fixed.Function = .Single,
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

fn getCmp(comptime tag: t.FilterOpCompare) Fixed.Op {
    return switch (tag) {
        // Less Than
        .lt, .ltBatch, .ltBatchSmall => .lt,
        // Less Equal
        .le, .leBatch, .leBatchSmall => .le,
        // Greater Than
        .gt, .gtBatch, .gtBatchSmall => .gt,
        // Greater Equal
        .ge, .geBatch, .geBatchSmall => .ge,

        // Everything else (Eq, Neq, Range) defaults to Equality logic
        else => .eq,
    };
}

fn getFunc(comptime tag: t.FilterOpCompare) Fixed.Function {
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

        // .id => u32,
        // .int32 => i32,
        // .number => f64,

        // // Small Ints
        // .uint16 => u16,
        // .int16 => i16,
        // .uint8 => u8,
        // .int8 => i8,

        // // Special
        // .timestamp => u64,

        // Unsupported for Math (Strings, Objects, etc.)
        // We return 'void' so the generator loop skips these cases automatically.
        else => u8,
    };
}
