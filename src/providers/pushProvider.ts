// Push provider integration

interface ProviderRequest {
  recipient: string;
  message: string;
}

interface ProviderResponse {
  Result: string;
  ErrorCode: string;
  Message: string;
}

export function send(req: ProviderRequest): ProviderResponse {
  if (!req.recipient || !req.message) {
    return {
      Result: "InvalidRequest",
      ErrorCode: "PUSH_INVALID_DEVICE",
      Message: "[push] invalid device token",
    };
  }
  const r = Math.random();
  if (r < 0.45) {
    return {
      Result: "Success",
      ErrorCode: "PUSH_OK",
      Message: "[push] notification delivered",
    };
  }
  if (r < 0.7) {
    const code = Math.random() < 0.5 ? "PUSH_TEMP_001" : "PUSH_TEMP_002";
    return {
      Result: "TemporaryFailure",
      ErrorCode: code,
      Message: "[push] temporary outage, retry later",
    };
  }
  const code = Math.random() < 0.5 ? "PUSH_PERM_REJECTED" : "PUSH_PERM_EXPIRED";
  return {
    Result: "PermanentFailure",
    ErrorCode: code,
    Message: "[push] device token rejected",
  };
}
