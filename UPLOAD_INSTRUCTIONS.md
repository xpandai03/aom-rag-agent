# WordPress CSV Upload Instructions

## Step 1: Clean the CSV

Run the Python script to clean your CSV:

```bash
python3 clean_wordpress_csv.py
```

This will read `wordpress_posts.csv` and create `wordpress_posts_clean.csv` with only 4 columns.

---

## Step 2: Upload in Batches

### Option A: Use the upload script (recommended)

```bash
chmod +x upload_batches.sh
./upload_batches.sh
```

### Option B: Manual shell loop

```bash
BATCH_SIZE=100
TOTAL_BATCHES=274  # Adjust based on actual row count

for batch in $(seq 0 $((TOTAL_BATCHES - 1))); do
  START=$((batch * BATCH_SIZE + 2))  # +2 to skip header

  JSON_DATA=$(( \
    head -n 1 wordpress_posts_clean.csv && \
    tail -n +$START wordpress_posts_clean.csv | head -n $BATCH_SIZE \
  ) | python3 -c "import csv, json, sys; print(json.dumps([row for row in csv.DictReader(sys.stdin)]))")

  curl -X POST \
    -H "Content-Type: application/json" \
    -d "$JSON_DATA" \
    "https://chat-ui-mauve-alpha.vercel.app/api/ingest?batch=${batch}&size=100"

  echo "Batch $batch uploaded"
  sleep 0.5
done
```

---

## Example: Upload a Single Batch (Batch 0)

```bash
# Extract first 100 rows (after header) as JSON
JSON_DATA=$(( \
  head -n 1 wordpress_posts_clean.csv && \
  tail -n +2 wordpress_posts_clean.csv | head -n 100 \
) | python3 -c "import csv, json, sys; print(json.dumps([row for row in csv.DictReader(sys.stdin)]))")

# POST to API
curl -X POST \
  -H "Content-Type: application/json" \
  -d "$JSON_DATA" \
  "https://chat-ui-mauve-alpha.vercel.app/api/ingest?batch=0&size=100"
```

### Example JSON payload structure:
```json
[
  {
    "ID": "12345",
    "Title": "Sample Post Title",
    "URL": "https://example.com/sample-post",
    "Content": "<p>HTML content here...</p>"
  },
  {
    "ID": "12346",
    "Title": "Another Post",
    "URL": "https://example.com/another-post",
    "Content": "<p>More content...</p>"
  }
]
```

---

## Notes

- The script automatically handles ~27,000 rows → ~270 batches
- Each batch contains up to 100 rows
- A 0.5s delay between requests prevents server overload
- HTTP 200/201 responses indicate success
