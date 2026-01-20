const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const t = @import("../../types.zig");
const Fixed = @import("./fixed.zig");
const Select = @import("./select.zig");

fn alignSingle(T: type, q: []u8, i: *usize) void {
    const size = utils.sizeOf(T) + @alignOf(T);
    const condition = utils.readNext(t.FilterCondition, q, i);
    if (condition.alignOffset == 255) {
        q[i.* - 3] = utils.alignLeft(T, q[i.* .. i.* + size]);
    }
    i.* += size;
}

fn alignBatch(T: type, q: []u8, i: *usize) void {
    const condition = utils.readNext(t.FilterCondition, q, i);
    // make this u32
    const len = utils.readNext(u32, q, i);
    if (condition.alignOffset == 255) {
        q[i.* - 7] = utils.alignLeft(T, q[i.* .. i.* + len * utils.sizeOf(T) + @alignOf(T) + 16]);
    }
    // Always 16 bytes padding (can become slightly more efficient)
    i.* += len * utils.sizeOf(T) + @alignOf(T) + 16;
}

fn alignSmallBatch(T: type, q: []u8, i: *usize) void {
    const condition = utils.readNext(t.FilterCondition, q, i);
    if (condition.alignOffset == 255) {
        q[i.* - 3] = utils.alignLeft(T, q[i.* .. i.* + @alignOf(T) + 16]);
    }
    // Always 16 bytes padding (can become slightly more efficient)
    i.* += @alignOf(T) + 16;
}

// prepare will return the next NOW
// it will also just fill in the current now
pub fn prepare(
    q: []u8,
) void {
    var i: usize = 0;
    while (i < q.len) {
        const op: t.FilterOp = @enumFromInt(q[i]);
        switch (op) {
            .nextOrIndex => alignSingle(usize, q, &i),
            .selectLargeRef, .selectSmallRef => {
                i += utils.sizeOf(t.FilterCondition);
                const selectReference = utils.readNext(t.FilterSelect, q, &i);
                prepare(q[i .. i + selectReference.size]);
                i += selectReference.size;
            },
            .eqU32, .neqU32 => alignSingle(u32, q, &i),
            .eqU32Batch, .neqU32Batch => alignBatch(u32, q, &i),
            .eqU32BatchSmall, .neqU32BatchSmall => alignSmallBatch(u32, q, &i),
            .eqI32, .neqI32 => alignSingle(i32, q, &i),
            .eqI32Batch, .neqI32Batch => alignBatch(i32, q, &i),
            .eqI32BatchSmall, .neqI32BatchSmall => alignSmallBatch(i32, q, &i),

            .eqU16, .neqU16 => alignSingle(u16, q, &i),
            .eqU16Batch, .neqU16Batch => alignBatch(u16, q, &i),
            .eqU16BatchSmall, .neqU16BatchSmall => alignSmallBatch(u16, q, &i),

            .eqI16, .neqI16 => alignSingle(i16, q, &i),
            .eqI16Batch, .neqI16Batch => alignBatch(i16, q, &i),
            .eqI16BatchSmall, .neqI16BatchSmall => alignSmallBatch(i16, q, &i),

            .eqU8, .neqU8 => alignSingle(u8, q, &i),
            .eqU8Batch, .neqU8Batch => alignBatch(u8, q, &i),
            .eqU8BatchSmall, .neqU8BatchSmall => alignSmallBatch(u8, q, &i),

            .eqI8, .neqI8 => alignSingle(i8, q, &i),
            .eqI8Batch, .neqI8Batch => alignBatch(i8, q, &i),
            .eqI8BatchSmall, .neqI8BatchSmall => alignSmallBatch(i8, q, &i),

            .eqF64, .neqF64 => alignSingle(f64, q, &i),
            .eqF64Batch, .neqF64Batch => alignBatch(f64, q, &i),
            .eqF64BatchSmall, .neqF64BatchSmall => alignSmallBatch(f64, q, &i),

            .eqI64, .neqI64 => alignSingle(i64, q, &i),
            .eqI64Batch, .neqI64Batch => alignBatch(i64, q, &i),
            .eqI64BatchSmall, .neqI64BatchSmall => alignSmallBatch(i64, q, &i),
            else => {},
        }
    }
}

pub fn recursionErrorBoundary(
    cb: anytype,
    ctx: *Query.QueryCtx,
    q: []u8,
    value: []u8,
    i: *usize,
) bool {
    return cb(ctx, q, value, i) catch |err| {
        std.debug.print("Filter: recursionErrorBoundary: Error {any} \n", .{err});
        return false;
    };
}

