#!/bin/bash
# Z.AI Search & Web Reader Skill
# Uses Z.AI Web Search and Web Reader APIs

set -e

# Load API key from clawdbot config
get_api_key() {
    local key=$(jq -r '.env.ZAI_API_KEY // empty' ~/.clawdbot/clawdbot.json 2>/dev/null)
    if [ -z "$key" ]; then
        echo "Error: ZAI_API_KEY not found in ~/.clawdbot/clawdbot.json" >&2
        exit 1
    fi
    echo "$key"
}

# Web search
search() {
    local query="$*"
    if [ -z "$query" ]; then
        echo "Error: Search query required" >&2
        exit 1
    fi
    
    local api_key=$(get_api_key)
    
    # Use the chat completions API with web_search tool
    local response=$(curl -s -X POST "https://api.z.ai/api/coding/paas/v4/chat/completions" \
        -H "Authorization: Bearer $api_key" \
        -H "Content-Type: application/json" \
        -d '{
            "model": "glm-4.7",
            "messages": [
                {
                    "role": "user",
                    "content": "Search the web for: '"$query"'. Return the top results with titles, URLs, and brief descriptions."
                }
            ],
            "tools": [
                {
                    "type": "web_search",
                    "web_search": {
                        "enable": true
                    }
                }
            ],
            "max_tokens": 2048
        }')
    
    echo "$response" | jq -r '.choices[0].message.content // .error.message // "Error performing search"'
}

# Read and parse a URL
read_url() {
    local url="$1"
    if [ -z "$url" ]; then
        echo "Error: URL required" >&2
        exit 1
    fi
    
    local api_key=$(get_api_key)
    
    # Fetch the URL content and have the model summarize it
    local response=$(curl -s -X POST "https://api.z.ai/api/coding/paas/v4/chat/completions" \
        -H "Authorization: Bearer $api_key" \
        -H "Content-Type: application/json" \
        -d '{
            "model": "glm-4.7",
            "messages": [
                {
                    "role": "user", 
                    "content": "Read and summarize the content from this URL: '"$url"'. Extract the main content, title, and any important metadata. Return the key information in a structured format."
                }
            ],
            "tools": [
                {
                    "type": "web_search",
                    "web_search": {
                        "enable": true
                    }
                }
            ],
            "max_tokens": 4096
        }')
    
    echo "$response" | jq -r '.choices[0].message.content // .error.message // "Error reading URL"'
}

# Research - search and summarize
research() {
    local query="$*"
    if [ -z "$query" ]; then
        echo "Error: Research topic required" >&2
        exit 1
    fi
    
    local api_key=$(get_api_key)
    
    local response=$(curl -s -X POST "https://api.z.ai/api/coding/paas/v4/chat/completions" \
        -H "Authorization: Bearer $api_key" \
        -H "Content-Type: application/json" \
        -d '{
            "model": "glm-4.7",
            "messages": [
                {
                    "role": "user",
                    "content": "Research this topic thoroughly: '"$query"'. Search the web, gather information from multiple sources, and provide a comprehensive summary with citations to your sources."
                }
            ],
            "tools": [
                {
                    "type": "web_search",
                    "web_search": {
                        "enable": true
                    }
                }
            ],
            "max_tokens": 4096
        }')
    
    echo "$response" | jq -r '.choices[0].message.content // .error.message // "Error performing research"'
}

# Main command handler
case "${1:-help}" in
    search)
        shift
        search "$@"
        ;;
    read)
        shift
        read_url "$@"
        ;;
    research)
        shift
        research "$@"
        ;;
    help|--help|-h)
        echo "Z.AI Search & Web Reader Skill"
        echo ""
        echo "Usage:"
        echo "  ./search.sh search <query>     - Search the web"
        echo "  ./search.sh read <url>         - Read and parse a webpage"
        echo "  ./search.sh research <topic>   - Research topic with summary"
        echo ""
        ;;
    *)
        echo "Unknown command: $1" >&2
        echo "Run './search.sh help' for usage." >&2
        exit 1
        ;;
esac
