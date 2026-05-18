# JobConnect API Documentation

Base URL: `http://localhost:3000`

All ID fields use **UUID** format (`String @id @default(uuid()) @db.Uuid` in Prisma).

**Response Standard:**
- **Success (Controller layer):** `{ status: 'success', data: {...} }` or `{ status: 'success', message: '...', data: {...} }`. Some endpoints return `{ message: '...', data: {...} }` without `status` (e.g., portfolio creation, application submission, logout).
- **Error (Controller layer):** `{ message: '...' }` or `{ status: 'error', message: '...' }`
- **Chat/LLM layer (messageResponse util):** `{ type: 'SUCCESS'|'FAILED', message: '...', [data]?: {...} }` — `data` is omitted when empty

**Null Handling Notes:**
- `companyCity`, `companyAddress`: These fields come from raw SQL queries with `??` fallback — may be `null` or `undefined`. API consumers should handle with `??` or `||`.
- `logoUrl`, `avatarUrl`: May be `null` if not set.
- `deadline`: May be `null` (no deadline = job open indefinitely).
- `dateOfBirth`, `gender`, `headline`, `summary`, `linkedinUrl`, `address`, `city`: May be `null` in candidate profile.
- `rejectionReason`: May be `null` if company/job not rejected.
- `coverLetter`: May be `null` if not provided.

---

## 1. Authentication (Auth)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | `/api/auth/register` | None | — | Register new user (Candidate or Recruiter) |
| POST | `/api/auth/login` | None | — | Login, returns access + refresh tokens |
| POST | `/api/auth/refresh-token` | None | — | Get new access token from refresh token |
| POST | `/api/auth/logout` | Bearer Token | All | Invalidate refresh token |

### POST /api/auth/register

**Service:** `authService.register(data)`

**Request Body:**
```json
{
  "fullName": "Nguyễn Văn A",
  "email": "abc@gmail.com",
  "phone": "0901234567",
  "password": "123456",
  "companyName": "ABC Corp",
  "address": "HCM"
}
```
`companyName` and `address` are optional — include both to register as Recruiter, omit for Candidate.

**Validation** (in service layer):
| Field | Rule |
|-------|------|
| email | Regex `/^[a-zA-Z0-9.]+@gmail\.com$/` |
| password | Min 6 characters |
| phone | Regex `/^0\d{9}$/` (10 digits, starts with 0) |
| fullName | 2–50 chars, only letters + spaces, regex `/^[a-zA-ZÀ-ỹ\s]+$/` |
| companyName | Required if address provided |
| address | Required if companyName provided |

