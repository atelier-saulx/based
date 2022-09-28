#include <chrono>
#include <iostream>
#include <vector>
#include "../src/apply-patch.hpp"

int main() {
    std::vector<json> copies;

    for (int i = 0; i < 100000; i++) {
        copies.push_back(
            R"({"a":"hello","b":"shurf","c":"snurx","d":{"e":"x"},"f":[1,2,3,4,5]})"_json);
    }
    // json a = R"({"a":"hello","b":"shurf","c":"snurx","d":{"e":"x"},"f":[1,2,3,4,5]})"_json;
    json b =
        R"({"a":"BLARF","z":true,"f":[6,1,2,8,9,4,5],"snurkypants":{"a":true,"b":false},"d":{"e":{"x":true}}})"_json;
    json patch =
        R"({"a":[0,"BLARF"],"z":[0,true],"f":[2,[7,[0,6],[1,2,0],[0,8,9],[1,2,3]]],"snurkypants":[0,{"a":true,"b":false}],"d":{"e":[0,{"x":true}]},"b":[1],"c":[1]})"_json;

    auto t_start = std::chrono::high_resolution_clock::now();
    for (int i = 0; i < 100000; i++) {
        json res = Diff::apply_patch(copies.at(i), patch);
    }

    // Diff::apply_patch(a, patch);

    auto t_end = std::chrono::high_resolution_clock::now();

    double elapsed_time_ms = std::chrono::duration<double, std::milli>(t_end - t_start).count();

    std::cout << "time = " << elapsed_time_ms << std::endl;

    // assert(res == b);
}