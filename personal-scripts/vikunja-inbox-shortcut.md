# Vikunja Quick Capture - iOS Shortcut Setup

## API Details (for the shortcut)
- **URL**: `https://projects.timespent.xyz/api/v1/projects/2/tasks`
- **Method**: PUT
- **Token**: `tk_68d4c245cb00f152d4b1a7530202b1e0876bd07e`
- **Project ID**: 2 (Inbox)

## Shortcut Steps

### 1. Create New Shortcut
- Open Shortcuts app
- Tap + to create new shortcut
- Name it: **"💡 Inbox"** or **"Quick Capture"**

### 2. Add "Receive" Action (for Share Sheet)
- Search for **"Receive input from"**
- Set to accept: **Any** (or URLs, Text, Images)
- Check **"Show in Share Sheet"**

### 3. Add "Get URLs from Input" (optional, for link extraction)
- Helps extract clean URLs from shared content

### 4. Add "Get Contents of URL" Action
- URL: `https://projects.timespent.xyz/api/v1/projects/2/tasks`
- Method: **PUT**
- Headers:
  - `Authorization`: `Bearer tk_68d4c245cb00f152d4b1a7530202b1e0876bd07e`
  - `Content-Type`: `application/json`
- Request Body (JSON):
```json
{
  "title": "💡 [Shortcut Input]",
  "description": "Captured via iOS Shortcut"
}
```
(Use the "Shortcut Input" variable for the title)

### 5. Add "Show Notification" Action
- Title: "Added to Inbox ✅"
- Body: (optional) Show the task title

## Quick Test
After setup, share any tweet, link, or text → tap your shortcut → it appears in Vikunja Inbox!

## Token Info
- Token: `tk_68d4c245cb00f152d4b1a7530202b1e0876bd07e`
- Expires: 2036-01-28
- Permissions: Create tasks only
