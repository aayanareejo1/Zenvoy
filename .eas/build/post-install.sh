#!/bin/bash
# Copy Firebase config files from EAS secret file env vars into the project root.
# These files are gitignored; secrets are uploaded via:
#   eas secret:create --scope project --name GOOGLE_SERVICES_INFO_PLIST --type file --value ./GoogleService-Info.plist
#   eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json

set -e

if [ -n "$GOOGLE_SERVICES_INFO_PLIST" ]; then
  echo "Copying GoogleService-Info.plist from secret..."
  cp "$GOOGLE_SERVICES_INFO_PLIST" ./GoogleService-Info.plist
fi

if [ -n "$GOOGLE_SERVICES_JSON" ]; then
  echo "Copying google-services.json from secret..."
  cp "$GOOGLE_SERVICES_JSON" ./google-services.json
fi
