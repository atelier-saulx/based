const selva = @import("../selva/selva.zig").c;
const napi = @import("../napi.zig");
const std = @import("std");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;

pub const BridgeResponseStruct = struct {
    response: t.BridgeResponse,
    threadId: usize,
};

fn callJsCallback(
    env: napi.Env,
    jsCallback: napi.Value,
    ctx: ?*anyopaque,
    data: ?*anyopaque,
) callconv(.c) void {
    const responseFn = @as(*BridgeResponseStruct, @ptrCast(@alignCast(data.?)));
    const dbCtx = @as(*DbCtx, @ptrCast(@alignCast(ctx.?)));

    if (dbCtx.selva == null) {
        std.debug.print("REMOVED DB firing bridge... {any} \n", .{responseFn});
        return;
    }

    switch (responseFn.response) {
        t.BridgeResponse.modify => {
            dbCtx.threads.waitForModify();
            dbCtx.threads.mutex.lock();
            const thread = dbCtx.threads.threads[0];
            var arrayBuffer: napi.Value = undefined;
            _ = napi.c.napi_create_external_arraybuffer(
                env,
                thread.modify.data.ptr,
                thread.modify.index,
                null,
                null,
                &arrayBuffer,
            );
            thread.*.modify.index = 0;
            var fnResponse: napi.Value = undefined;
            _ = napi.c.napi_create_uint32(env, @intFromEnum(responseFn.response), &fnResponse);
            var args = [_]napi.Value{ fnResponse, arrayBuffer };
            var undefinedVal: napi.Value = undefined;
            _ = napi.c.napi_get_undefined(env, &undefinedVal);
            _ = napi.c.napi_call_function(env, undefinedVal, jsCallback, 2, &args, null);
            dbCtx.threads.jsModifyBridgeStaged = false;
            dbCtx.threads.mutex.unlock();
        },
        t.BridgeResponse.flushQuery => {
            const thread = dbCtx.threads.threads[responseFn.threadId];

            // std.debug.print("CALLBACK FLUSH #{any} \n", .{responseFn.threadId});

            var arrayBuffer: napi.Value = undefined;
            _ = napi.c.napi_create_external_arraybuffer(
                env,
                thread.query.data.ptr,
                thread.query.index,
                null,
                null,
                &arrayBuffer,
            );
            thread.*.query.index = 0;
            var fnResponse: napi.Value = undefined;
            _ = napi.c.napi_create_uint32(env, @intFromEnum(responseFn.response), &fnResponse);
            var args = [_]napi.Value{ fnResponse, arrayBuffer };
            var undefinedVal: napi.Value = undefined;
            _ = napi.c.napi_get_undefined(env, &undefinedVal);
            _ = napi.c.napi_call_function(env, undefinedVal, jsCallback, 2, &args, null);
            thread.mutex.lock();
            thread.flushed = true;
            // std.debug.print("SEND SIGNAL #{any} \n", .{responseFn.threadId});
            thread.flushDone.signal();
            thread.mutex.unlock();
        },
        t.BridgeResponse.flushModify => {
            const thread = dbCtx.threads.threads[responseFn.threadId];
            var arrayBuffer: napi.Value = undefined;
            _ = napi.c.napi_create_external_arraybuffer(
                env,
                thread.modify.data.ptr,
                thread.modify.index,
                null,
                null,
                &arrayBuffer,
            );
            thread.*.modify.index = 0;
            var fnResponse: napi.Value = undefined;
            _ = napi.c.napi_create_uint32(env, @intFromEnum(responseFn.response), &fnResponse);
            var args = [_]napi.Value{ fnResponse, arrayBuffer };
            var undefinedVal: napi.Value = undefined;
            _ = napi.c.napi_get_undefined(env, &undefinedVal);
            _ = napi.c.napi_call_function(env, undefinedVal, jsCallback, 2, &args, null);
            thread.mutex.lock();
            thread.flushed = true;
            thread.flushDone.signal();
            thread.mutex.unlock();
        },
        t.BridgeResponse.query => {
            dbCtx.threads.waitForQuery();
            var jsArray: napi.Value = undefined;
            _ = napi.c.napi_create_array_with_length(env, dbCtx.threads.threads.len, &jsArray);
            dbCtx.threads.mutex.lock();
            for (dbCtx.threads.threads, 0..) |thread, index| {
                var arrayBuffer: napi.Value = undefined;
                _ = napi.c.napi_create_external_arraybuffer(
                    env,
                    thread.query.data.ptr,
                    thread.query.index,
                    null,
                    null,
                    &arrayBuffer,
                );
                _ = napi.c.napi_set_element(env, jsArray, @truncate(index), arrayBuffer);
                thread.query.index = 0;
            }
            var fnResponse: napi.Value = undefined;
            _ = napi.c.napi_create_uint32(env, @intFromEnum(responseFn.response), &fnResponse);
            var args = [_]napi.Value{ fnResponse, jsArray };
            var undefinedVal: napi.Value = undefined;
            _ = napi.c.napi_get_undefined(env, &undefinedVal);
            _ = napi.c.napi_call_function(env, undefinedVal, jsCallback, 2, &args, null);
            dbCtx.threads.jsQueryBridgeStaged = false;
            dbCtx.threads.mutex.unlock();
        },
    }

    std.heap.raw_c_allocator.destroy(responseFn);
}

pub const Callback = struct {
    env: napi.Env,
    tsfn: napi.c.napi_threadsafe_function,

    pub fn init(
        env: napi.Env,
        dbCtx: *DbCtx,
        jsFunc: napi.Value,
    ) !*Callback {
        const self = try std.heap.raw_c_allocator.create(Callback);

        var name: napi.Value = undefined;
        _ = napi.c.napi_create_string_utf8(env, "ZigThreadSafeJsBridge", napi.c.NAPI_AUTO_LENGTH, &name);

        var tsfn: napi.c.napi_threadsafe_function = undefined;

        _ = napi.c.napi_create_threadsafe_function(
            env,
            jsFunc,
            null,
            name,
            0, // Max queue size (0 = unlimited)
            1, // Initial thread count
            null, // Thread finalize data
            null, // Thread finalize cb
            dbCtx, // Context
            callJsCallback, // <--- THE BRIDGE FUNCTION
            &tsfn,
        );

        self.* = .{
            .env = env,
            .tsfn = tsfn,
        };

        return self;
    }

    pub fn deinit(self: *Callback) void {
        std.debug.print("REMOVE JS BRIDGE \n", .{});
        _ = napi.c.napi_release_threadsafe_function(self.tsfn, napi.c.napi_tsfn_release);
        std.heap.raw_c_allocator.destroy(self);
    }

    pub fn call(
        self: *Callback,
        response: t.BridgeResponse,
        threadId: usize,
    ) void {
        const result = std.heap.raw_c_allocator.create(BridgeResponseStruct) catch return;
        result.*.response = response;
        result.*.threadId = threadId;
        _ = napi.c.napi_call_threadsafe_function(self.tsfn, result, napi.c.napi_tsfn_blocking);
    }
};
