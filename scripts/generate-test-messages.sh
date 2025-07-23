#!/bin/bash

# Script to generate random 28-byte hex values and POST them to API

API_URL="http://localhost:3000/api/messages"
TOTAL_REQUESTS=1000

echo "Starting to send $TOTAL_REQUESTS requests to $API_URL"
echo "Press Ctrl+C to stop"

for ((i=1; i<=TOTAL_REQUESTS; i++)); do
    # Generate 28 random bytes and convert to hexadecimal
    # Using /dev/urandom for cryptographically secure random data
    HEX_VALUE=$(head -c 28 /dev/urandom | xxd -p | tr -d '\n')
    
    # POST the hex value to the API
    RESPONSE=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"$HEX_VALUE\"}" \
        -w "%{http_code}")
    
    # Extract HTTP status code (last 3 characters)
    HTTP_CODE="${RESPONSE: -3}"
    RESPONSE_BODY="${RESPONSE%???}"
    
    echo "Request $i/$TOTAL_REQUESTS - Status: $HTTP_CODE - Hex: $HEX_VALUE"
    if [ "$HTTP_CODE" != "200" ]; then
        echo "Response: $RESPONSE_BODY"
    fi
    
    sleep 0.01
done

echo "Completed sending $TOTAL_REQUESTS requests"