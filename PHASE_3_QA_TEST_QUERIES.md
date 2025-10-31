# Phase 3.3: Live Web Testing - QA Test Queries

**URL**: https://chat-ui-mauve-alpha.vercel.app

## Test Data Overview
- **Total Articles Uploaded**: 4,552
- **Vectors in Pinecone**: 38,188
- **Date Range**: Articles from various years, including recent October 2025 content
- **Success Rate**: 96.3% (183/190 batches)

---

## Test Query Set 1: Recent Articles Verification (October 2025)

### Query 1: Burner Phone Article
**Test Query**:
```
How do I buy and use a burner phone?
```

**Expected Result**:
- Should retrieve: "How to Buy and Use a Burner Phone" (Article ID: 191201)
- Source URL: https://www.artofmanliness.com/?p=191201
- Should provide specific guidance from this recent article

**Pass Criteria**:
- ✅ Response includes content from the burner phone article
- ✅ Source citation shows correct article title
- ✅ URL is correct

---

### Query 2: Instant Coffee Article
**Test Query**:
```
What's the best instant coffee?
```

**Expected Result**:
- Should retrieve: "The Best Instant Coffee" (Article ID: 191299)
- Source URL: https://www.artofmanliness.com/?p=191299
- Should provide recommendations from this article

**Pass Criteria**:
- ✅ Response discusses instant coffee recommendations
- ✅ Source shows "The Best Instant Coffee" article
- ✅ Recent October 2025 publication date referenced

---

### Query 3: Switching Fatigue Article
**Test Query**:
```
Tell me about the hidden fatigue of switching
```

**Expected Result**:
- Should retrieve: "The Hidden Fatigue of Switching — And How to Fix It" (Article ID: 191276)
- Source URL: https://www.artofmanliness.com/?p=191276

**Pass Criteria**:
- ✅ Response explains concept of switching fatigue
- ✅ Provides solutions mentioned in the article
- ✅ Correct source attribution

---

## Test Query Set 2: Classic/Popular Content

### Query 4: Friendship Content
**Test Query**:
```
What can Lonesome Dove teach us about friendship?
```

**Expected Result**:
- Should retrieve: "What Lonesome Dove Can Teach Us About the 4 Tensions of Friendship" (Article ID: 191181)
- Should discuss the 4 tensions of friendship

**Pass Criteria**:
- ✅ Response mentions 4 tensions of friendship
- ✅ References Lonesome Dove
- ✅ Provides insights from the article

---

### Query 5: Anger Management
**Test Query**:
```
How can I make anger my ally?
```

**Expected Result**:
- Should retrieve: "How to Make Anger Your Ally" (Article ID: 191143)
- Should provide strategies for using anger constructively

**Pass Criteria**:
- ✅ Response provides anger management strategies
- ✅ Source shows correct article
- ✅ Practical advice included

---

## Test Query Set 3: Specific Skills

### Query 6: Whip Cracking
**Test Query**:
```
How do I crack a whip?
```

**Expected Result**:
- Should retrieve: "How to Crack a Whip" (Article ID: 191004)
- Should provide step-by-step instructions

**Pass Criteria**:
- ✅ Response includes whip cracking techniques
- ✅ Source is the how-to article
- ✅ Instructions are clear and actionable

---

### Query 7: Rugby Shirt Guide
**Test Query**:
```
Tell me about men's rugby shirts
```

**Expected Result**:
- Should retrieve: "A Man's Guide to the Rugby Shirt" (Article ID: 190779)
- Should discuss rugby shirt style and history

**Pass Criteria**:
- ✅ Response discusses rugby shirts
- ✅ Includes style guidance
- ✅ Source citation present

---

## Test Query Set 4: Data Coverage Verification

### Query 8: Brewing Coffee
**Test Query**:
```
How do I brew the perfect cup of coffee?
```

**Expected Result**:
- Should retrieve: "Brewing the Perfect Cup of Coffee" (Article ID: 2942)
- Shows the system has access to older articles (lower ID numbers)

**Pass Criteria**:
- ✅ Response includes coffee brewing techniques
- ✅ Source is from older content (Article ID ~2942)
- ✅ Demonstrates full date range coverage

---

### Query 9: Cell Phone Survival
**Test Query**:
```
How can I use a cell phone battery for survival?
```

**Expected Result**:
- Should retrieve one or both:
  - "How to Use a [BUSTED] Cell Phone to Meet 5 Basic Survival Needs" (ID: 25105)
  - "Skill of the Week: Start a Fire With a Cell Phone Battery" (ID: 81629)

**Pass Criteria**:
- ✅ Response includes survival techniques using cell phone
- ✅ Multiple articles may be cited
- ✅ Demonstrates mid-range article access

---

### Query 10: Podcast Content Check
**Test Query**:
```
What was discussed in podcast 1090?
```

**Expected Result**:
- Should retrieve: "Podcast #1,090: Chasing the White Whale — Into the Depths of Moby-Dick" (ID: 191301)
- Should summarize podcast content

**Pass Criteria**:
- ✅ Response mentions Moby-Dick discussion
- ✅ Source shows Podcast #1090
- ✅ Recent content (October 2025)

---

## Performance Metrics to Track

For each query, record:
- **Response Time**: Should be < 5 seconds
- **Relevance Score**: High/Medium/Low (subjective)
- **Source Count**: Number of articles cited
- **Source Accuracy**: Do URLs and titles match our data?
- **Content Quality**: Is the response useful and accurate?

---

## Success Criteria

**Pass Threshold**: 8 out of 10 queries should pass all criteria

**Critical Failures** (immediate attention needed):
- ❌ No results returned for recent articles (IDs 191000+)
- ❌ All sources are from same narrow date range
- ❌ URLs don't match our uploaded data
- ❌ Response time > 10 seconds consistently

**Acceptable Issues** (note for future optimization):
- ⚠️ Occasional irrelevant source in multi-source responses
- ⚠️ Response time 5-8 seconds
- ⚠️ Missing one specific article when similar content exists

---

## Additional Verification Tests

### Test 11: Date Range Verification
**Query**: "Show me articles from October 2025"

**Expected**: Should mention or cite articles with IDs 191000+

### Test 12: Article Count Reality Check
**Query**: "How many articles are in your archive?"

**Expected**: While the AI won't know the exact count, it should retrieve recent meta-content or "Best of" articles that mention the archive size. The actual answer (4,552 articles) isn't something the RAG system would know unless it's in the article content itself.

**Note**: This is expected behavior - the RAG system retrieves content from articles, it doesn't have metadata about the total collection size.

---

## Test Execution Log Template

```markdown
## Test Execution - [Date/Time]

### Query 1: Burner Phone
- ✅/❌ Pass/Fail
- Response Time: ___ seconds
- Sources Retrieved: ___
- Notes:

### Query 2: Instant Coffee
- ✅/❌ Pass/Fail
- Response Time: ___ seconds
- Sources Retrieved: ___
- Notes:

[Continue for all queries...]

---

## Overall Results
- Total Queries: 10
- Passed: ___/10
- Failed: ___/10
- Average Response Time: ___ seconds
- **Overall Assessment**: PASS/FAIL

## Issues Found
1. [Issue description]
2. [Issue description]

## Recommendations
1. [Recommendation]
2. [Recommendation]
```

---

**Test Conducted By**: Brett / Raunek
**Date**: October 30, 2025
**System Version**: Phase 3 - Post-ingestion
**Pinecone Stats**: 38,188 vectors from 4,552 articles
