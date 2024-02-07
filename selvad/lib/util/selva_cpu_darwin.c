/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <errno.h>
#include <mach/error.h>
#include <mach/mach.h>
#include <mach/task_info.h>
#include <mach/thread_act.h>
#include <mach/thread_policy.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/sysctl.h>
#include <sys/types.h>
#include "selva_error.h"
#include "util/selva_cpu.h"

pthread_t pthread_main_thread_np(void); /* This is a "private" API. */

static bool have_affinity; /*!< Affinity supported by the kernel. */
unsigned long long selva_cpu_count;

static unsigned long long get_first_cpu(const cpu_set_t *cs)
{
    int core = __builtin_ffsll(cs->mask);

    return (core == 0) ?: core - 1;
}

void pthread_attr_set_worker_np(pthread_attr_t *attr)
{
    /*
     * Setting PTHREAD_EXPLICIT_SCHED would be incompatible with the QoS class
     * system. Hence, we only set the class and assume that the caller hasn't
     * called pthread_attr_setinheritsched() or pthread_attr_setschedpolicy().
     */
    pthread_attr_set_qos_class_np(attr, QOS_CLASS_UTILITY, 0);
}

int pthread_create_affinity_np(
        pthread_t *restrict thread,
        pthread_attr_t *restrict attr,
        const cpu_set_t *cs,
        void *(*start_routine)(void *),
        void *restrict arg)
{
    thread_affinity_policy_data_t policy_data = { get_first_cpu(cs) };

    int res = pthread_create_suspended_np(thread, attr, start_routine, arg);
    if (res != 0) {
        return res;
    }

    mach_port_t mach_thread = pthread_mach_thread_np(*thread);
    if (have_affinity) {
        (void)thread_policy_set(mach_thread, THREAD_AFFINITY_POLICY, (thread_policy_t)&policy_data, THREAD_AFFINITY_POLICY_COUNT);
    }
    thread_resume(mach_thread);
    return 0;
}

void selva_cpu_set_main_affinity(const cpu_set_t *cs)
{
    if (have_affinity) {
        thread_port_t threadport = pthread_mach_thread_np(pthread_main_thread_np());
        thread_affinity_policy_data_t policy_data = { get_first_cpu(cs) };

        (void)thread_policy_set(threadport, THREAD_AFFINITY_POLICY, (thread_policy_t)&policy_data, THREAD_AFFINITY_POLICY_COUNT);
    }
}

void selva_cpu_get_main_affinity(cpu_set_t *cs)
{
    if (have_affinity) {
        thread_port_t threadport = pthread_mach_thread_np(pthread_main_thread_np());
        struct thread_affinity_policy policy = {
            .affinity_tag = 0,
        };
        mach_msg_type_number_t count = THREAD_AFFINITY_POLICY_COUNT;
        boolean_t get_default = FALSE;
        kern_return_t ret; /* mach/kern_return.h */

        ret = thread_policy_get(threadport, THREAD_AFFINITY_POLICY, (thread_policy_t)&policy, &count, &get_default);
        if (ret != KERN_SUCCESS) {
            goto fail;
        }
    } else {
fail:
        CPU_FILL(cs);
    }
}

static int macos_set_sched_qos(qos_class_t qc, int relpri)
{
    int err;

    /*
     * pthread_set_qos_class_np() that's not prsent in the headers does
     * similar check but where main is the given thread. However, there
     * is probably no downside in allowing any thread to call this
     * function.
     */
#if 0
    if (pthread_main_thread_np() != pthread_self()) {
        return SELVA_ENOTSUP;
    }
#endif

    err = pthread_set_qos_class_self_np(qc, relpri);
    if (err == EPERM) {
        return SELVA_EINVAL;
    } else if (err) {
        return SELVA_EGENERAL;
    }
    return 0;
}

int selva_cpu_set_sched_user(void)
{
    return macos_set_sched_qos(QOS_CLASS_USER_INITIATED, 0);
}

int selva_cpu_set_sched_batch(void)
{
    /*
     * This will probably make the thread run only on an E-core.
     * QOS_CLASS_UTILITY would be another option that would also allow running
     * on P-cores.
     */
    return macos_set_sched_qos(QOS_CLASS_BACKGROUND, 0);
}

/**
 * Set have_affinity if setting the thread affinity_tag is supported.
 * Changing affinity is supported on some macOS versions and notably it's
 * currently not supported on macOS running on the so called Apple Silicon.
 * An alternative to affinity is to adjust the thread QoS that affects the
 * core selection on Apple Silicon (E or P cores). However, it has even less
 * significant pinning capability than an affinity_tag does.
 */
static void test_affinity(void)
{
    thread_port_t threadport = pthread_mach_thread_np(pthread_main_thread_np());
    struct thread_affinity_policy policy = {
        .affinity_tag = 0,
    };
    mach_msg_type_number_t count = THREAD_AFFINITY_POLICY_COUNT;
    boolean_t get_default = FALSE;
    kern_return_t ret; /* <mach/kern_return.h> */
    /*
     * <mach/error.h> also provides the function mach_error_string(ret) to turn
     * these errors into strings.
     */

    ret = thread_policy_get(threadport, THREAD_AFFINITY_POLICY, (thread_policy_t)&policy, &count, &get_default);
    switch (ret) {
    case KERN_SUCCESS:
        have_affinity = true;
        break;
    case KERN_NOT_SUPPORTED:
        have_affinity = false;
        break;
    default:
        fprintf(stderr, "%s: Unhandled error: %s",
                __FILE__,
                mach_error_string(ret));
        abort();
    }
}

__attribute__((constructor)) static void cpu_init(void)
{
    int32_t core_count = 0;
    size_t len = sizeof(core_count);

    if (sysctlbyname("machdep.cpu.core_count", &core_count, &len, 0, 0)) {
        selva_cpu_count = 1;
    } else {
        selva_cpu_count = core_count;
    }

    test_affinity();
}
