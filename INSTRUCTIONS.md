# Project Specification & Development Instructions: Wedding Snap & Share App (Supabase Version)

## 1. Project Overview

A static web application (HTML/CSS/JavaScript) hosted on GitHub Pages that allows wedding guests to enter their name and capture or upload up to 5 photos and/or videos in a single session. Media files are sent directly to a **Supabase Storage Bucket** using the official Supabase JavaScript client, eliminating the need for a custom cloud backend.

## 2. Architecture & Components

```
[ GitHub Pages (Static Frontend) ]
       │
       └─ Direct Upload via Supabase JS SDK ──> [ Supabase Storage Bucket ]
```

## 3. Frontend Requirements (GitHub Pages Static Site)

### UI Flow & Structure (`index.html`)

1. **Welcome / Login Screen**:
   * Clean, elegant wedding-themed UI.
   * Input field for the guest's **Name**.
   * "Start Capturing" button (disabled until name is entered).

2. **Capture / Upload Multi-Step Session (1 to 5 items)**:
   * Progress indicator showing current step (e.g., `Photo/Video 3 of 5`).
   * For each slot, provide options:
     * **Capture**: Open device camera or video recorder using HTML5 `getUserMedia` or file inputs with capture attributes (`capture="environment"`).
     * **Upload**: Select existing files from the device gallery (`image/*,video/*`).
   * **Preview & Confirmation**: Show a preview of the captured/uploaded photo or video.
   * **Controls**:
     * **Cancel / Retake**: Allows discarding the current selection and retaking/re-uploading before moving forward. The user **must** be able to cancel or retake before proceeding to the next capture slot until all 5 files are completed.
     * **Next / Confirm**: Saves the current item to the session array and proceeds to the next slot until all 5 are completed.

3. **Review & Submit Screen**:
   * Thumbnails/previews of all 5 captured/uploaded files.
   * "Submit All" button.
   * Loading indicator with status updates during upload.

4. **Success Screen**:
   * Thank-you message and option to start a new session.

### Technical Frontend Details (`app.js`)
* **Hosting**: Pure HTML, Tailwind CSS (via CDN), and vanilla JavaScript.
* **Supabase Integration**: Include the Supabase JS CDN script in `index.html`:
  ```html
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  ```
* **Workflow**:
  1. Collect and sanitize guest name (e.g., remove spaces/special characters).
  2. Generate a random 8-character alphanumeric session code (e.g., `A4F9K2M1`).
  3. Gather up to 5 File objects into an array.
  4. Iterate through the files (1 to 5) and upload each directly to Supabase Storage using the naming convention:
     `[SanitizedUserName]_[8-Char-Alphanumerical-Code]_[Counter].[ext]`
  5. Display success feedback upon completion.

## 4. Naming Convention Logic

Each uploaded file must follow this exact naming format:
`[SanitizedUserName]_[8-Char-Alphanumerical-Code]_[Counter].[ext]`

* **`SanitizedUserName`**: User's name with spaces removed/hyphenated and special characters stripped.
* **`8-Char-Alphanumerical-Code`**: A randomly generated 8-character alphanumeric string generated per session (e.g., `A4F9K2M1`).
* **`Counter`**: A suffix number from `1` to `5` corresponding to the file index.
* **`[ext]`**: Original file extension (e.g., `.jpg`, `.mp4`).

*Example:* `JohnDoe_A4F9K2M1_1.jpg`, `JohnDoe_A4F9K2M1_2.mp4`

## 5. Supabase Setup Instructions

1. **Create Project**: Sign up for a free account on [Supabase](https://supabase.com) and create a new project.
2. **Create Storage Bucket**:
   * Navigate to the **Storage** section in the Supabase Dashboard.
   * Create a new public or private bucket named `wedding-media`.
3. **Storage Policies**:
   * Add a policy allowing public or anon inserts (`INSERT`) so wedding guests can upload files without logging in:
     ```sql
     create policy "Allow public uploads"
     on storage.objects for insert
     to anon
     with check ( bucket_id = 'wedding-media' );
     ```
4. **Environment Configuration**:
   * Expose your Supabase Project URL and Anon/Public API Key safely inside `app.js` (or via configuration variables).

## 6. Directory Structure to Generate

```text
wedding-app/
├── index.html          # Main static frontend UI with Supabase CDN script
├── css/
│   └── style.css       # Custom styling / Tailwind configuration
└── js/
    └── app.js          # Client-side multi-step capture, validation, and Supabase upload logic
```