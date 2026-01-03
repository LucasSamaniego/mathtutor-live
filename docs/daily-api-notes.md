# Daily.co API Integration Notes

## REST API - Create Room
- Endpoint: POST https://api.daily.co/v1/rooms
- Authentication: Bearer token (API Key)

## Body Parameters
- `name`: string (optional) - Room name, only alphanumeric, dash, underscore. Max 128 chars.
- `privacy`: "public" | "private" (default: "public")
- `properties`: object
  - `nbf`: integer - "Not before" unix timestamp
  - `exp`: integer - "Expires" unix timestamp
  - `max_participants`: integer - Max people allowed

## Daily JS SDK
- Package: @daily-co/daily-js
- Methods: createCallObject(), join(), leave(), participants(), etc.

## Daily React Hooks
- Package: @daily-co/daily-react
- Components: DailyProvider, DailyVideo, DailyAudio
- Hooks: useDaily, useParticipant, useParticipantIds, useLocalParticipant, useDevices, useScreenShare