**Success (201):**
```json
{
  "status": "success",
  "data": {
    "id": "UUID",
    "email": "abc@gmail.com",
    "phone": "0901234567",
    "fullName": "Nguyễn Văn A",
    "role": "candidate",
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### POST /api/auth/login

**Service:** `authService.login({ email, password })`

**Request Body:**
```json
{ "email": "abc@gmail.com", "password": "123456" }
```

**Success (200):**
```json
{
  "status": "success",
  "data": {
    "id": "UUID",
    "email": "abc@gmail.com",
    "phone": "0901234567",
    "fullName": "Nguyễn Văn A",
    "role": "candidate",
    "avatarUrl": "uploads/avatars/...",
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### POST /api/auth/refresh-token

**Service:** `authService.refreshToken(refreshToken)`

**Request Body:** `{ "refreshToken": "eyJ..." }`

**Success (200):** `{ "accessToken": "eyJ..." }`

### POST /api/auth/logout

**Service:** `authService.logout(user)` — Sets `refreshToken = null` in DB.

**Headers:** `Authorization: Bearer <accessToken>`

**Success (200):** `{ "message": "Đăng xuất thành công" }`

**Errors:**
| Status | Description |
|--------|-------------|
| 400 | Validation error (missing fields, invalid format, duplicate email/phone) |
| 401 | Invalid credentials or missing/expired token |
| 403 | Invalid refresh token |
| 500 | Server error |

---

## 2. Candidate Module

All endpoints require `Authorization: Bearer <accessToken>` + Role: `CANDIDATE`.

### 2.1 Profile

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/candidate/profile` | Get own profile |
| PUT | `/api/candidate/profile` | Update profile fields |

**GET /api/candidate/profile**

**Service:** `candidateService.getProfile(userId)`

**Success (200):**
```json
{
  "status": "success",
  "data": {
    "fullName": "Nguyễn Văn A",
    "phone": "0901234567",
    "role": "candidate",
    "avatarUrl": "uploads/avatars/...",
    "headline": "Junior Developer",
    "summary": "I am a passionate developer...",
    "address": "123 Đường ABC",
    "city": "Hồ Chí Minh",
    "dateOfBirth": "2000-01-01T00:00:00.000Z",
    "gender": "male",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**PUT /api/candidate/profile**

**Service:** `candidateService.updateProfile(userId, data)`

**Request Body:**
```json
{
  "fullName": "Nguyễn Văn B",
  "phone": "0901234567",
  "headline": "Senior Developer",
  "summary": "Experienced developer...",
  "address": "456 Đường XYZ",
  "city": "Hà Nội",
  "dateOfBirth": "2000-01-01",
  "gender": "male",
  "linkedinUrl": "https://linkedin.com/in/..."
}
```
`linkedinUrl` is optional. Must start with `https://` if provided.

### 2.2 Avatar

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/api/avatar` | Upload or update avatar |
| DELETE | `/api/avatar` | Delete avatar |

**Service:** `avatarService.updateAvatar(userId, fileBuffer)` / `avatarService.deleteAvatar(userId)`

**Auth:** Bearer Token only (no role restriction — any authenticated user can manage their avatar).

**PUT /api/avatar** — Form-data: `avatar` (image file, max 5MB, JPG/PNG/WEBP). Processed with Sharp → 500×500 WebP 80%.

**Success (200):**
```json
{
  "status": "success",
  "message": "Cập nhật avatar thành công",
  "data": { "avatar_url": "uploads/avatars/..." }
}
```

**DELETE /api/avatar** — **Success (200):** `{ "status": "success", "message": "Xóa avatar thành công" }`

### 2.3 Portfolio (Experiences, Education, Skills)

**Service:** `PortfolioService` — all methods.

**Auth:** Bearer Token, Any authenticated user (no role restriction — uses `router.use(protect)` only).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/portfolio/experiences` | List experiences |
| POST | `/api/portfolio/experiences` | Add experience |
| GET | `/api/portfolio/educations` | List education |
| POST | `/api/portfolio/educations` | Add education |
| GET | `/api/portfolio/skills` | List skills |
| PUT | `/api/portfolio/skills` | Replace all skills (upsert) |

**POST /api/portfolio/experiences**

```json
{
  "company": "ABC Corp",
  "title": "Junior Developer",
  "startDate": "2023-01-01",
  "endDate": "2024-01-01",
  "description": "Worked on full-stack features..."
}
```

**Success (201):** `{ "message": "Thêm kinh nghiệm thành công", "data": { ... } }`

**POST /api/portfolio/educations**

```json
{
  "school": "Đại học ABC",
  "degree": "Cử nhân",
  "field": "Công nghệ thông tin",
  "startDate": "2020-01-01",
  "endDate": "2024-01-01"
}
```

**Success (201):** `{ "message": "Thêm học vấn thành công", "data": { ... } }`

**PUT /api/portfolio/skills**

```json
{ "skills": ["JavaScript", "Node.js", "React"] }
```

**Success (200):** `{ "status": "success", "message": "Cập nhật kỹ năng thành công", "data": [...] }`

Skills are upserted by name (case-insensitive unique). Old skills are replaced entirely.

### 2.4 Resumes (CV)

**Service:** `ResumeService` — all methods.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/resumes/upload` | Upload CV (PDF) |
| GET | `/api/resumes` | List own CVs |
| PATCH | `/api/resumes/:id/default` | Set CV as default |
| DELETE | `/api/resumes/:id` | Delete a CV |

**POST /api/resumes/upload** — Form-data: `cv` (PDF file, max 5MB, max 3 CVs per user). First CV is auto-set as default.

**Vector Processing (Background):** After upload, CV text is extracted via `pdfReader`, cleaned, chunked (300 chars, 50 overlap), and embedded via HuggingFace → stored in `resume_vectors` table with `vectorStatus: COMPLETED|FAILED`.

**Success (201):**
```json
{
  "status": "success",
  "message": "Upload CV thành công",
  "data": {
    "id": "UUID",
    "fileUrl": "uploads/resumes/...",
    "isDefault": true,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**GET /api/resumes** — Returns list of CVs ordered by `isDefault DESC`, `createdAt DESC`.

**Success (200):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "UUID",
      "title": "CV_NguyenVanA.pdf",
      "fileUrl": "uploads/resumes/...",
      "isDefault": true,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

**PATCH /api/resumes/:id/default** — **Success (200):** `{ "status": "success", "message": "Đặt CV mặc định thành công", "data": {...} }`
**DELETE /api/resumes/:id** — **Success (200):** `{ "status": "success", "message": "Xóa CV thành công" }`

### 2.5 Applications

**Service:** `ApplicationService` — all methods.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/applications` | Apply for a job |
| GET | `/api/applications` | List own applications (paginated) |
| GET | `/api/applications/:id` | Application detail |
| DELETE | `/api/applications/:id` | Withdraw application (soft delete, only if `submitted`) |
| DELETE | `/api/applications/:id/rejected` | Delete rejected application (soft delete) |

**POST /api/applications** — `ApplicationService.applyJob(userId, { jobId, resumeId?, coverLetter? })`

`resumeId` is optional (uses default CV if omitted). `coverLetter` is optional.

**Validation:** Job must be `approved` + `deadline` not expired. Duplicate application check (userId + jobId). Also stores user's `fullName`, `email`, `phone` and job's `companyId` on the application record.

**Success (201):**
```json
{
  "message": "Nộp đơn ứng tuyển thành công!",
  "data": {
    "id": "UUID",
    "userId": "UUID",
    "jobId": "UUID",
    "companyId": "UUID",
    "fullName": "Nguyễn Văn A",
    "email": "abc@gmail.com",
    "phone": "0901234567",
    "resumeUrl": "uploads/resumes/...",
    "coverLetter": null,
    "status": "submitted",
    "isDeleted": false,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**GET /api/applications** — Query: `?status=submitted&page=1&limit=10`

**Success (200):**
```json
{
  "status": "success",
  "count": 1,
  "data": {
    "total_items": 1,
    "total_pages": 1,
    "current_page": 1,
    "applications": [{
      "id": "UUID",
      "status": "submitted",
      "coverLetter": null,
      "resumeUrl": "uploads/resumes/...",
      "appliedAt": "2025-01-01T00:00:00.000Z",
      "job": {
        "id": "UUID",
        "title": "NodeJS Developer",
        "location": "HCM",
        "jobType": "Full-time",
        "salaryMin": 1000,
        "salaryMax": 2000,
        "deadline": "2026-12-31T00:00:00.000Z",
        "company": { "name": "ABC Corp", "logoUrl": "uploads/logos/..." }
      }
    }]
  }
}
```

**GET /api/applications/:id** — `ApplicationService.getApplicationDetail(userId, applicationId)`

**DELETE /api/applications/:id** — Only allowed when `status === 'submitted'`. Soft-deletes via `isDeleted: true`.
**DELETE /api/applications/:id/rejected** — Only allowed when `status === 'rejected'`.

### 2.6 Bookmarks

**Service:** `BookmarkService` — all methods.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bookmarks` | List bookmarked jobs (paginated) |
| POST | `/api/bookmarks/:jobId` | Toggle bookmark (save/unsave) |

**POST /api/bookmarks/:jobId** — Toggle. Returns:
```json
{ "bookmarked": true, "message": "Đã lưu tin tuyển dụng." }
```
or
```json
{ "bookmarked": false, "message": "Đã bỏ lưu tin tuyển dụng." }
```

**GET /api/bookmarks** — `BookmarkService.getBookmarks(userId, { limit, page })`

```json
{
  "total_items": 5,
  "total_pages": 1,
  "current_page": 1,
  "bookmarks": [{
    "bookmarkId": "UUID",
    "savedAt": "2025-01-01T00:00:00.000Z",
    "job": {
      "id": "UUID",
      "title": "NodeJS Developer",
      "location": "HCM",
      "jobType": "Full-time",
      "salaryMin": 1000,
      "salaryMax": 2000,
      "deadline": "2026-12-31T00:00:00.000Z",
      "status": "approved",
      "company": { "name": "ABC Corp", "logoUrl": "uploads/logos/...", "city": "Hồ Chí Minh" }
    }
  }]
}
```

### 2.7 Job Suggestions (Skill-based Matching)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/suggestions?limit=10` | Skill-based job suggestions |

**Auth:** Bearer Token, No Role restriction (uses `userId` from token to find candidate skills).

**Service:** `JobSuggestionService.getJobSuggestions(userId, limit)`

**Algorithm:**
1. Fetch candidate's skills from `candidate_skills`
2. Exclude already-applied jobs
3. If no skills → return latest approved jobs (sorted by `createdAt DESC`)
4. If skills exist → find jobs with matching skills, compute `matchPercent` = `(matchedSkillCount / candidateSkillCount) × 100`, sort by match count DESC
5. Limit: max 50, default 10

**Success (200):**
```json
{
  "status": "success",
  "count": 5,
  "data": [
    {
      "id": "UUID",
      "title": "NodeJS Developer",
      "location": "HCM",
      "jobType": "Full-time",
      "jobLevel": "Junior",
      "benefits": "...",
      "description": "...",
      "requirements": "...",
      "skills": [{ "id": "uuid", "name": "NodeJS" }],
      "salaryMin": 1000,
      "salaryMax": 2000,
      "deadline": "2026-12-31T00:00:00.000Z",
      "company": { "name": "ABC Corp", "logoUrl": "uploads/logos/...", "city": "HCM" },
      "matchedSkills": ["NodeJS"],
      "matchCount": 1,
      "matchPercent": 50
    }
  ]
}
```

### 2.8 Job Chat & Vector Search (AI Assistant — Gemini-powered)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Ask a question about jobs (RAG-based) |
| GET | `/api/chat-history` | Get chat history |
| GET | `/api/public/job-suggestions` | Vector-based job search by filters (public, no auth) |

**Auth:** Bearer Token, Role: `CANDIDATE` (for chat and chat-history). The `/api/public/job-suggestions` endpoint requires no auth (public).

**Response Format:**
The AI-driven endpoints return a standard response object. For a successful chat response, the structure is different from what is stored in the database.

---

#### POST /api/chat/chat

**Service:** `chat.services.js` → `chat(question, userId)`

**Controller:** `chat.controller.js` → `chat` — stores Q&A in the `userChat` table on success.

**RAG Flow (Retrieval-Augmented Generation):**
The entire flow, from classification to final response generation, is handled by Google's Gemini model.
1.  Fetch the last 5 chat history entries from the last 24 hours to provide context.
2.  The **`gemini-3.1-flash-lite`** model classifies the user's question into a **group** (1–6) to determine intent, also extracting key entities.
    -   **Group 1 (JOB_SEARCH):** General job search → `_handleJobSearch()`
    -   **Group 2 (CV_MATCH):** Search for jobs based on the candidate's default CV → `_handleJobSearchByCV()`
    -   **Group 3 (COMPARISON):** Compare multiple entities (jobs, companies, or a CV against a job) → `_handleComparison()`
    -   **Group 4 (COMPANY_RESEARCH):** Research specific information about a company or job → `_handleResearch()`
    -   **Group 5 (GREETING):** Handle general greetings → `_handleGreeting()`
    -   **Group 6 (OTHER):** Handle questions outside the defined scopes.
3.  Each handler function (`_handle...`) follows this process:
    -   It may convert the question to a **vector embedding** using the HuggingFace API (`paraphrase-multilingual-MiniLM-L12-v2`, 384-dim).
    -   It performs a **semantic search** on the `job_vectors` or `resume_vectors` tables using the `pgvector` `<=>` cosine similarity operator with a `MIN_SIMILARITY_SCORE` (default 0.3).
    -   It packages the retrieved data and the original user question into a detailed prompt.
    -   It sends the final prompt to **`gemini-3.1-flash-lite`** to generate a helpful, conversational answer in Vietnamese.

**Request Body:**
```json
{ "question": "Tôi muốn tìm việc làm NodeJS ở HCM" }
```

**Live Success Response (200):**
The live response from the endpoint contains the template ID in the `message` field and the actual response object in the `data` field.

```json
{
  "type": "SUCCESS",
  "message": 2,
  "data": {
    "message": "Xin chào! Tôi là trợ lý ảo của hệ thống tuyển dụng JobConnect. Tôi rất sẵn lòng hỗ trợ bạn tìm kiếm thông tin về việc làm hoặc giải đáp các thắc mắc về hệ thống của chúng tôi. Tôi có thể giúp gì cho bạn hôm nay?"
  }
}
```
*Note: The frontend client receives the response object directly in the `data` field. The `message` field simply indicates which `promptTemplate` ID was used.*

**Error Response:**
```json
{
  "type": "FAILED",
  "message": "Xin lỗi, tôi không tìm thấy thông tin nào liên quan đến câu hỏi của bạn."
}
```

---

#### GET /api/chat-history/chat-history

**Service:** `chat.services.js` → `history(userId)`

**Controller:** `chat.controller.js` → `chatHistory`

Returns all past Q&A sessions for the authenticated candidate (ordered by `createdAt DESC`).

**Success (200):**
The `answer` field in the history contains the **stringified JSON** of the `data` object from the original response. The `template` field stores the template ID.

```json
{
    "type": "SUCCESS",
    "message": "Lịch sử chat của bạn",
    "data": {
        "history": [
            {
                "id": "UUID",
                "question": "Chào bạn",
                "answer": "{\"message\":\"Xin chào! Tôi là trợ lý ảo của hệ thống tuyển dụng JobConnect. Tôi rất sẵn lòng hỗ trợ bạn tìm kiếm thông tin về việc làm hoặc giải đáp các thắc mắc về hệ thống của chúng tôi. Tôi có thể giúp gì cho bạn hôm nay?\"}",
                "template": 2,
                "createdAt": "2026-05-18T05:27:01.026Z"
            }
        ],
        "isFrozen": false
    }
}
```

---

#### GET /api/public/job-suggestions

**Service:** `chat.services.js` → `getJobSuggestions(userId, filters)` — `userId` is accepted but not used (public endpoint).

**Controller:** `chat.controller.js` → `getJobSuggestions`

**Auth:** None (public). No `Authorization` header required.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| keyword | string | No | Search keyword |
| location | string | No | Job location |
| jobType | string | No | Full-time, Part-time, Contract, Internship |
| jobLevel | string | No | Intern, Fresher, Junior, Middle, Senior, Lead, Manager |
| salary | string | No | Minimum salary filter |

**Flow:**
1.  Build a prompt with user-provided filters.
2.  The **`gemini-3.1-flash-lite`** model refines this into an optimized search query.
3.  The refined query is cleaned, standardized, and embedded via the HuggingFace API.
4.  The resulting embedding is used to perform a semantic search on the `job_vectors` table (cosine similarity, threshold `MIN_SIMILARITY_SCORE` of 0.3).
5.  Full job details are fetched for the top matching results.
6.  The final list is returned in a standard response format.

**Success (200):**
```json
{
  "suggestions": {
    "type": "SUCCESS",
    "message": "Đây là những công việc phù hợp với yêu cầu của bạn:",
    "data": {
      "jobs": [
        {
          "id": "UUID",
          "title": "NodeJS Developer",
          "location": "HCM",
          "jobType": "Full-time",
          "jobLevel": "Junior",
          "benefits": "...",
          "description": "...",
          "requirements": "...",
          "skills": [{ "id": "uuid", "skill": { "id": "uuid", "name": "NodeJS" } }],
          "salaryMin": 1000,
          "salaryMax": 2000,
          "deadline": "2026-12-31T00:00:00.000Z",
          "company": {
            "id": "UUID",
            "name": "ABC Corp",
            "logoUrl": "uploads/logos/...",
            "city": "HCM",
            "address": "123 Street"
          }
        }
      ]
    }
  }
}
```

**Error (200 — within the `suggestions` object):**
```json
{
  "suggestions": {
    "type": "FAILED",
    "message": "Xin lỗi, tôi không tìm thấy công việc nào phù hợp với yêu cầu của bạn..."
  }
}
```

---

## 3. Recruiter Module

All endpoints require `Authorization: Bearer <accessToken>` + Role: `RECRUITER`.

### 3.1 Company Profile

**Service:** `EmployerService` — all methods.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/employer/profile` | Get company profile |
| PUT | `/api/employer/profile` | Update or create company profile |
| PUT | `/api/employer/logo` | Upload company logo |
| DELETE | `/api/employer/logo` | Delete company logo |

**GET /api/employer/profile** — `EmployerService.getMyCompany(userId)`

**Success (200):**
```json
{
  "status": "success",
  "data": {
    "id": "UUID",
    "name": "ABC Corp",
    "description": "A leading tech company...",
    "website": "https://abccorp.com",
    "logoUrl": "uploads/logos/...",
    "address": "123 Đường ABC",
    "city": "Hồ Chí Minh",
    "size": "50-100",
    "status": "approved",
    "rejectionReason": null,
    "recruiter": {
      "fullName": "Nguyễn Văn A",
      "email": "admin@abccorp.com",
      "phone": "0901234567",
      "avatarUrl": "uploads/avatars/..."
    }
  }
}
```

**PUT /api/employer/profile** — `EmployerService.updateCompany(userId, data)`

If company doesn't exist → creates with `status: 'pending'`. If exists → updates with `status: 'pending'` (resets `rejectionReason`).

```json
{
  "name": "ABC Corp",
  "description": "Updated description...",
  "website": "https://abccorp.com",
  "address": "456 Đường XYZ",
  "city": "Hà Nội",
  "size": "100-200"
}
```

**Success (200):**
```json
{
  "status": "success",
  "message": "Cập nhật hồ sơ công ty thành công! Đang chờ Admin duyệt lại.",
  "data": { "id": "UUID", "name": "ABC Corp", "status": "pending", ... }
}
```

**PUT /api/employer/logo** — Form-data: `logo` (image, max 5MB). Sharp → 300×300 WebP 80%.
**DELETE /api/employer/logo** — Deletes logo file + sets `logoUrl = null` in DB.

### 3.2 Job Management

**Service:** `JobManagementService` — all methods.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/employer/jobs` | Post a new job (status: pending) |
| GET | `/api/employer/jobs` | List own jobs (paginated) |
| GET | `/api/employer/jobs/:id` | Get job detail |
| PUT | `/api/employer/jobs/:id` | Update job (resets to pending if not paused) |
| PATCH | `/api/employer/jobs/:id/toggle-pause` | Toggle pause/resume |
| DELETE | `/api/employer/jobs/:id` | Delete own job |

**DELETE /api/employer/jobs/:id** — **Success (200):** `{ "message": "Xóa tin tuyển dụng thành công." }`

#### POST /api/employer/jobs

**Service:** `JobManagementService.createJob(userId, data)` — Requires company `status === 'approved'`.

**Note:** `description`, `requirements`, `benefits`, `salaryMin`, `salaryMax`, `location`, `jobType`, `jobLevel`, `deadline`, `skills` are all optional fields (nullable). Only `title` is required.

**Request Body:**
```json
{
  "title": "Tuyển NodeJS Developer",
  "description": "We are looking for...",
  "requirements": "3+ years experience...",
  "benefits": "Salary, healthcare...",
  "salaryMin": 1000,
  "salaryMax": 2000,
  "location": "Hồ Chí Minh",
  "jobType": "Full-time",
  "jobLevel": "Junior",
  "deadline": "2026-12-31",
  "skills": ["NodeJS", "Express", "PostgreSQL"]
}
```

**Vector Processing (Background):** Job description is cleaned, chunked, embedded, and stored in `job_vectors` table (fires via `setImmediate`, not awaited). `vectorStatus` tracks: `PENDING` → `COMPLETED`|`FAILED`.

**Success (201):**
```json
{
  "message": "Đăng tin tuyển dụng thành công! Đang chờ Admin duyệt.",
  "data": {
    "id": "UUID",
    "title": "Tuyển NodeJS Developer",
    "status": "pending",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**PUT /api/employer/jobs/:id** — Resets status to `pending` (unless currently `paused`).

**Success (200):**
```json
{
  "message": "Cập nhật tin tuyển dụng thành công! Đang chờ duyệt lại.",
  "data": { "id": "UUID", "title": "...", "status": "pending", ... }
}
```

#### GET /api/employer/jobs

**Service:** `JobManagementService.getMyJobs(userId, { status?, page?, limit? })`

Query: `?status=pending|approved|rejected|paused&page=1&limit=10`

**Success (200):**
```json
{
  "status": "success",
  "data": {
    "total_items": 10,
    "total_pages": 1,
    "current_page": 1,
    "jobs": [
    {
      "id": "UUID",
      "companyId": "UUID",
      "title": "NodeJS Developer",
      "description": "...",
      "requirements": "...",
      "benefits": "...",
      "salaryMin": 1000,
      "salaryMax": 2000,
      "location": "HCM",
      "jobType": "Full-time",
      "jobLevel": "Junior",
      "status": "pending",
      "rejectionReason": null,
      "deadline": "2026-12-31T00:00:00.000Z",
      "viewsCount": 0,
      "vectorStatus": "PENDING",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z",
      "skills": [{ "id": "uuid", "name": "NodeJS" }]
    }
  ]
  }
}
```

#### PATCH /api/employer/jobs/:id/toggle-pause

**Service:** `JobManagementService.togglePauseJob(userId, jobId)`

Toggles: `approved` ↔ `paused`. Not allowed if `pending` or `rejected`.

**Success (200):**
```json
{ "status": "paused", "message": "Đã tạm dừng tin tuyển dụng." }
```
or
```json
{ "status": "approved", "message": "Đã mở lại tin tuyển dụng." }
```

### 3.3 Applicant Management

**Service:** `ApplicantService` — all methods.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/employer/applicants` | List all applicants across all jobs |
| GET | `/api/employer/applicants/:applicationId` | Application detail for recruiter |
| GET | `/api/employer/applicants/:applicationId/cv` | View/download CV PDF (query: `?mode=view\|download`) |
| PATCH | `/api/employer/applicants/:applicationId/status` | Update application status |
| DELETE | `/api/employer/applicants/:applicationId` | Soft-delete an application |

**GET /api/employer/applicants** — `ApplicantService.getAllApplicants(userId, { status?, page?, limit? })`

Query: `?status=submitted|under_review|interview|accepted|rejected&page=1&limit=10`

**Success (200):**
```json
{
  "total_items": 10,
  "total_pages": 1,
  "current_page": 1,
  "applications": [
    {
      "applicationId": "UUID",
      "status": "submitted",
      "resumeUrl": "uploads/resumes/...",
      "appliedAt": "2025-01-01T00:00:00.000Z",
      "job": { "id": "UUID", "title": "NodeJS Developer" },
      "candidate": {
        "id": "UUID",
        "fullName": "Nguyễn Văn A",
        "email": "abc@gmail.com",
        "phone": "0901234567",
        "avatarUrl": null,
        "candidateProfile": {
          "headline": "Junior Developer",
          "summary": "...",
          "experiences": [...],
          "educations": [...],
          "skills": [{ "id": "uuid", "name": "NodeJS" }]
        }
      }
    }
  ]
}
```

**GET /api/employer/applicants/:applicationId** — `ApplicantService.getApplicationDetail(userId, applicationId)`

Returns full detail including `coverLetter`, `job` info, `candidate` info with portfolio.

**GET /api/employer/applicants/:applicationId/cv?mode=view|download** — `ApplicantService.getCvFile(userId, applicationId, mode)`

Returns PDF file inline (`view`) or as attachment (`download`). Handles both local file paths and remote URLs.

**PATCH /api/employer/applicants/:applicationId/status**

**Service:** `ApplicantService.updateApplicationStatus(userId, applicationId, status)` — `note` is accepted in the request body but is not persisted to the database (service does not use it).

**Status Transitions:**
```
submitted    → under_review | rejected
under_review → interview     | rejected
interview    → accepted      | rejected
accepted     → (terminal)
rejected     → (terminal)
```

**Request Body:**
```json
{
  "status": "under_review",
  "note": "Optional note about the decision"
}
```

**DELETE /api/employer/applicants/:applicationId** — `ApplicantService.deleteApplication(userId, applicationId)`

Soft-deletes the application via `isDeleted: true`.

**Success (200):**
```json
{ "message": "Xóa đơn ứng tuyển thành công." }
```

### 3.4 Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/employer/dashboard` | Company statistics |

**Service:** `DashboardService.getDashboard(userId)`

**Success (200):**
```json
{
  "status": "success",
  "data": {
    "companyName": "ABC Corp",
    "companyStatus": "approved",
    "jobs": { "total": 10, "approved": 8, "pending": 1, "rejected": 1, "paused": 0 },
    "applications": {
      "total": 50,
      "submitted": 30,
      "under_review": 10,
      "interview": 5,
      "accepted": 3,
      "rejected": 2
    },
    "successRate": "6%",
    "recentApplications": [
      {
        "id": "UUID",
        "status": "submitted",
        "appliedAt": "2025-01-01T00:00:00.000Z",
        "candidate": { "fullName": "...", "email": "...", "avatarUrl": null },
        "jobTitle": "NodeJS Developer"
      }
    ]
  }
}
```

---

## 4. Public Endpoints (No Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/public/jobs/:id` | View job detail (approved only) |
| GET | `/api/public/companies/:id` | View company detail (approved only) |
| GET | `/api/public/job-suggestions` | Vector-based job search by filters (see §2.8 for details) |
| GET | `/api/search-jobs/search-jobs` | Search jobs with filters |

### GET /api/public/jobs/:id

**Service:** `PublicService.getJobDetail(jobId)` — Only returns jobs with `status: 'approved'`.

**Success (200):**
```json
{
  "status": "success",
  "data": {
    "id": "UUID",
    "title": "NodeJS Developer",
    "description": "...",
    "requirements": "...",
    "benefits": "...",
    "salaryMin": 1000,
    "salaryMax": 2000,
    "location": "HCM",
    "jobType": "Full-time",
    "jobLevel": "Junior",
    "deadline": "2026-12-31T00:00:00.000Z",
    "status": "approved",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "company": {
      "id": "UUID",
      "name": "ABC Corp",
      "logoUrl": "uploads/logos/...",
      "city": "HCM",
      "address": "123 Street",
      "website": "https://...",
      "size": "50-100",
      "description": "..."
    },
    "skills": [{ "id": "uuid", "name": "NodeJS" }]
  }
}
```

### GET /api/public/companies/:id

**Service:** `PublicService.getCompanyDetail(companyId)` — Only returns companies with `status: 'approved'`. Includes `active_jobs` (approved jobs only).

```json
{
  "status": "success",
  "data": {
    "company": {
      "id": "UUID",
      "name": "ABC Corp",
      "description": "...",
      "website": "https://...",
      "logoUrl": "uploads/logos/...",
      "address": "123 Street",
      "city": "HCM",
      "size": "50-100",
      "createdAt": "2025-01-01T00:00:00.000Z"
    },
    "active_jobs": [
      {
        "id": "UUID",
        "title": "NodeJS Developer",
        "location": "HCM",
        "salaryMin": 1000,
        "salaryMax": 2000,
        "jobType": "Full-time",
        "jobLevel": "Junior",
        "deadline": "2026-12-31T00:00:00.000Z",
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

**Note:** `active_jobs` includes `jobLevel` field (returned by `PublicService.getCompanyDetail`).

### GET /api/search-jobs/search-jobs

**Service:** `Search_jobService.searchJobs(filters)`

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| keyword | string | No | Searches title, company name, skill name (case-insensitive `contains`) |
| location | string | No | Filters by job location, company city, company address (case-insensitive) |
| jobType | string | No | Exact match (Full-time, Part-time, Contract, Internship) |
| jobLevel | string | No | Exact match (Intern, Fresher, Junior, Middle, Senior, Lead, Manager) |
| salary | number | No | Minimum salary filter (checks `salaryMax >= value`) |
| page | number | No | Default 1 |
| limit | number | No | Default 10, max 50 |

**Behavior:**
- Only returns `status: 'approved'` jobs with non-expired deadlines (or no deadline)
- Ordered by `createdAt: 'desc'`
- Uses **string matching** (not vector/semantic) via Prisma `contains` (case-insensitive)

**Success (200):**
```json
{
  "status": "success",
  "message": "Tìm kiếm việc làm thành công",
  "data": {
    "total_items": 100,
    "total_pages": 10,
    "current_page": 1,
    "jobs": [
      {
        "id": "UUID",
        "title": "NodeJS Developer",
        "location": "Hồ Chí Minh",
        "jobType": "Full-time",
        "jobLevel": "Junior",
        "benefits": "...",
        "description": "...",
        "requirements": "...",
        "skills": [{ "id": "uuid", "name": "NodeJS" }],
        "salaryMin": 1000,
        "salaryMax": 2000,
        "deadline": "2026-12-31T00:00:00.000Z",
        "company": {
          "id": "UUID",
          "name": "ABC Corp",
          "logoUrl": "uploads/logos/...",
          "city": "Hồ Chí Minh",
          "address": "123 Street"
        }
      }
    ]
  }
}
```

---

## 5. Admin Module

All endpoints require `Authorization: Bearer <accessToken>` + Role: `ADMIN`.

### 5.1 User Management

**Service:** `adminService` — all methods.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List all users (paginated) |
| PATCH | `/api/admin/users/:id/toggle-lock` | Toggle lock/unlock user |
| DELETE | `/api/admin/users/:id` | Delete user (not Admins) |

**GET /api/admin/users** — Query: `?role=candidate|recruiter&isActive=true|false&keyword=...&page=1&limit=10`

Query param `is_active` (snake_case) is accepted from query string (converted to camelCase in service).

**Success (200):**
```json
{
  "status": "success",
  "data": {
    "total_items": 100,
    "total_pages": 10,
    "current_page": 1,
    "users": [
      {
        "id": "UUID",
        "email": "abc@gmail.com",
        "fullName": "Nguyễn Văn A",
        "role": "candidate",
        "phone": "0901234567",
        "avatarUrl": null,
        "isActive": true,
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

**PATCH /api/admin/users/:id/toggle-lock** — `adminService.toggleLockUser(id)`

Cannot lock admin accounts. Toggles `isActive` field.

**Success (200):**
```json
{
  "id": "UUID",
  "fullName": "Nguyễn Văn A",
  "email": "abc@gmail.com",
  "role": "recruiter",
  "isActive": false,
  "message": "Đã khóa tài khoản."
}
```

**DELETE /api/admin/users/:id** — `adminService.deleteUser(id)`
Cannot delete admin accounts.

**Success (200):** `{ "message": "Đã xóa user thành công" }`

### 5.2 Company Review

**Service:** `AdminCompanyService` — all methods.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/companies` | List all companies |
| GET | `/api/admin/companies/pending` | List pending companies |
| PATCH | `/api/admin/companies/:id/review` | Approve or reject company |

**PATCH /api/admin/companies/:id/review** — `AdminCompanyService.reviewCompany(companyId, action, reason)`

**Request Body:**
```json
{
  "action": "approved",
  "reason": "Valid business documents"
}
```
`action`: `approved` | `rejected` (required). `reason` required when `action = 'rejected'`. Returns **409 Conflict** if company already processed (status not `pending`).

**Success (200):**
```json
{
  "message": "Đã duyệt công ty thành công.",
  "data": {
    "id": "UUID",
    "name": "ABC Corp",
    "status": "approved",
    "rejectionReason": null,
    "user": { "fullName": "...", "email": "..." }
  }
}
```

**Errors:**
| Status | Condition |
|--------|-----------|
| 400 | Invalid action or missing rejection reason |
| 404 | Company not found |
| 409 | Company already processed |
| 500 | Server error |

### 5.3 Job Review

**Service:** `AdminJobService` — all methods.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/jobs` | List all jobs (paginated, filterable) |
| GET | `/api/admin/jobs/pending` | List pending jobs |
| GET | `/api/admin/jobs/:id` | Job detail for review |
| PATCH | `/api/admin/jobs/:id/review` | Approve or reject job |
| DELETE | `/api/admin/jobs/:id` | Delete violating job |

**PATCH /api/admin/jobs/:id/review** — `AdminJobService.reviewJob(jobId, action, reason)`

Returns **409 Conflict** if job already processed.

```json
{
  "action": "approved",
  "reason": "Valid job posting"
}
```

**Success (200):**
```json
{
  "message": "Đã duyệt tin tuyển dụng thành công.",
  "data": { ... }
}
```
or
```json
{
  "message": "Đã từ chối tin tuyển dụng.",
  "data": { ... }
}
```

**DELETE /api/admin/jobs/:id** — Hard-deletes a job (even if approved). **Success (200):** `{ "message": "Xóa tin tuyển dụng vi phạm thành công." }`

**Errors:**
| Status | Condition |
|--------|-----------|
| 400 | Invalid action or missing rejection reason |
| 404 | Job not found |
| 409 | Job already processed |
| 500 | Server error |

### 5.4 Reports & Statistics

**Service:** `AdminReportService` — all methods.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/reports/overview` | System-wide statistics |
| GET | `/api/admin/reports/users/growth` | User growth (12 months) |
| GET | `/api/admin/reports/applications/monthly` | Applications by month (12 months) |
| GET | `/api/admin/reports/jobs/by-type` | Jobs grouped by type |
| GET | `/api/admin/reports/jobs/by-level` | Jobs grouped by level |

**GET /api/admin/reports/overview** — `AdminReportService.getSystemStats()`

**Success (200):** All report endpoints return `{ status: 'success', data: ... }`.

```json
{
  "status": "success",
  "data": {
    "users": { "total": 1000, "candidates": 800, "recruiters": 200 },
    "companies": { "total": 150, "approved": 120, "pending": 30 },
    "jobs": { "total": 500, "approved": 400, "pending": 50, "rejected": 50 },
    "applications": { "total": 2000, "accepted": 300, "success_rate": "25%" }
  }
}
```

**GET /api/admin/reports/users/growth** — Raw SQL: `DATE_TRUNC('month', created_at)` grouping by role, 12 months.

```json
{
  "status": "success",
  "data": [
    { "month": "2025-01", "candidate": 50, "recruiter": 10, "total": 60 },
    { "month": "2025-02", "candidate": 45, "recruiter": 8, "total": 53 }
  ]
}
```

**GET /api/admin/reports/applications/monthly** — Raw SQL: `DATE_TRUNC('month', created_at)` grouping by status, 12 months.

```json
{
  "status": "success",
  "data": [
    { "month": "2025-01", "total": 30, "accepted": 5, "rejected": 3 },
    { "month": "2025-02", "total": 25, "accepted": 4, "rejected": 2 }
  ]
}
```

**GET /api/admin/reports/jobs/by-type** — `prisma.job.groupBy({ by: ['jobType'], where: { status: 'approved' } })`

```json
{
  "status": "success",
  "data": [
    { "jobType": "Full-time", "count": 200 },
    { "jobType": "Part-time", "count": 50 }
  ]
}
```

**GET /api/admin/reports/jobs/by-level** — `prisma.job.groupBy({ by: ['jobLevel'], where: { status: 'approved' } })`

```json
{
  "status": "success",
  "data": [
    { "jobLevel": "Junior", "count": 80 },
    { "jobLevel": "Senior", "count": 60 }
  ]
}
```

---

## 6. Error Codes

| Status | Meaning | Example Message |
|--------|---------|-----------------|
| 200 / 201 | Success | `"Đăng nhập thành công"`, `"Nộp đơn ứng tuyển thành công!"` |
| 400 | Bad Request — missing/invalid fields | `"Email, password, họ tên và số điện thoại là bắt buộc"`, `"Tiêu đề công việc không được để trống."` |
| 401 | Unauthorized — no/invalid token | `"Email hoặc mật khẩu không đúng"`, `"Token không hợp lệ hoặc đã hết hạn."` |
| 403 | Forbidden — insufficient role | `"Bạn không có quyền truy cập"`, `"Không thể xóa tài khoản Admin."` |
| 404 | Not Found | `"Không tìm thấy đơn ứng tuyển."`, `"Công việc không tồn tại hoặc đã đóng tuyển."` |
| 409 | Conflict | `"Công ty này đã được xử lý"`, `"Tin tuyển dụng này đã được xử lý"` |
| 500 | Server Error | `"Lỗi server khi tìm kiếm việc làm"` |

---

## 7. RAG / Vector Search Architecture

### 7.1 Data Flow

```
[JOB CREATED]                                      [RESUME UPLOADED]
      |                                                   |
      v                                                   v
  cleaningJob(job)                                  pdfReader(file) → raw text
      |                                                   |
      v                                                   v
  textStandardization()                             cleaningText()
      |                                                   |
      v                                                   v
  textChunking() → 300-char chunks, 50 overlap     textStandardization()
      |                                                   |
      v                                                   v
  textEmbedding() → 384-dim vector                  textChunking()
      |                                                   |
      v                                                   v
  job_vectors table                                textEmbedding() → 384-dim vector
      |                                                   |
      v                                                   v
  vectorStatus: COMPLETED                          resume_vectors table
```

### 7.2 Embedding Model

- **Model:** `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
- **Provider:** HuggingFace Inference API (`@huggingface/inference`)
- **Vector Dimension:** 384
- **Retry:** 3 attempts with exponential backoff
- **Similarity Metric:** Cosine similarity via `<=>` operator in pgvector
- **Threshold (MIN_SIMILARITY_SCORE):** 0.3 (configurable via `.env`)

### 7.3 Database Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `job_vectors` | Job description embeddings | `job_id`, `content`, `embedding` (vector(384)) |
| `resume_vectors` | Resume PDF embeddings | `user_id`, `resume_id`, `content`, `embedding` (vector(384)) |
| `user_chat` | Chat Q&A history with dynamic template responses | `id` (UUID), `user_id`, `question`, `answer` (stringified JSON), `template` (Integer — identifies the response structure format corresponding to the `promptTemplate` ID), `created_at` |

### 7.4 Similarity Search Queries

**Job Vector Search (raw SQL):**
```sql
SELECT DISTINCT ON (j.id)
    j.id, j.title, j.description,
    j.salary_min, j.salary_max, j.location, j.job_type,
    c.name AS companyName, c.address AS companyAddress, c.city AS companyCity,
    1 - (v.embedding <=> ${embedding}::vector) AS similarity
FROM jobs j
JOIN job_vectors v ON j.id = v.job_id
JOIN companies c ON j.company_id = c.id
WHERE 1 - (v.embedding <=> ${embedding}::vector) > ${MIN_SIMILARITY_SCORE}
ORDER BY j.id, similarity DESC
LIMIT 3;
```

**CV-vs-Job Cross Search:**
```sql
SELECT MAX(1 - (jv.embedding <=> rv.embedding)) AS similarity
FROM job_vectors jv
CROSS JOIN LATERAL unnest(${resumeEmbeddings}::vector[]) AS rv(embedding)
WHERE jv.job_id = j.id
```

### 7.5 Background Vector Processing

- **Job vectorization:** Fires `setImmediate` after job create/update — not awaited
- **Resume vectorization:** Fires `setImmediate` after upload — not awaited
- **Scheduler:** `vectorRetry.scheduler.js` runs every 30 min via `node-cron`, retries jobs/resumes with `vectorStatus: PENDING` or `FAILED` (batch size: 5 jobs, unlimited resumes)
- **Exports:** `setupVectorSchedule()`, `stopVectorSchedule()` (used in test cleanup)

---

## 8. Data Conventions

| Convention | Rule |
|------------|------|
| **IDs** | All UUID (`String @id @default(uuid()) @db.Uuid`) |
| **Request/Response** | camelCase for all fields (`fullName`, `jobType`, `salaryMin`) |
| **Database columns** | snake_case mapped via `@map("column_name")` in Prisma; **queries use camelCase** (`prisma.user.findMany({ where: { fullName: ... } })`) |
| **Job statuses** | `pending` → `approved` | `rejected`, also `paused` |
| **Application statuses** | `submitted` → `under_review` → `interview` → `accepted` | `rejected` |
| **Company statuses** | `pending` → `approved` | `rejected` |
| **Vector statuses** | `PENDING` → `PROCESSING` → `COMPLETED` | `FAILED` |
| **Soft delete** | Applications use `isDeleted: true` (not hard-deleted) |
| **Pagination** | All list endpoints: `{ total_items, total_pages, current_page, ...items[] }` |
| **Pagination limits** | Default `limit=10`, max `limit=50`, min `limit=1` |
| **Null handling** | `dateOfBirth`, `gender`, `headline`, `summary`, `linkedinUrl`, `logoUrl`, `avatarUrl`, `coverLetter`, `rejectionReason`, `deadline`, `companyCity`, `companyAddress` may all be `null` — consumers should use fallback (`??` / `||`) |
