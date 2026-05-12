# JobConnect API Documentation

Base URL: `http://localhost:3000`

All ID fields use **UUID** format (`String @id @default(uuid()) @db.Uuid` in Prisma).

---

## 1. Authentication (Auth)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | `/api/auth/register` | None | — | Register new user (Candidate or Recruiter) |
| POST | `/api/auth/login` | None | — | Login, returns access + refresh tokens |
| POST | `/api/auth/refresh-token` | None | — | Get new access token from refresh token |
| POST | `/api/auth/logout` | Bearer Token | All | Invalidate refresh token |

### POST /api/auth/register

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

**Request Body:**
```json
{
  "email": "abc@gmail.com",
  "password": "123456"
}
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

**Request Body:**
```json
{ "refreshToken": "eyJ..." }
```

**Success (200):** `{ "accessToken": "eyJ..." }`

### POST /api/auth/logout

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

**Success (200):**
```json
{
  "status": "success",
  "data": {
    "id": "UUID",
    "userId": "UUID",
    "fullName": "Nguyễn Văn A",
    "email": "abc@gmail.com",
    "phone": "0901234567",
    "role": "candidate",
    "avatarUrl": "uploads/avatars/...",
    "headline": "Junior Developer",
    "summary": "I am a passionate developer...",
    "address": "123 Đường ABC",
    "city": "Hồ Chí Minh",
    "dateOfBirth": "2000-01-01T00:00:00.000Z",
    "gender": "male",
    "linkedinUrl": "https://linkedin.com/in/...",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**PUT /api/candidate/profile**

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

### 2.2 Avatar

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/api/avatar` | Upload or update avatar |
| DELETE | `/api/avatar` | Delete avatar |

**PUT /api/avatar** — Form-data: `avatar` (image file, max 5MB, JPG/PNG/WEBP)

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

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/portfolio/experiences` | List experiences |
| POST | `/api/portfolio/experiences` | Add experience |
| GET | `/api/portfolio/educations` | List education |
| POST | `/api/portfolio/educations` | Add education |
| GET | `/api/portfolio/skills` | List skills |
| PUT | `/api/portfolio/skills` | Replace all skills |

**POST /api/portfolio/experiences**

**Request Body:**
```json
{
  "company": "ABC Corp",
  "title": "Junior Developer",
  "startDate": "2023-01-01",
  "endDate": "2024-01-01",
  "description": "Worked on full-stack features..."
}
```

**POST /api/portfolio/educations**

**Request Body:**
```json
{
  "school": "Đại học ABC",
  "degree": "Cử nhân",
  "field": "Công nghệ thông tin",
  "startDate": "2020-01-01",
  "endDate": "2024-01-01"
}
```

**PUT /api/portfolio/skills**

**Request Body:**
```json
{ "skills": ["JavaScript", "Node.js", "React"] }
```

### 2.4 Resumes (CV)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/resumes/upload` | Upload CV (PDF) |
| GET | `/api/resumes` | List own CVs |
| PATCH | `/api/resumes/:id/default` | Set CV as default |
| DELETE | `/api/resumes/:id` | Delete a CV |

**POST /api/resumes/upload** — Form-data: `cv` (PDF file, max 5MB, max 3 CVs per user)

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

**PATCH /api/resumes/:id/default** — **Success (200):** `{ "status": "success", "message": "Đặt CV mặc định thành công", "data": {...} }`

**DELETE /api/resumes/:id** — **Success (200):** `{ "status": "success", "message": "Xóa CV thành công" }`

### 2.5 Applications

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/applications` | Apply for a job |
| GET | `/api/applications` | List own applications |

**POST /api/applications**

**Request Body:**
```json
{
  "jobId": "UUID",
  "resumeId": "UUID",
  "coverLetter": "Tôi rất quan tâm đến vị trí này..."
}
```
`resumeId` is optional (uses default CV if omitted).

**Success (201):**
```json
{
  "message": "Nộp đơn ứng tuyển thành công!",
  "data": {
    "id": "UUID",
    "status": "submitted",
    "jobId": "UUID",
    "userId": "UUID",
    "resumeUrl": "uploads/resumes/...",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### 2.6 Bookmarks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bookmarks` | List bookmarked jobs |
| POST | `/api/bookmarks/:jobId` | Toggle bookmark (save/unsave) |

**POST /api/bookmarks/:jobId** — Toggle. Returns:
```json
{ "bookmarked": true, "message": "Đã lưu tin tuyển dụng." }
```
or
```json
{ "bookmarked": false, "message": "Đã bỏ lưu tin tuyển dụng." }
```

### 2.7 Job Suggestions (AI)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/suggestions?limit=10` | AI-suggested jobs based on resume vector matching |

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
      "salaryMin": 1000,
      "company": { ... },
      "skills": ["NodeJS", "Express"],
      "similarityScore": 0.92
    }
  ]
}
```

### 2.8 Job Chat (AI Assistant)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/chat` | Ask a question about jobs |
| GET | `/api/chat-history/chat-history` | Get chat history |

**Auth:** Bearer Token, Role: `CANDIDATE`

**POST /api/chat/chat**

**Request Body:**
```json
{ "question": "Tôi muốn tìm việc làm NodeJS ở HCM" }
```

**Success (200):**
```json
{ "ans": "Tôi tìm thấy một số công việc phù hợp..." }
```

**Implementation:** The backend communicates with a local **Qwen 2.5 3B** model via **Ollama** (`http://localhost:11434`). The flow:
1. User question is cleaned and standardized via text preprocessing pipeline
2. Question is converted to a vector embedding (HuggingFace Inference API)
3. Semantic search finds top 3 matching jobs via `pgvector` cosine similarity (`<=>` operator)
4. Job context is packed into a prompt sent to the local Ollama Qwen 2.5 3B model
5. Response is returned in Vietnamese

**GET /api/chat-history/chat-history** — Returns all prior Q&A for the user.

---

## 3. Recruiter Module

All endpoints require `Authorization: Bearer <accessToken>` + Role: `RECRUITER`.

### 3.1 Company Profile

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/employer/profile` | Get company profile |
| PUT | `/api/employer/profile` | Update company profile |
| PUT | `/api/employer/logo` | Upload company logo |
| DELETE | `/api/employer/logo` | Delete company logo |

**GET /api/employer/profile**

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

**PUT /api/employer/profile**

**Request Body:**
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

**PUT /api/employer/logo** — Form-data: `logo` (image, max 5MB). **DELETE /api/employer/logo** — no body.

### 3.2 Job Management

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/employer/jobs` | Post a new job (status: pending) |
| GET | `/api/employer/jobs?status=pending\|approved\|rejected\|paused` | List own jobs |
| PATCH | `/api/employer/jobs/:id/toggle-pause` | Toggle pause/resume |

**POST /api/employer/jobs**

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

**PATCH /api/employer/jobs/:id/toggle-pause** — Toggles `approved` ↔ `paused`.

### 3.3 Applicant Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/employer/applicants?status=submitted\|under_review\|interview\|accepted\|rejected` | List all applicants |
| GET | `/api/employer/applicants/:applicationId` | Application detail |
| GET | `/api/employer/applicants/:applicationId/cv?mode=view\|download` | View/download CV PDF |
| PATCH | `/api/employer/applicants/:applicationId/status` | Update application status |

**PATCH /api/employer/applicants/:applicationId/status**

**Request Body:**
```json
{
  "status": "under_review",
  "note": "Will schedule an interview"
}
```

Valid statuses: `submitted` → `under_review` → `interview` → `accepted`|`rejected`

### 3.4 Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/employer/dashboard` | Company statistics |

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
    "recentApplications": [ ... ]
  }
}
```

---

## 4. Public Endpoints

No authentication required.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/public/jobs/:id` | View job detail |
| GET | `/api/public/companies/:id` | View company detail |
| GET | `/api/search-jobs/search-jobs?keyword=...&location=...&jobType=...&jobLevel=...&salary=...&page=1&limit=10` | Search jobs |

