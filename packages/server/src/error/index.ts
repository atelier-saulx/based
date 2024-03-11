import { BasedServer } from "../server.js";
import { Context } from "@based/functions";
import {
  BasedErrorCode,
  ErrorPayload,
  BasedErrorData,
  createErrorData,
} from "@based/errors";

export function createError<T extends BasedErrorCode>(
  server: BasedServer,
  context: Context,
  code: T,
  payload: ErrorPayload[T]
): BasedErrorData<T> {
  const errorData: BasedErrorData<T> = createErrorData(code, payload);

  if ("streamRequestId" in payload) {
    errorData.streamRequestId = payload.streamRequestId;
  } else if ("requestId" in payload) {
    errorData.requestId = payload.requestId;
  } else if ("observableId" in payload) {
    errorData.observableId = payload.observableId;
  } else if ("channelId" in payload) {
    errorData.channelId = payload.channelId;
  }

  if ("err" in payload) {
    server.emit("error", context, errorData, payload.err);
  } else {
    server.emit("error", context, errorData);
  }
  return errorData;
}
