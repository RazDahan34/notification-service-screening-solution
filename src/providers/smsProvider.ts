// SMS provider integration

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
  if (!req.recipient || !req.message || req.recipient.length < 7) {
    return {
      Result: "InvalidRequest",
      ErrorCode: "SMS_INVALID_PHONE",
      Message: "[sms] invalid phone number",
    };
  }
  const r = Math.random();
  if (r < 0.5) {
    return {
      Result: "Success",
      ErrorCode: "SMS_OK",
      Message: "[sms] message delivered",
    };
  }
  if (r < 0.8) {
    const code = Math.random() < 0.5 ? "SMS_TEMP_001" : "SMS_TEMP_002";
    return {
      Result: "TemporaryFailure",
      ErrorCode: code,
      Message: "[sms] temporary outage, retry later",
    };
  }
  const code = Math.random() < 0.5 ? "SMS_PERM_BLOCKED" : "SMS_PERM_UNREACHABLE";
  return {
    Result: "PermanentFailure",
    ErrorCode: code,
    Message: "[sms] permanent delivery failure",
  };
}
