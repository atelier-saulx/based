#ifndef BASED_DIFF_H
#define BASED_DIFF_H

#include "../lib/json.hpp"

#include <iostream>
#include <map>
#include <string>

using namespace nlohmann::literals;
using json = nlohmann::json;

namespace Diff {

template <typename T>
bool vec_contains(std::vector<T> vec, T item) {
    if (std::find(vec.begin(), vec.end(), item) != vec.end()) return true;
    else return false;
};

json apply_patch(json, json);

json apply_array_patch(json& value, json patch) {
    if (!value.is_array()) {
        return -1;
    }

    json new_array = json::array();

    json patches = json::array();
    std::vector<int> used;

    int array_index = -1;
    int size = patch.size();

    for (int i = 1; i < size; i++) {
        json operation = patch.at(i);
        // 0 - insert, value
        // 1 - from , index, amount (can be a copy a well)
        // 2 - amount, index
        json type = operation.at(0);
        if (type == 0) {
            int op_size = operation.size();
            for (int j = 1; j < op_size; j++) {
                new_array[++array_index] = operation.at(j);
            }
        } else if (type == 1) {
            int pivot = (int)operation.at(2);
            int range = (int)operation.at(1) + pivot;
            for (int j = pivot; j < range; j++) {
                if (value.at(j).is_object() && vec_contains(used, j)) {
                    // TODO: check how memory works here, does the instance get copied (since it's a
                    // reference)
                    json copy = value.at(j);
                    new_array[++array_index] = copy;
                } else {
                    if (value.is_object()) {
                        used[j] = true;
                    }
                    new_array[++array_index] = value.at(j);
                }
            }
        } else if (type == 2) {
            int pivot = (int)operation.at(1);
            int range = (int)operation.size() - 2 + pivot;
            for (int j = pivot; j < range; j++) {
                // store in map (with struct) on index

                json patch = json::array();
                patch.push_back(++array_index);
                patch.push_back(j);
                patch.push_back(operation.at(j - pivot + 2));
                patches.push_back(patch);
            }
        }
    }

    for (auto& patch : patches) {
        // if nested patch MAP has a struct on index use that one <index, {j, op}>
        int index = (int)patch.at(0);
        int j = (int)patch.at(1);
        auto operation = patch.at(2);
        // TODO: use a reference here based on "used"
        auto x = value.at(j);
        auto new_obj = apply_patch(x, operation);
        new_array[index] = new_obj;
    }

    return new_array;
}

int nested_apply_patch(json& value, std::string key, json patch) {
    if (patch.is_array()) {
        json type = patch.at(0);
        if (type == 0) {
            value[key] = patch.at(1);
        } else if (type == 1) {
            if (value.is_array()) {
                int idx = std::stoi(key);
                value.erase(idx);
            } else {
                // std::cout << "key = " << key << std::endl;
                value.erase(key);
            }
        } else if (type == 2) {
            json res = apply_array_patch(value.at(key), patch.at(1));
            value[key] = res;
        }
        return 0;
    } else if (patch.is_object()) {
        for (auto& el : patch.items()) {
            nested_apply_patch(value[key], el.key(), patch[el.key()]);
        }
        return 0;
    }
    return 0;
}
json apply_patch(json value, json patch) {
    if (patch.is_array()) {
        json type = patch.at(0);
        if (type == 0) {
            return patch.at(1);
        } else if (type == 1) {
            return nullptr;
        } else if (type == 2) {
            return apply_array_patch(value, patch.at(1));
        }
        return 0;
    }
    if (patch.is_object()) {
        if (patch.contains("___$toObject")) {
            json v = json::object();
            for (int i = 0; i < value.size(); i++) {
                v[std::to_string(i)] = value.at(i);
            }
            value = v;
        }
        for (auto& el : patch.items()) {
            if (el.key() != "___$toObject") {
                int r = nested_apply_patch(value, el.key(), patch[el.key()]);
                if (r != 0) return -1;
            }
        }
    }
    return value;
};

};  // namespace Diff

#endif