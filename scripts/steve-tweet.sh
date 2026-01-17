#!/bin/bash
# steve-tweet.sh - Tweet as Steve (@Steve_Hurley_)
# Usage: steve-tweet.sh <command> [args...]
# Examples:
#   steve-tweet.sh whoami
#   steve-tweet.sh tweet "Hello world!"
#   steve-tweet.sh read <tweet-id>

STEVE_CT0="c8777bd694da0f22a7010e28aa77f2128cac3187196b326b8bfb4d1738dca6ff228dd105ca0950f78577253956333f7106f7f7a08b44bd018003a2960f847f8327729cd68311144a0a6df2930583d732"
STEVE_AUTH_TOKEN="d1622c181780d0ba4507812d3bbaee7767fbace9"

exec bird --ct0 "$STEVE_CT0" --auth-token "$STEVE_AUTH_TOKEN" "$@"
