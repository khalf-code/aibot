#!/bin/bash
# Check Steve's email inbox for unread messages
# Outputs: 📬 New email from [sender]: [subject] or nothing (silent)

# Email credentials from clawdbot.json skills.entries.steve-email.env
EMAIL="${STEVE_EMAIL:-steve@withagency.ai}"
PASSWORD="${STEVE_EMAIL_PASSWORD}"

if [ -z "$PASSWORD" ]; then
    echo "⚠️ Missing STEVE_EMAIL_PASSWORD" >&2
    exit 1
fi

# Check for unread messages
RESULT=$(uv run skills/purelymail/scripts/purelymail.py inbox \
    --email "$EMAIL" \
    --password "$PASSWORD" \
    --unread \
    --limit 10 2>/dev/null)

# Count unread
UNREAD_COUNT=$(echo "$RESULT" | grep -c "From:")

if [ "$UNREAD_COUNT" -gt 0 ]; then
    # Output each unread email
    echo "$RESULT" | grep -E "^(From:|Subject:)" | while read -r line; do
        if [[ "$line" == From:* ]]; then
            SENDER="${line#From: }"
        elif [[ "$line" == Subject:* ]]; then
            SUBJECT="${line#Subject: }"
            echo "📬 New email from $SENDER: $SUBJECT"
        fi
    done
    
    # Mark all as read
    uv run skills/purelymail/scripts/purelymail.py mark-read all \
        --email "$EMAIL" \
        --password "$PASSWORD" >/dev/null 2>&1
fi

# If no unread, output nothing (silent ack)
