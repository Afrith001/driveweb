# Drive Companion

Build a complete personal Google Drive File Manager web application.

IMPORTANT:

This is for PERSONAL USE only. Do not add user authentication, signup, login page, or database authentication.

GOAL:

I want a simple website where I can upload my videos and files, and they must be stored in my Google Drive through the Google Drive API.

TECH STACK:

- React + Vite + TypeScript

- Tailwind CSS

- Node.js + Express backend

- Google Drive API

- Use a clean, minimal and responsive UI

UI REQUIREMENTS:

1. HEADER

- App name: "My Drive"

- Simple clean header

- Upload button

2. UPLOAD

- Large "Upload Files" button

- Allow multiple file uploads

- Support videos, images, PDFs, documents and other normal files

- Show upload progress

- Show success/error status

- After upload, automatically refresh the file list

3. FILE LIST

Show all uploaded files in a clean grid/list.

Each file should display:

- File name

- File type

- File size

- Upload date

- File icon/thumbnail where possible

- Open/Preview button

- Download button

- Delete button

For videos:

- Show a video thumbnail if possible

- Allow video preview/playback

4. FOLDERS

Create a simple folder system.

There should be:

- "New Folder" button

- User can enter folder name

- Folder should be created inside the configured Google Drive folder

- Display folders separately from files

- Clicking a folder opens that folder

- Breadcrumb navigation

- Allow uploading files directly into the currently opened folder

5. DATE ORGANIZATION

Also provide an optional automatic date-based folder organization.

Example:

My Drive

├── 2026-08-07

│   ├── video.mp4

│   ├── image.png

│   └── document.pdf

├── 2026-08-08

│   └── another-video.mp4

When uploading a file:

- Automatically create/use a folder based on today's date: YYYY-MM-DD

- Upload the file into that date folder

- Do not create duplicate date folders

6. SEARCH

- Search files by name

- Search should work with the currently loaded Drive files

7. RESPONSIVE DESIGN

- Desktop

- Tablet

- Mobile

- Clean white/black minimal UI

- No unnecessary animations

- Professional file-manager style

GOOGLE DRIVE BACKEND:

Use Google Drive API through the Node.js backend.

IMPORTANT SECURITY:

- NEVER expose Google Drive credentials in React/frontend code.

- NEVER put service-account credentials in the frontend.

- All Google Drive API operations must happen through the backend.

- Use environment variables.

- Add .env.example.

CONFIGURATION:

Create a simple configuration section so I only need to replace my Google Drive credentials.

Use environment variables like:

GOOGLE_SERVICE_ACCOUNT_EMAIL=

GOOGLE_PRIVATE_KEY=

GOOGLE_DRIVE_FOLDER_ID=

The application must clearly explain where these values go.

IMPORTANT:

Do NOT hardcode credentials anywhere.

GOOGLE DRIVE OPERATIONS:

Implement backend APIs for:

POST   /api/upload

GET    /api/files

POST   /api/folders

GET    /api/folders/:folderId/files

DELETE /api/files/:fileId

GET    /api/files/:fileId/download

GET    /api/files/:fileId/preview

Use Google Drive API properly.

The configured GOOGLE_DRIVE_FOLDER_ID should be the main/root folder.

All automatically created date folders and manually created folders must be inside this root folder.

ERROR HANDLING:

- Google Drive authentication errors

- File upload errors

- File too large errors

- Invalid credentials

- Network errors

- Missing environment variables

Show friendly error messages in the UI.

PROJECT STRUCTURE:

Create a production-ready project with:

/frontend

/backend

README.md

.env.example

.gitignore

The frontend and backend must be properly connected.

README MUST INCLUDE:

1. How to install dependencies

2. How to configure Google Drive API

3. Where to put Service Account credentials

4. How to share my Google Drive root folder with the Service Account email

5. How to get GOOGLE_DRIVE_FOLDER_ID

6. How to run frontend

7. How to run backend

8. How to build for production

VERY IMPORTANT:

Do not use Firebase Storage.

Do not use Supabase Storage.

Do not use MongoDB.

Do not use any other storage provider.

Storage must be Google Drive.

FINAL REQUIREMENT:

After completing the project, make sure the entire project is working and properly structured.

Create the complete project folder and provide it as a ZIP file.

I should only need to:

1. Create/share my Google Drive folder with the Service Account

2. Put my Google Drive Service Account credentials into .env

3. Put the Google Drive folder ID into .env

4. Run npm install

5. Start the backend and frontend

Do not leave placeholder functions or incomplete code.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bad36b59-c50f-4d3b-a61c-ddc1db0d7a33).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
