using System.Reflection;
using System.Text.Json;
using NotificationApi;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

Storage.Seed();
var processor = new NotificationProcessor();

app.MapPost("/notifications", (CreateNotificationRequest req) =>
{
    var n = Storage.AddNotification(req.TargetChannels, req.Message);
    return Results.Json(n);
});

app.MapGet("/notifications", () => Results.Json(Storage.GetAll()));

app.MapGet("/notifications/{id:int}", (int id) =>
{
    var n = Storage.FindById(id);
    if (n == null) return Results.Json(new { error = "not found" }, statusCode: 404);
    return Results.Json(n);
});

app.MapPut("/notifications/{id:int}", async (int id, UpdateNotificationRequest req) =>
{
    var n = Storage.FindById(id);
    if (n == null) return Results.Json(new { error = "not found" }, statusCode: 404);
    // Update carefully, only the fields that the user allowed to change
    if (req.Message != null)
    {
        n.Message = req.Message;
        if (n.TargetChannels.Any(c => c.Type == "sms"))
        {
            n.SmsSegments = SmsSegmenter.MinSegments(req.Message);
        }
    }

    if (req.TargetChannels != null)
    {
        n.TargetChannels = req.TargetChannels;
        // Update segments
        if (n.TargetChannels.Any(c => c.Type == "sms"))
        {
            n.SmsSegments = SmsSegmenter.MinSegments(n.Message);
        }
        else
        {
            n.SmsSegments = 0;
        }
    }

    return Results.Json(n);
});

app.MapPost("/notifications/{id:int}/send", (int id) =>
{
    var n = Storage.FindById(id);
    if (n == null) return Results.Json(new { error = "not found" }, statusCode: 404);
    processor.SendOne(n);
    return Results.Json(n);
});

app.MapPost("/notifications/send-bulk", () =>
{
    processor.SendAll();
    return Results.Json(Storage.GetAll());
});

app.Run("http://localhost:3000");

public record UpdateNotificationRequest(List<Channel>? TargetChannels, string? Message);

