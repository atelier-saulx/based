#ifndef BASED_INCOMING_H
#define BASED_INCOMING_H

enum IncomingType { FUNCTION_DATA = 0, SUBSCRIPTION_DATA, SUBSCRIPTION_DIFF_DATA };

class Decoder {
   public:
    IncomingType getDataType(int header) {}

   private:
};

#endif