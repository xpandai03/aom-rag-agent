#!/bin/bash
# Upload wordpress_posts_clean.csv in smaller batches
# Each batch will be uploaded as a separate CSV file

CSV_FILE="wordpress_posts_clean.csv"
API_ENDPOINT="https://chat-ui-mauve-alpha.vercel.app/api/ingest/upload"
BATCH_SIZE=25  # Articles per batch (keep files under 500KB)
TEMP_DIR="./csv_batches"

echo "=================================================="
echo "  Brett RAG Agent - Batched CSV Upload"
echo "=================================================="
echo ""

# Check if file exists
if [ ! -f "$CSV_FILE" ]; then
    echo "❌ Error: $CSV_FILE not found"
    exit 1
fi

# Get file stats
LINE_COUNT=$(wc -l < "$CSV_FILE" | tr -d ' ')
ARTICLE_COUNT=$((LINE_COUNT - 1))
TOTAL_BATCHES=$(( (ARTICLE_COUNT + BATCH_SIZE - 1) / BATCH_SIZE ))

echo "📊 File Stats:"
echo "   - Total articles: $ARTICLE_COUNT"
echo "   - Batch size: $BATCH_SIZE articles"
echo "   - Total batches: $TOTAL_BATCHES"
echo ""

# Create temp directory for batch files
mkdir -p "$TEMP_DIR"

# Extract header
HEADER=$(head -n 1 "$CSV_FILE")

echo "🔪 Splitting CSV into batches..."
echo ""

# Split the CSV into batches
for batch_num in $(seq 0 $((TOTAL_BATCHES - 1))); do
    BATCH_FILE="$TEMP_DIR/batch_${batch_num}.csv"
    START_LINE=$((batch_num * BATCH_SIZE + 2))  # +2 to skip header
    END_LINE=$((START_LINE + BATCH_SIZE - 1))

    # Create batch CSV with header
    echo "$HEADER" > "$BATCH_FILE"
    tail -n +$START_LINE "$CSV_FILE" | head -n $BATCH_SIZE >> "$BATCH_FILE"

    BATCH_LINES=$(wc -l < "$BATCH_FILE" | tr -d ' ')
    BATCH_ARTICLES=$((BATCH_LINES - 1))

    echo "   ✓ Batch $batch_num: $BATCH_ARTICLES articles"
done

echo ""
echo "=================================================="
echo "  Starting Upload"
echo "=================================================="
echo ""

# Initialize counters
SUCCESSFUL_BATCHES=0
FAILED_BATCHES=0
TOTAL_ARTICLES_PROCESSED=0
TOTAL_VECTORS_UPSERTED=0
TOTAL_COST=0

# Upload each batch
for batch_num in $(seq 0 $((TOTAL_BATCHES - 1))); do
    BATCH_FILE="$TEMP_DIR/batch_${batch_num}.csv"

    echo "📤 Uploading Batch $((batch_num + 1))/$TOTAL_BATCHES..."

    START_TIME=$(date +%s)

    RESPONSE=$(curl -s -X POST \
        -F "file=@$BATCH_FILE" \
        -F "source=manual-batch-$batch_num" \
        "$API_ENDPOINT")

    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))

    # Check if successful
    if echo "$RESPONSE" | grep -q '"success":true'; then
        SUCCESSFUL_BATCHES=$((SUCCESSFUL_BATCHES + 1))

        # Extract stats using grep and sed (portable)
        ARTICLES=$(echo "$RESPONSE" | grep -o '"articlesProcessed":[0-9]*' | grep -o '[0-9]*')
        VECTORS=$(echo "$RESPONSE" | grep -o '"vectorsUpserted":[0-9]*' | grep -o '[0-9]*')
        COST=$(echo "$RESPONSE" | grep -o '"estimatedCost":[0-9.]*' | grep -o '[0-9.]*')

        TOTAL_ARTICLES_PROCESSED=$((TOTAL_ARTICLES_PROCESSED + ARTICLES))
        TOTAL_VECTORS_UPSERTED=$((TOTAL_VECTORS_UPSERTED + VECTORS))
        TOTAL_COST=$(echo "$TOTAL_COST + $COST" | bc 2>/dev/null || echo "$TOTAL_COST")

        echo "   ✅ Success! (${DURATION}s)"
        echo "      Articles: $ARTICLES | Vectors: $VECTORS | Cost: \$$COST"
    else
        FAILED_BATCHES=$((FAILED_BATCHES + 1))
        echo "   ❌ Failed! (${DURATION}s)"
        echo "      Response: $RESPONSE"
    fi

    echo ""

    # Save response to log
    echo "$RESPONSE" > "$TEMP_DIR/batch_${batch_num}_response.json"

    # Small delay to avoid overwhelming the server
    sleep 1
done

echo "=================================================="
echo "  Upload Summary"
echo "=================================================="
echo ""
echo "📊 Results:"
echo "   - Total batches: $TOTAL_BATCHES"
echo "   - Successful: $SUCCESSFUL_BATCHES"
echo "   - Failed: $FAILED_BATCHES"
echo ""
echo "📈 Totals:"
echo "   - Articles processed: $TOTAL_ARTICLES_PROCESSED"
echo "   - Vectors upserted: $TOTAL_VECTORS_UPSERTED"
echo "   - Estimated cost: \$$TOTAL_COST"
echo ""

# Get final Pinecone stats
echo "☁️  Getting final Pinecone stats..."
FINAL_RESPONSE=$(curl -s -X POST \
    -F "file=@$TEMP_DIR/batch_$((TOTAL_BATCHES - 1)).csv" \
    -F "source=stats-check" \
    "$API_ENDPOINT" 2>/dev/null)

if echo "$FINAL_RESPONSE" | grep -q "totalRecordCount"; then
    TOTAL_RECORDS=$(echo "$FINAL_RESPONSE" | grep -o '"totalRecordCount":[0-9]*' | grep -o '[0-9]*' | tail -1)
    echo "   - Total record count in Pinecone: $TOTAL_RECORDS"
fi

echo ""
echo "=================================================="
echo ""

# Cleanup option
read -p "🗑️  Delete temporary batch files? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$TEMP_DIR"
    echo "   ✓ Cleaned up temporary files"
fi

if [ $FAILED_BATCHES -eq 0 ]; then
    echo ""
    echo "✅ ALL BATCHES UPLOADED SUCCESSFULLY!"
    exit 0
else
    echo ""
    echo "⚠️  Some batches failed. Check logs in $TEMP_DIR/"
    exit 1
fi
