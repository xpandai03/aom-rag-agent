# Fix: Server Configuration Error - Upload Modal

**Issue**: "Server configuration error" appears when trying to upload files
**Cause**: Missing `UPLOAD_PASSWORD` environment variable in Vercel production

---

## 🔧 Quick Fix (5 minutes)

### Step 1: Add Environment Variable to Vercel

1. **Go to your Vercel Dashboard**:
   - Navigate to: https://vercel.com/dashboard
   - Select your project: `aom-rag-agent` or `chat-ui`

2. **Open Settings**:
   - Click on the **Settings** tab at the top
   - Click on **Environment Variables** in the left sidebar

3. **Add the UPLOAD_PASSWORD variable**:
   - Click **Add New** button
   - Fill in the fields:
     ```
     Key: UPLOAD_PASSWORD
     Value: aom-upload-2025
     ```
   - Select environments: **Production**, **Preview**, **Development** (check all three)
   - Click **Save**

4. **Redeploy** (IMPORTANT):
   - Go to the **Deployments** tab
   - Click the **⋯** menu on the latest deployment
   - Select **Redeploy**
   - OR: Push any small change to trigger auto-deploy

### Step 2: Verify the Fix

After redeployment (takes ~2 minutes):

1. Go to: https://chat-ui-mauve-alpha.vercel.app
2. Click the **Upload** button
3. The error "Server configuration error" should be **GONE**
4. Enter password: `aom-upload-2025`
5. Upload should now work ✅

---

## 📋 All Required Environment Variables

Make sure ALL of these are set in Vercel:

| Variable | Value | Notes |
|----------|-------|-------|
| `OPENAI_API_KEY` | `sk-proj-...` | ✅ Already set |
| `PINECONE_API_KEY` | `pcsk_...` | ✅ Already set |
| `PINECONE_ENVIRONMENT` | `us-east-1` | ✅ Already set |
| `PINECONE_INDEX_NAME` | `wordpress-archive` | ✅ Already set |
| `UPLOAD_PASSWORD` | `aom-upload-2025` | ❌ **MISSING - ADD THIS** |

---

## 🖼️ Visual Guide

### Where to Find Environment Variables in Vercel:

```
Vercel Dashboard
  └─ Your Project
      └─ Settings (tab)
          └─ Environment Variables (sidebar)
              └─ Add New
                  ├─ Key: UPLOAD_PASSWORD
                  ├─ Value: aom-upload-2025
                  └─ Environments: [✓] Production [✓] Preview [✓] Development
```

---

## 🔐 Security Note

**Current Password**: `aom-upload-2025`

This is a placeholder password. For production use, consider:
- Using a strong, randomly generated password
- Storing it securely (password manager)
- Sharing only with authorized users

**To change the password**:
1. Update in Vercel environment variables
2. Redeploy
3. Notify authorized users

---

## 🧪 Testing After Fix

### Test Checklist:

- [ ] Upload modal opens without error
- [ ] Can enter password in the field
- [ ] "Continue" button is enabled when password is entered
- [ ] Correct password (`aom-upload-2025`) allows access
- [ ] Wrong password shows "Invalid password" error
- [ ] Can upload CSV files successfully

### Test Upload:

1. Create a small test CSV:
   ```csv
   ID,Title,URL,Content
   1,Test Article,https://example.com,This is a test article content
   ```

2. Save as `test.csv`

3. Upload through the modal:
   - Password: `aom-upload-2025`
   - Select `test.csv`
   - Click Upload
   - Should see success message with stats

---

## 🚨 If Error Persists

### 1. Check Vercel Logs

- Go to **Deployments** tab in Vercel
- Click on the latest deployment
- Go to **Logs** or **Runtime Logs**
- Look for: `UPLOAD_PASSWORD environment variable is not set`

### 2. Verify Variable is Set

In Vercel Settings → Environment Variables:
- Variable name should be **exactly**: `UPLOAD_PASSWORD` (case-sensitive)
- No extra spaces
- Value should match what you want to use as password

### 3. Force Redeploy

Sometimes Vercel needs a fresh deployment:
```bash
cd chat-ui
git commit --allow-empty -m "Force redeploy for env vars"
git push origin main
```

### 4. Check .env.local (Development Only)

If testing locally and still seeing the error:
```bash
# Verify .env.local contains:
UPLOAD_PASSWORD=aom-upload-2025

# Restart your dev server:
npm run dev
```

---

## 🎯 Alternative: Use Vercel CLI

### Quick Command to Add Environment Variable:

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Add environment variable
vercel env add UPLOAD_PASSWORD production preview development

# When prompted, enter: aom-upload-2025

# Redeploy
vercel --prod
```

---

## 📊 Expected Behavior After Fix

### Before Fix:
```
1. User clicks "Upload" button
2. Modal opens
3. Immediately shows: "Server configuration error" ❌
4. Continue button disabled
5. Cannot proceed
```

### After Fix:
```
1. User clicks "Upload" button
2. Modal opens
3. No error message ✅
4. User can enter password
5. Clicking "Continue" validates password
6. On success: Shows file upload screen
7. Can upload CSV files
```

---

## 📝 Summary

**Problem**: Missing `UPLOAD_PASSWORD` environment variable in Vercel
**Solution**: Add it in Vercel Dashboard → Settings → Environment Variables
**Value**: `aom-upload-2025`
**Action**: Must redeploy after adding

**Estimated fix time**: 5 minutes
**Expected downtime**: None (hot reload)

---

## ✅ Verification Commands

After deploying, test with curl:

```bash
# Should return error (wrong password):
curl -X POST https://chat-ui-mauve-alpha.vercel.app/api/validate-password \
  -H "Content-Type: application/json" \
  -d '{"password":"wrong"}'

# Should return success:
curl -X POST https://chat-ui-mauve-alpha.vercel.app/api/validate-password \
  -H "Content-Type: application/json" \
  -d '{"password":"aom-upload-2025"}'
```

Expected successful response:
```json
{
  "success": true,
  "message": "Password validated successfully"
}
```

---

**Created**: October 30, 2025
**Issue**: Server configuration error in upload modal
**Status**: Fix documented - awaiting Vercel environment variable addition