**GET /api/search-jobs/search-jobs**

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| keyword | string | Search keyword (uses vector search, fallback to text search) |
| location | string | Filter by location |
| jobType | string | Filter by type (Full-time, Part-time, etc.) |
| jobLevel | string | Filter by level (Junior, Senior, etc.) |
| salary | number | Minimum salary filter |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 10, max: 50) |

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
        "salaryMin": 1000,
        "salaryMax": 2000,
        "company": { ... },
        "skills": ["NodeJS"],
        "similarityScore": 0.85
      }
    ]
  }
}
```

---

## 5. Admin Module

All endpoints require `Authorization: Bearer <accessToken>` + Role: `ADMIN`.

### 5.1 User Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users?role=candidate\|recruiter&isActive=true\|false&keyword=...&page=1&limit=10` | List all users |
| PATCH | `/api/admin/users/:id/toggle-lock` | Toggle lock/unlock user |
| DELETE | `/api/admin/users/:id` | Delete user (not Admins) |

### 5.2 Company Review

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/companies` | List all companies |
| GET | `/api/admin/companies/pending` | List pending companies |
| PATCH | `/api/admin/companies/:id/review` | Approve or reject company |

**PATCH /api/admin/companies/:id/review**

**Request Body:**
```json
{
  "action": "approved",
  "reason": "Valid business documents"
}
```
`action`: `approved` | `rejected` (required). `reason` required when `action = 'rejected'`.

### 5.3 Job Review

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/jobs?status=pending\|approved\|rejected\|paused` | List all jobs |
| GET | `/api/admin/jobs/pending` | List pending jobs |
| GET | `/api/admin/jobs/:id` | Job detail for review |
| PATCH | `/api/admin/jobs/:id/review` | Approve or reject job |
| DELETE | `/api/admin/jobs/:id` | Delete violating job |

