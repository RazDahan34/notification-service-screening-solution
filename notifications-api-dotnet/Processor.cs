using NotificationApi.Providers;

namespace NotificationApi;

// Define the interface for the different notification providers (Strategy Pattern)
public interface INotificationProvider
{
    ProviderResponse Send(string recipient, string message);
}

// Implement wrapper classes (Adapters) for external providers without modifying the original files
public class EmailNotificationProvider : INotificationProvider
{
    public ProviderResponse Send(string recipient, string message)
    {
        return EmailProvider.Send(new Dictionary<string, string>
        {
            { "recipient", recipient },
            { "message", message }
        });
    }
}

public class SmsNotificationProvider : INotificationProvider
{
    public ProviderResponse Send(string recipient, string message)
    {
        return SmsProvider.Send(new Dictionary<string, string>
        {
            { "recipient", recipient },
            { "message", message }
        });
    }
}

public class PushNotificationProvider : INotificationProvider
{
    public ProviderResponse Send(string recipient, string message)
    {
        return PushProvider.Send(new Dictionary<string, string>
        {
            { "recipient", recipient },
            { "message", message }
        });
    }
}

// The refactored and corrected NotificationProcessor class
public class NotificationProcessor
{
    private readonly Dictionary<string, INotificationProvider> _providers;

    public NotificationProcessor()
    {
        // Register providers flexibly using a dictionary to satisfy the Open/Closed Principle
        _providers = new Dictionary<string, INotificationProvider>(StringComparer.OrdinalIgnoreCase)
        {
            { "email", new EmailNotificationProvider() },
            { "sms", new SmsNotificationProvider() },
            { "push", new PushNotificationProvider() }
        };
    }

    public void SendOne(Notification n)
    {
        n.Status = NotificationStatuses.Processing;
        n.Attempts += 1;
        n.LastAttemptAt = DateTime.Now.ToString("O");

        if (n.TargetChannels == null || n.TargetChannels.Count == 0)
        {
            n.Status = NotificationStatuses.Failed;
            n.LastError = "No target channels";
            return;
        }

        bool allSentSuccessfully = true;
        List<string> errorMessages = new();

        // Fix 1: Loop through ALL requested channels instead of just the first one
        foreach (var target in n.TargetChannels)
        {
            if (!_providers.TryGetValue(target.Type, out var provider))
            {
                allSentSuccessfully = false;
                errorMessages.Add($"[{target.Type}] Unknown channel type");
                continue;
            }

            try
            {
                var response = provider.Send(target.Value, n.Message);

                // Fix 2: Evaluate the actual provider response instead of blindly marking as Sent
                if (response.Result == "error" || !string.IsNullOrEmpty(response.ErrorCode))
                {
                    allSentSuccessfully = false;
                    errorMessages.Add($"[{target.Type}] Error: {response.Message} (Code: {response.ErrorCode})");

                    // Handle temporary issues to allow subsequent retry attempts
                    if (response.ErrorCode == "temporary_outage" || response.Message.Contains("temporary", StringComparison.OrdinalIgnoreCase))
                    {
                        n.Status = NotificationStatuses.RetryPending;
                    }
                }
            }
            catch (Exception ex)
            {
                allSentSuccessfully = false;
                errorMessages.Add($"[{target.Type}] System Exception: {ex.Message}");
            }
        }

        // Update the final notification status based on the results of all targeted channels
        if (allSentSuccessfully)
        {
            n.Status = NotificationStatuses.Sent;
            n.LastError = "All channels delivered successfully";
        }
        else
        {
            // If the status wasn't explicitly set to RetryPending during the loop, mark it as Failed
            if (n.Status != NotificationStatuses.RetryPending)
            {
                n.Status = NotificationStatuses.Failed;
            }
            n.LastError = string.Join(" | ", errorMessages);
        }
    }

    public void SendAll()
    {
        // Process both Pending notifications and those waiting for a retry execution
        var pending = Storage.Notifications
            .Where(n => n.Status == NotificationStatuses.Pending || n.Status == NotificationStatuses.RetryPending)
            .ToList();

        foreach (var n in pending)
        {
            SendOne(n);
        }
    }
}