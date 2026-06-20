// Email provider integration

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
  if (!req.recipient || !req.message || !req.recipient.includes("@")) {
    return {
      Result: "InvalidRequest",
      ErrorCode: "EMAIL_INVALID_ADDRESS",
      Message: "[email] invalid recipient address",
    };
  }
  const r = Math.random();
  if (r < 0.6) {
    return {
      Result: "Success",
      ErrorCode: "EMAIL_OK",
      Message: "[email] accepted for delivery",
    };
  }
  if (r < 0.85) {
    const code = Math.random() < 0.5 ? "EMAIL_TEMP_001" : "EMAIL_TEMP_002";
    return {
      Result: "TemporaryFailure",
      ErrorCode: code,
      Message: "[email] temporary outage, retry later",
    };
  }
  const code = Math.random() < 0.5 ? "EMAIL_PERM_BOUNCED" : "EMAIL_PERM_BLOCKED";
  return {
    Result: "PermanentFailure",
    ErrorCode: code,
    Message: "[email] permanent delivery failure",
  };
}
