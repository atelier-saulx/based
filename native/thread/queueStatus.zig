const Thread = @import("./thread.zig");
const std = @import("std");

pub inline fn waitForQuery(threads: *Thread.Threads) void {
    threads.mutex.lock();
    defer threads.mutex.unlock();
    while (threads.pendingQueries > 0) {
        threads.queryDone.wait(&threads.mutex);
    }
}

pub inline fn waitForModify(threads: *Thread.Threads) void {
    threads.mutex.lock();
    defer threads.mutex.unlock();

    while (threads.pendingModifies > 0) {
        threads.modifyDone.wait(&threads.mutex);
    }
}

pub inline fn modifyIsReady(threads: *Thread.Threads) bool {
    threads.mutex.lock();
    defer threads.mutex.unlock();
    if (threads.pendingModifies > 0) {
        return false;
    }
    return true;
}

pub inline fn queryIsReady(threads: *Thread.Threads) bool {
    threads.mutex.lock();
    defer threads.mutex.unlock();
    if (threads.pendingQueries > 0) {
        return false;
    }
    return true;
}
