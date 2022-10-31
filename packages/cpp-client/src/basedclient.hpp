#ifndef BASED_CLIENT_H
#define BASED_CLIENT_H

#define BASED_EXPORT __attribute__((__visibility__("default")))

#include <string>

struct Observable;

/////////////////
// Forward declarations
/////////////////

void on_open();
void on_message(std::string message);
void drain_queues();

#endif
