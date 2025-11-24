const db = @import("db.zig");
const selva = @import("../selva.zig").c;
const napi = @import("../napi.zig");
const std = @import("std");
const t = @import("../types.zig");

fn callJsCallback(
    env: napi.Env,
    jsCallback: napi.Value,
    ctx: ?*anyopaque,
    data: ?*anyopaque,
) callconv(.c) void {
    const responseFn = @as(*t.BridgeResponse, @ptrCast(@alignCast(data.?)));
    const dbCtx = @as(*db.DbCtx, @ptrCast(@alignCast(ctx.?)));

    if (dbCtx.selva == null) {
        std.debug.print("REMOVED {any} \n", .{responseFn});
        return;
    }
    std.debug.print("callJsCallback {any} \n", .{responseFn});

    switch (responseFn.*) {
        t.BridgeResponse.modify => {
            dbCtx.threads.waitForModify();
            dbCtx.threads.mutex.lock();
            const thread = dbCtx.threads.threads[0];
            var arrayBuffer: napi.Value = undefined;
            _ = napi.c.napi_create_external_arraybuffer(
                env,
                thread.modifyResults.ptr,
                thread.modifyResultsIndex,
                null,
                null,
                &arrayBuffer,
            );
            thread.*.modifyResultsIndex = 0;
            // IF TOO LARGE MAKE SMALLER
            var fnResponse: napi.Value = undefined;
            _ = napi.c.napi_create_uint32(env, @intFromEnum(responseFn.*), &fnResponse);
            var args = [_]napi.Value{ fnResponse, arrayBuffer };
            var undefinedVal: napi.Value = undefined;
            _ = napi.c.napi_get_undefined(env, &undefinedVal);
            _ = napi.c.napi_call_function(env, undefinedVal, jsCallback, 2, &args, null);
            dbCtx.threads.jsModifyBridgeStaged = false;
            dbCtx.threads.mutex.unlock();
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
                    thread.queryResults.ptr,
                    thread.queryResultsIndex,
                    null,
                    null,
                    &arrayBuffer,
                );
                _ = napi.c.napi_set_element(env, jsArray, @truncate(index), arrayBuffer);
                thread.*.queryResultsIndex = 0;
                // IF TOO LARGE MAKE SMALLER
            }
            var fnResponse: napi.Value = undefined;
            _ = napi.c.napi_create_uint32(env, @intFromEnum(responseFn.*), &fnResponse);
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
        dbCtx: *db.DbCtx,
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
    ) void {
        const result = std.heap.raw_c_allocator.create(t.BridgeResponse) catch return;
        result.* = response;
        _ = napi.c.napi_call_threadsafe_function(self.tsfn, result, napi.c.napi_tsfn_blocking);
    }
};