pub inline fn filter(
    node: Node.Node,
    ctx: *Query.QueryCtx,
    q: []u8,
    typeEntry: Node.Type,
) !bool {
    var i: usize = 0;
    var pass: bool = true;
    var v: []u8 = undefined;
    var prop: u8 = 255;
    var nextOrIndex: usize = q.len;
    while (i < nextOrIndex) {
        const op: t.FilterOp = @enumFromInt(q[i]);

        const condition = utils.readNext(t.FilterCondition, q, &i);
        if (prop != condition.prop) {
            prop = condition.prop;
            v = Fields.get(
                typeEntry,
                node,
                try Schema.getFieldSchema(typeEntry, condition.prop),
                .null,
            );
        }

        pass = switch (op) {
            .nextOrIndex => blk: {
                nextOrIndex = utils.readNextAligned(usize, q, &i, condition.alignOffset);
                break :blk true;
            },
            .selectLargeRef => recursionErrorBoundary(Select.largeRef, ctx, q, v, &i),

            .eqU32 => try Fixed.eq(u32, q, &i, &condition, v),
            .neqU32 => !try Fixed.eq(u32, q, &i, &condition, v),
            .eqU32Batch => try Fixed.eqBatch(u32, q, &i, &condition, v),
            .neqU32Batch => !try Fixed.eqBatch(u32, q, &i, &condition, v),
            .eqU32BatchSmall => try Fixed.eqBatchSmall(u32, q, &i, &condition, v),
            .neqU32BatchSmall => !try Fixed.eqBatchSmall(u32, q, &i, &condition, v),

            .eqI32 => try Fixed.eq(i32, q, &i, &condition, v),
            .neqI32 => !try Fixed.eq(i32, q, &i, &condition, v),
            .eqI32Batch => try Fixed.eqBatch(i32, q, &i, &condition, v),
            .neqI32Batch => !try Fixed.eqBatch(i32, q, &i, &condition, v),
            .eqI32BatchSmall => try Fixed.eqBatchSmall(i32, q, &i, &condition, v),
            .neqI32BatchSmall => !try Fixed.eqBatchSmall(i32, q, &i, &condition, v),

            .eqU16 => try Fixed.eq(u16, q, &i, &condition, v),
            .neqU16 => !try Fixed.eq(u16, q, &i, &condition, v),
            .eqU16Batch => try Fixed.eqBatch(u16, q, &i, &condition, v),
            .neqU16Batch => !try Fixed.eqBatch(u16, q, &i, &condition, v),
            .eqU16BatchSmall => try Fixed.eqBatchSmall(u16, q, &i, &condition, v),
            .neqU16BatchSmall => !try Fixed.eqBatchSmall(u16, q, &i, &condition, v),

            .eqI16 => try Fixed.eq(i16, q, &i, &condition, v),
            .neqI16 => !try Fixed.eq(i16, q, &i, &condition, v),
            .eqI16Batch => try Fixed.eqBatch(i16, q, &i, &condition, v),
            .neqI16Batch => !try Fixed.eqBatch(i16, q, &i, &condition, v),
            .eqI16BatchSmall => try Fixed.eqBatchSmall(i16, q, &i, &condition, v),
            .neqI16BatchSmall => !try Fixed.eqBatchSmall(i16, q, &i, &condition, v),

            .eqU8 => try Fixed.eq(u8, q, &i, &condition, v),
            .neqU8 => !try Fixed.eq(u8, q, &i, &condition, v),
            .eqU8Batch => try Fixed.eqBatch(u8, q, &i, &condition, v),
            .neqU8Batch => !try Fixed.eqBatch(u8, q, &i, &condition, v),
            .eqU8BatchSmall => try Fixed.eqBatchSmall(u8, q, &i, &condition, v),
            .neqU8BatchSmall => !try Fixed.eqBatchSmall(u8, q, &i, &condition, v),

            .eqI8 => try Fixed.eq(i8, q, &i, &condition, v),
            .neqI8 => !try Fixed.eq(i8, q, &i, &condition, v),
            .eqI8Batch => try Fixed.eqBatch(i8, q, &i, &condition, v),
            .neqI8Batch => !try Fixed.eqBatch(i8, q, &i, &condition, v),
            .eqI8BatchSmall => try Fixed.eqBatchSmall(i8, q, &i, &condition, v),
            .neqI8BatchSmall => !try Fixed.eqBatchSmall(i8, q, &i, &condition, v),

            .eqF64 => try Fixed.eq(f64, q, &i, &condition, v),
            .neqF64 => !try Fixed.eq(f64, q, &i, &condition, v),
            .eqF64Batch => try Fixed.eqBatch(f64, q, &i, &condition, v),
            .neqF64Batch => !try Fixed.eqBatch(f64, q, &i, &condition, v),
            .eqF64BatchSmall => try Fixed.eqBatchSmall(f64, q, &i, &condition, v),
            .neqF64BatchSmall => !try Fixed.eqBatchSmall(f64, q, &i, &condition, v),

            .eqI64 => try Fixed.eq(i64, q, &i, &condition, v),
            .neqI64 => !try Fixed.eq(i64, q, &i, &condition, v),
            .eqI64Batch => try Fixed.eqBatch(i64, q, &i, &condition, v),
            .neqI64Batch => !try Fixed.eqBatch(i64, q, &i, &condition, v),
            .eqI64BatchSmall => try Fixed.eqBatchSmall(i64, q, &i, &condition, v),
            .neqI64BatchSmall => !try Fixed.eqBatchSmall(i64, q, &i, &condition, v),
            else => false,
        };

        if (!pass) {
            i = nextOrIndex;
            nextOrIndex = q.len;
        }
    }
    return pass;
}
