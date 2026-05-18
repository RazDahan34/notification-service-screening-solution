namespace NotificationApi;

public static class Storage
{
    private static readonly object _lock = new();//New object that represent a key for locking

    public static List<Notification> Notifications = new();
    public static int NextId = 1;

    public static Notification AddNotification(List<Channel> targetChannels, string message)
    {
        lock (_lock)
        {
            var n = new Notification
            {
                Id = NextId,
                TargetChannels = targetChannels,
                Message = message
            };
            if (targetChannels.Any(c => c.Type == "sms"))
            {
                n.SmsSegments = SmsSegmenter.MinSegments(message);
            }
            NextId += 1;
            Notifications.Add(n);
            return n;
        }
    }

    public static List<Notification> GetAll()
    {
        lock (_lock)
        {
            return Notifications.ToList();//return a copy 
        }
    }

    public static Notification? FindById(int id)
    {
        lock (_lock)
        {
            foreach (var n in Notifications)
            {
                if (n.Id == id) return n;
            }
            return null;
        }
    }

    public static void Seed()
    {
        lock (_lock)
        {
            Notifications.Clear();
            NextId = 1;

            var n1 = AddNotification(
                new List<Channel> { new Channel { Type = "email", Value = "alice@example.com" } },
                "Welcome to the platform"
            );
            n1.Status = NotificationStatuses.Sent;
            n1.Attempts = 1;
            n1.LastAttemptAt = DateTime.Now.ToString("O");
            n1.LastError = "[email] accepted for delivery";

            AddNotification(
                new List<Channel> { new Channel { Type = "sms", Value = "12345" } },
                "Short number"
            );

            var n3 = AddNotification(
                new List<Channel> { new Channel { Type = "push", Value = "device-abc" } },
                "Your ride is here"
            );
            n3.Status = NotificationStatuses.Failed;
            n3.Attempts = 1;
            n3.LastAttemptAt = DateTime.Now.ToString("O");
            n3.LastError = "[push] device token rejected";

            AddNotification(
                new List<Channel>
                {
                new Channel { Type = "email", Value = "bob@example.com" },
                new Channel { Type = "sms", Value = "+15551234567" }
                },
                "2FA code 4242"
            );

            var n5 = AddNotification(
                new List<Channel>
                {
                new Channel { Type = "sms", Value = "+15559876543" },
                new Channel { Type = "push", Value = "device-xyz" },
                new Channel { Type = "email", Value = "carol@example.com" }
                },
                "Order shipped"
            );
            n5.Status = NotificationStatuses.RetryPending;
            n5.Attempts = 2;
            n5.LastAttemptAt = DateTime.Now.ToString("O");
            n5.LastError = "[sms] temporary outage, retry later";
        }
    }
}