**PATCH /api/admin/jobs/:id/review**

**Request Body:**
```json
{
  "action": "approved",
  "reason": "Valid job posting"
}
```

### 5.4 Reports & Statistics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/reports/overview` | System-wide statistics |
| GET | `/api/admin/reports/users/growth` | User growth (12 months) |
| GET | `/api/admin/reports/applications/monthly` | Applications by month (12 months) |
| GET | `/api/admin/reports/jobs/by-type` | Jobs grouped by type |
| GET | `/api/admin/reports/jobs/by-level` | Jobs grouped by level |

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

## 7. Chat / LLM Endpoints (AI Job Assistant)

**Auth:** Bearer Token, Role: `CANDIDATE`

### POST /api/chat/chat

Submit a natural-language question about jobs. The backend:
1. Cleans and standardizes the text (Vietnamese text preprocessing)
2. Generates a vector embedding via **HuggingFace Inference API**
3. Performs **semantic search** across `job_vectors` using `pgvector` (`<=>` cosine similarity, threshold > 0.4)
4. Packages the top 3 matching jobs as context
5. Sends the prompt to a local **Qwen 2.5 3B** model running on **Ollama** (`http://localhost:11434`)
6. Returns the model's response in Vietnamese

**Request Body:**
```json
{ "question": "Có việc làm NodeJS nào ở HCM không?" }
```

**Success (200):**
```json
{ "ans": "Tôi tìm thấy một số công việc NodeJS phù hợp tại Hồ Chí Minh..." }
```

### GET /api/chat-history/chat-history

Returns all past Q&A sessions for the authenticated candidate.

---

## 8. Data Conventions

- **IDs:** All UUID (`String @id @default(uuid()) @db.Uuid`)
- **Request/Response:** `camelCase` for all fields (`fullName`, `jobType`, `salaryMin`)
- **Database columns:** `snake_case` mapped via `@map("column_name")`
- **Job statuses:** `pending` → `approved` | `rejected`, also `paused`
- **Application statuses:** `submitted` → `under_review` → `interview` → `accepted` | `rejected`
- **Company statuses:** `pending` → `approved` | `rejected`
- **Vector search:** Uses `pgvector` extension with `job_vectors` and `resume_vectors` tables
