#!/bin/bash
# Make all shell scripts in this directory executable

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

chmod +x "$DIR"/*.sh

echo "All shell scripts in $DIR are now executable"
echo ""
echo "Scripts:"
ls -1 "$DIR"/*.sh 2>/dev/null | sed 's|'"$DIR"'/||'
