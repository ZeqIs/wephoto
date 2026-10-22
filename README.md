# Wedding Photo & Video Booth (Is & Mimi) — Supabase Edition

A static web application configured for **GitHub Pages** that allows wedding guests to capture or upload up to 5 photos and videos in a single session, sending them directly into a **Supabase Storage** bucket (`wedding-photos`).

---

## 🌟 Features

- **Guest Welcome Screen**: Guests enter their name before starting.
- **Sequential 5-Item Capture / Upload**:
  - Direct camera capture for photos and videos (`capture="environment"`).
  - File picker for existing device gallery photos and videos.
  - Mandatory confirmation or **Cancel/Retake** control on every slot before moving to the next item.
- **Review & Submit Screen**:
  - Thumbnails/video player previews for all 5 selected memories.
  - Individual retake shortcuts to jump back and swap out any photo/video.
- **Direct Supabase Storage Uploads**:
  - Direct frontend uploads using `@supabase/supabase-js` without any backend server.
  - Strict naming format: `[SanitizedUserName]_[8-Char-Alphanumerical-Code]_[Counter].[ext]` (e.g. `JohnDoe_A4F9K2M1_1.jpg`).
- **Demo Mode Simulation**:
  - Automatically simulates full upload flow when placeholder Supabase keys are present, enabling instant UI testing without setup.

---

## 🛠️ Supabase Setup Instructions

### 1. Create a Supabase Project
1. Log in to [Supabase](https://supabase.com) and create a new project.
2. Under **Project Settings > API**, copy:
   - **Project URL**
   - **anon / public key**

### 2. Create the Storage Bucket
1. Navigate to **Storage** in the Supabase Dashboard.
2. Click **New bucket**.
3. Name the bucket `wedding-photos`.
4. Toggle **Public bucket** to `ON` (or leave private if using signed access).

### 3. Configure Upload Policy (RLS)
In the Supabase SQL Editor, run the following policy to allow wedding guests to upload without having to log in:

```sql
create policy "Allow public uploads"
on storage.objects for insert
to anon
with check ( bucket_id = 'wedding-photos' );
```

*(Optional)* If you want guests or an admin dashboard to view the uploaded media publicly:
```sql
create policy "Allow public viewing"
on storage.objects for select
to anon
using ( bucket_id = 'wedding-photos' );
```

### 4. Configure `app.js`
In `app.js` (and `js/app.js`), update the configuration block:

```javascript
const CONFIG = {
  TOTAL_ITEMS: 5,
  SUPABASE_URL: 'https://YOUR_PROJECT_ID.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',
  SUPABASE_BUCKET: 'wedding-photos',
  MAX_FILE_SIZE_MB: 100
};
```

---

## 🚀 GitHub Pages Deployment

1. Push this repository to GitHub.
2. Go to **Repository Settings > Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose the `main` branch and `/ (root)` folder.
5. Click **Save**. Your site will be live at `https://<your-username>.github.io/<repo-name>/`.
