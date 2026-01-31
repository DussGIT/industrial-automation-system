# Camera Integration System

## Overview

Flexible camera integration system supporting dynamic device definitions and on-the-fly event mapping. Designed for AXIS cameras but extensible to any IP camera manufacturer.

## Architecture

### HTTP-First Hybrid Approach

```
Camera → HTTP → Hub Backend → MQTT → Flow Engine
                ↓
            Database (Audit Trail)
```

**Benefits:**
- Complete audit trail of all events
- No "shadow subscribers" - all actions visible
- Central control and reporting
- Flexible internal routing via MQTT

## Database Schema

### Core Tables

- **device_definitions** - Reusable device templates
- **device_instances** - Actual deployed cameras
- **camera_events** - Local event storage (2-4 weeks)
- **unknown_events** - Events needing mapping

## Device Definition System

### Definition File Structure

Located in `/backend/device-definitions/`

```json
{
  "id": "manufacturer-model-v1",
  "deviceType": "camera",
  "manufacturer": "Axis",
  "model": "M1075-L",
  "version": "1.0",
  "protocol": "http-vapix",
  
  "eventMappings": {
    "tns1:VideoAnalytics/Motion": {
      "eventType": "motion",
      "fields": {
        "confidence": 100
      }
    }
  },
  
  "configFields": { ... },
  "setupInstructions": { ... }
}
```

### Two-Path Definition System

**Path 1: Over the Wire (Standardized)**
- Build definition in lab/central
- Push to sites via API
- Sites apply automatically

**Path 2: On-the-Fly (Site-Specific)**
- Unknown event received
- Hub logs it
- Admin reviews and maps
- Saves locally

## API Endpoints

### Device Definitions

```
GET    /api/device-definitions
POST   /api/device-definitions
GET    /api/device-definitions/:id
DELETE /api/device-definitions/:id
```

### Device Instances (Cameras)

```
GET    /api/device-instances?device_type=camera
POST   /api/device-instances
PUT    /api/device-instances/:id
DELETE /api/device-instances/:id
```

### Camera Events

```
POST   /api/events/camera/:deviceId    # Camera webhook endpoint
GET    /api/events/history              # Event history with filtering
POST   /api/events/cleanup              # Remove expired events
```

### Unknown Events

```
GET    /api/events/unknown
POST   /api/events/unknown/:id/define   # Map to known event type
POST   /api/events/unknown/:id/ignore   # Ignore event
```

## Camera Setup

### AXIS M1075-L Example

1. **Register Camera in Hub**
   - Navigate to Cameras page
   - Click "Add Camera"
   - Select AXIS M1075-L
   - Enter IP, credentials
   - Save

2. **Configure Camera**
   - Access camera web interface
   - System → Events → Action Rules
   - Create rule for each event type
   - Set HTTP recipient: `http://{hubIP}:3000/api/events/camera/{deviceId}`
   - Method: POST
   - Content-Type: application/json

3. **Configure Analytics**
   - Apps → AXIS Object Analytics
   - Draw zones/lines
   - Set thresholds
   - Save

4. **Test & Map**
   - Trigger event in camera view
   - Check Unknown Events dashboard
   - Map to event type if needed

## Camera vs Hub Responsibilities

### In Camera (Detection)
- Zone selection
- Detection algorithms
- Sensitivity levels
- Which analytics to enable
- Event generation

### In Hub (Orchestration)
- Action on events
- Event correlation
- Time-based rules
- Complex logic
- Flow triggering

## Event Flow

1. Camera detects event
2. HTTP POST to `/api/events/camera/:deviceId`
3. Hub parses using device definition
4. Unknown? → Log for mapping
5. Known? → Store in database
6. Publish to MQTT topic `camera/{name}/{eventType}`
7. Flow engine receives and processes
8. Log which flows were triggered

## Local Event Storage

- Retention: 30 days (configurable)
- Auto-cleanup via scheduled job
- Full audit trail with flow tracking
- Exportable for reporting

## Seeding Device Definitions

```bash
cd backend
node seed-device-definitions.js
```

This loads all `.json` files from `device-definitions/` into the database.

## Frontend Pages

- **/cameras** - Camera management dashboard
- **/unknown-events** - Map unknown events to types
- **/events/history** - Event history and reporting (TODO)

## Flow Node

`camera-event` node already exists at:
- Backend: `backend/src/flow-engine/nodes/camera/camera-event.js`
- Frontend: Config panel in `NodeConfigPanel.jsx`

## Future Enhancements

1. **Event History Dashboard** - Visual timeline, filtering, export
2. **Advanced Field Mapping** - JSONPath editor in UI
3. **Central Definition Repository** - Push/pull from cloud
4. **Camera Discovery** - Auto-detect cameras on network
5. **Snapshot Integration** - Capture images on events
6. **Video Clip Export** - Save clips around events

## Notes

- AXIS Object Analytics scenarios must be configured in camera
- PIR sensor requires AXIS cameras with this feature
- Event confidence levels are estimates
- HTTP timeout is 10 seconds for camera webhooks
- MQTT fallback if publish fails

## Testing

1. Start backend: `npm start`
2. Seed definitions: `node seed-device-definitions.js`
3. Access UI: http://localhost (or board IP)
4. Add camera
5. Configure camera to send events
6. Monitor Unknown Events dashboard
7. Map events as needed
8. Create flows using camera-event nodes

## Support

For device definition examples, see `backend/device-definitions/axis-m1075-l.json`.

For AXIS VAPIX documentation: https://www.axis.com/vapix-library
