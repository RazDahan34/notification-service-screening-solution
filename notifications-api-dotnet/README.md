# Notification delivery API

A small HTTP API that manages and delivers notifications across email, SMS, and push channels.

## Install

```
dotnet restore
```

## Run

```
dotnet run
```

Starts the HTTP server on port 3000.

NOTE: The server pre-populates in-memory storage with a few sample notifications on startup.

## Endpoints

### POST /notifications

Create a notification.

```
curl -X POST http://localhost:3000/notifications \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","targetChannels":[{"type":"email","value":"user@example.com"}]}'
```

### GET /notifications

List all notifications.

```
curl http://localhost:3000/notifications
```

### GET /notifications/:id

Fetch a single notification by id. Returns 404 if not found.

```
curl http://localhost:3000/notifications/1
```

### PUT /notifications/:id

Update a notification. Returns 404 if not found.

```
curl -X PUT http://localhost:3000/notifications/1 \
  -H "Content-Type: application/json" \
  -d '{"message":"Updated message"}'
```

### POST /notifications/:id/send

Send a single notification. Returns 404 if not found.

```
curl -X POST http://localhost:3000/notifications/1/send
```

### POST /notifications/send-bulk

Send all pending notifications.

```
curl -X POST http://localhost:3000/notifications/send-bulk
```

---
## Technical Screening Evaluation - My Improvements

### Issues Found

1. **Thread-Safety Issue in Storage.cs**: The original storage mechanism used a static
List<notification> without any synchronization.In a multi-threaded web server environment, 
simultaneous API requests that access or modify this list can cause race conditions, corrupt the data, 
or trigger InvalidOperationException errors.

2. **Mass Assignment Vulnerability in Program.cs**: The PUT /notification/{id} endpoint
used reflection to update properties of the Notification object based on the incoming JSON.
This introduced a critical security vulnerability that allowed external clients to modify 
internal fields such as Id, Status, Attempts, and SmsSegments.

3. **Broken Delivery Logic in Processor.cs**: The processor handled only the first channel by using 
TargetChannels[0], while completely ignoring any additional channels included in the list.
In addition, the code always marked notifications as NotificationStatuses.Sent, without 
validating the actual Result or ErrorCode returned by the external provider API.

4. **Poor Extensibility in Processor.cs**: The hardcoded if-else chain for checking channel
types (email, sms, push) made the system difficult to extend. Adding a new channel type would
require modifying the core processor logic.

### Improvements Implemented

1. **Thread Synchronization**: Introduced a thread synchronization primitive (lock) in Storage.cs 
to ensure all read, write, and clear operations on the static list are safe from concurrent modifications. 
Modified GetAll() to return a copy (ToList()) to protect consumers from active mutations.

2. **Secure PUT Endpoint with DTOs**: Removed the dangerous reflection code from the PUT endpoint. 
Created a dedicated Data Transfer Object <UpdateNotificationRequest> to explicitly restrict user modifications 
to safe fields (Message and TargetChannels).

3. **Refactored to Strategy Pattern**: Introduced an <INotificationProvider> interface with adapter classes per channel, 
keeping the external providers code unchanged. Replaced the hardcoded if-else logic with a dynamic 
dictionary-based registry for selecting the appropriate provider.

4. **Improved Mulit-Channel Processing & Error Handling**: Updated SendOne to process all target channels instead of a single one. 
Added proper response validation to handle provider results and error codes, ensuring accurate status updates 
such as Sent, Failed, or RetryPending.

### Reasoning

1. **Why lock?** With an in-memory collection, using a simple lock block is an easy and clear way to prevent 
race conditions, without needing to change how the collection is built.

2. **Why DTOs?** It decouples the API contract from the internal domain models, enforcing strict boundaries on what a client can input. 
This improves security by preventing over-posting attacks, increases maintainability by isolating internal changes from external contracts, 
and makes the API behavior more predictable and easier to validate.

3. **Why Strategy Pattern?** This satisfies the Open/Closed Principle. The <NotificationProcessor> is now open for extension 
but closed for modification. New communication channels can be onboarded simply by creating a new provider class and registering it, 
without touching the processing engine.

### AI Tools used

I used Gemini as a pair programmer to assist with the code review and architectural design discussions.
I also used Claude to identify bugs, spot edge cases, and improve overall code quality and robustness. 