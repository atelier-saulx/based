const std = @import("std");
const t = @import("../../types.zig");
const Fixed = @import("fixed.zig");

fn createInstructionEnum() type {
    // can be a bit less

    const propTypeInfo = @typeInfo(t.FilterFixedPropType).@"enum";
    const compareInfo = @typeInfo(t.FilterOpCompare).@"enum";

    const total = propTypeInfo.fields.len * compareInfo.fields.len;

    @setEvalBranchQuota(total);

    var new_fields: [total]std.builtin.Type.EnumField = undefined;

    // add OR INDEX
    // select refs

    var i: usize = 0;
    for (propTypeInfo.fields) |propType| {
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
};

pub fn parseOp(comptime tag: t.FilterOpCompare) OpMeta {
    var m = OpMeta{};

    switch (tag) {
        // eq
        .eq => {
            m.cmp = .eq;
        },
        .neq => {
            m.cmp = .eq;
            m.invert = true;
        },
        .eqBatch => {
            m.cmp = .eq;
            m.func = .Batch;
        },
        .neqBatch => {
            m.cmp = .eq;
            m.func = .Batch;
            m.invert = true;
        },
        .eqBatchSmall => {
            m.cmp = .eq;
            m.func = .BatchSmall;
        },
        .neqBatchSmall => {
            m.cmp = .eq;
            m.func = .BatchSmall;
            m.invert = true;
        },
        // range
        .range => {
            m.func = .Range;
        },
        .nrange => {
            m.func = .Range;
            m.invert = true;
        },
        // lt
        .lt => {
            m.cmp = .lt;
        },
        .ltBatch => {
            m.cmp = .lt;
            m.func = .Batch;
        },
        .ltBatchSmall => {
            m.cmp = .lt;
            m.func = .BatchSmall;
        },
        // le
        .le => {
            m.cmp = .le;
        },
        .leBatch => {
            m.cmp = .le;
            m.func = .Batch;
        },
        .leBatchSmall => {
            m.cmp = .le;
            m.func = .BatchSmall;
        },
        // gt
        .gt => {
            m.cmp = .gt;
        },
        .gtBatch => {
            m.cmp = .gt;
            m.func = .Batch;
        },
        .gtBatchSmall => {
            m.cmp = .gt;
            m.func = .BatchSmall;
        },
        // ge
        .ge => {
            m.cmp = .ge;
        },
        .geBatch => {
            m.cmp = .ge;
            m.func = .Batch;
        },
        .geBatchSmall => {
            m.cmp = .ge;
            m.func = .BatchSmall;
        },
    }

    return m;
}

pub fn propTypeToPrimitive(comptime propType: t.FilterFixedPropType) type {
    return switch (propType) {
        // Standard Math
        .uint32 => u32,
        .uint16 => u16,

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
        // else => void,
    };
}
