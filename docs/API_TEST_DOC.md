# Tài liệu Kiểm thử API (API Test Documentation) - JobConnect

Tài liệu này cung cấp hướng dẫn toàn diện để kiểm thử các API của hệ thống **JobConnect Recruitment System Backend**. Hệ thống sử dụng Express.js, PostgreSQL (thông qua Prisma schema management), tích hợp tìm kiếm ngữ nghĩa (pgvector + HuggingFace) và chatbot thông minh (Google Gemini).

---

## 1. Tổng quan & Thiết lập Môi trường Kiểm thử

### 1.1 Khởi chạy Server

Để chạy kiểm thử API, trước hết cần đảm bảo backend đang hoạt động.

```bash
# Di chuyển vào thư mục backend
cd backend

# Cài đặt các thư viện (nếu chưa)
npm install

# Đồng bộ cơ sở dữ liệu
npm run db:push

# Chạy server ở chế độ phát triển
npm run dev
```

Server mặc định sẽ chạy tại: `http://localhost:3000`

### 1.2 Kiểm tra dữ liệu trực tiếp (Prisma Studio)

Bạn có thể mở giao diện quản lý cơ sở dữ liệu trực quan bằng Prisma Studio:

```bash
npm run studio
```

Truy cập qua trình duyệt: `http://localhost:8888` để xem, tạo, sửa hoặc xóa dữ liệu trực tiếp trong PostgreSQL.

---

## 2. Kiểm thử Tự động với Jest (Integration Tests)

Dự án đã được cấu hình sẵn các kịch bản kiểm thử tích hợp (integration tests) bằng framework **Jest** và thư viện **Supertest**. Các file test nằm trong thư mục `tests/integration/`.

### 2.1 Cấu hình Kiểm thử

Các API liên quan đến trí tuệ nhân tạo (AI) như Chatbot RAG và tìm kiếm công việc bằng vector đã được mock (giả lập) hàm tạo vector để tránh gọi trực tiếp lên API HuggingFace / Gemini trong quá trình chạy test tự động:

```javascript
jest.mock("../../src/utils/preprocessing/textEmbedding", () => ({
  textEmbedding: jest.fn().mockResolvedValue(Array(384).fill(0.1)),
}));
```

### 2.2 Câu lệnh chạy Test

Chạy toàn bộ các kịch bản kiểm thử tích hợp:

```bash
npm run test
```

Chạy một file test cụ thể (Ví dụ: kiểm thử API Auth):

```bash
npx jest tests/integration/auth.test.js
```

---

## 3. Kịch bản Kiểm thử Thủ công (Manual Test Scenarios)

Dưới đây là danh sách các API chính và kịch bản test cụ thể (Mã trạng thái thành công và thất bại).

---

### 3.1 Nhóm API Xác thực (Authentication)

_Mọi vai trò (Candidate, Recruiter, Admin) đều bắt đầu tại đây._

#### Kịch bản 1: Đăng ký ứng viên mới (Candidate Register)

- **Endpoint:** `POST /api/auth/register`
- **Request Body (Candidate):**
  ```json
  {
    "fullName": "Nguyễn Văn A",
    "email": "candidate.test@gmail.com",
    "phone": "0901234567",
    "password": "password123"
  }
  ```
- **Kết quả mong đợi:**
  - **Hợp lệ (201 Created):** Trả về token và thông tin người dùng có `role: "candidate"`.
  - **Lỗi định dạng email (400 Bad Request):** Nhập email không hợp lệ (Ví dụ: `abc@gmail.com` nhưng regex chỉ chấp nhận đuôi `@gmail.com` chuẩn).
  - **Lỗi trùng lặp (400 Bad Request):** Đăng ký lại bằng email hoặc số điện thoại đã tồn tại trong hệ thống.
  - **Lỗi họ tên (400 Bad Request):** Tên chứa ký tự số hoặc ký tự đặc biệt, hoặc độ dài ngoài khoảng 2-50 ký tự.

#### Kịch bản 2: Đăng ký nhà tuyển dụng mới (Recruiter Register)

- **Endpoint:** `POST /api/auth/register`
- **Request Body (Recruiter):**
  ```json
  {
    "fullName": "Trần Thị B",
    "email": "recruiter.test@gmail.com",
    "phone": "0912345678",
    "password": "password123",
    "companyName": "Công ty Công nghệ ABC",
    "address": "Quận 1, TP. Hồ Chí Minh"
  }
  ```
- **Kết quả mong đợi:**
  - **Hợp lệ (201 Created):** Trả về token, tài khoản có `role: "recruiter"`, đồng thời tạo bản ghi hồ sơ công ty liên kết với tài khoản này.
  - **Thiếu thông tin công ty (400 Bad Request):** Chỉ gửi `companyName` mà bỏ trống `address` hoặc ngược lại.

#### Kịch bản 3: Đăng nhập (Login)

- **Endpoint:** `POST /api/auth/login`
- **Request Body:**
  ```json
  {
    "email": "candidate.test@gmail.com",
    "password": "password123"
  }
  ```
- **Kết quả mong đợi:**
  - **Hợp lệ (200 OK):** Trả về thông tin người dùng kèm theo `accessToken` (dùng để gửi trong Header Authorization cho các API cần bảo mật) và `refreshToken`.
  - **Sai mật khẩu hoặc email (401 Unauthorized):** Gửi sai password hoặc email chưa đăng ký.

#### Kịch bản 4: Làm mới Token (Refresh Token)

- **Endpoint:** `POST /api/auth/refresh-token`
- **Request Body:**
  ```json
  {
    "refreshToken": "<REFRESH_TOKEN_TU_API_LOGIN>"
  }
  ```
- **Kết quả mong đợi:**
  - **Hợp lệ (200 OK):** Trả về `accessToken` mới.
  - **Hết hạn hoặc sai token (403 Forbidden):** Gửi refresh token không hợp lệ hoặc đã bị vô hiệu hóa.

#### Kịch bản 5: Đăng xuất (Logout)

- **Endpoint:** `POST /api/auth/logout`
- **Headers:** `Authorization: Bearer <ACCESS_TOKEN>`
- **Kết quả mong đợi:**
  - **Hợp lệ (200 OK):** Hệ thống xóa `refresh_token` trong DB của người dùng đó. Trả về thông điệp `"Đăng xuất thành công"`.

---

### 3.2 Nhóm API Dành cho Ứng viên (Candidate Module)

_Tất cả các API này yêu cầu Header `Authorization: Bearer <ACCESS_TOKEN>` của tài khoản có `role: "candidate"`._

#### Kịch bản 6: Xem và Cập nhật hồ sơ ứng viên

- **Xem hồ sơ:** `GET /api/candidate/profile`
  - **Thành công (200 OK):** Trả về thông tin cá nhân chi tiết.
- **Cập nhật hồ sơ:** `PUT /api/candidate/profile`
  - **Request Body:**
    ```json
    {
      "fullName": "Nguyễn Văn Cập Nhật",
      "phone": "0901234567",
      "headline": "Fullstack Developer",
      "summary": "Kinh nghiệm 3 năm làm việc với NodeJS và React",
      "address": "456 Điện Biên Phủ",
      "city": "Hồ Chí Minh",
      "dateOfBirth": "1999-05-20",
      "gender": "male",
      "linkedinUrl": "https://linkedin.com/in/nguyenvana"
    }
    ```
  - **Thành công (200 OK):** Cập nhật dữ liệu vào DB và trả về thông tin mới.
  - **Thất bại (400 Bad Request):** Số điện thoại sai định dạng (không bắt đầu bằng 0 hoặc không đủ 10 số), hoặc `linkedinUrl` không bắt đầu bằng `https://`.

#### Kịch bản 7: Quản lý Avatar (Ảnh đại diện)

- **Tải lên avatar:** `PUT /api/avatar`
  - **Header:** `Content-Type: multipart/form-data`
  - **Form-data key:** `avatar` (File ảnh định dạng JPG/PNG/WEBP, dung lượng < 5MB).
  - **Thành công (200 OK):** Avatar được lưu trữ và tối ưu hóa qua Sharp thành kích thước 500x500 WebP. Trả về `avatar_url`.
- **Xóa avatar:** `DELETE /api/avatar`
  - **Thành công (200 OK):** Xóa file ảnh trong thư mục và chuyển `avatar_url` trong DB về `null`.

#### Kịch bản 8: Quản lý Portfolio (Kinh nghiệm, Học vấn, Kỹ năng)

- **Thêm kinh nghiệm:** `POST /api/portfolio/experiences`
  - **Body:** `{ "company": "Công ty X", "title": "Developer", "startDate": "2023-01-01", "description": "Lập trình backend" }`
  - **Thành công (201 Created)**.
- **Thêm học vấn:** `POST /api/portfolio/educations`
  - **Body:** `{ "school": "Đại học CNTT", "degree": "Kử nhân", "field": "An toàn thông tin", "startDate": "2018-09-01", "endDate": "2022-06-30" }`
  - **Thành công (201 Created)**.
- **Cập nhật danh sách kỹ năng:** `PUT /api/portfolio/skills`
  - **Body:** `{ "skills": ["NodeJS", "ExpressJS", "ReactJS", "PostgreSQL"] }`
  - **Thành công (200 OK):** Hệ thống sẽ xóa các kỹ năng cũ của ứng viên và thay thế bằng danh sách mới (upsert tự động).

#### Kịch bản 9: Tải lên và Quản lý CV (Resumes)

- **Tải lên CV PDF:** `POST /api/resumes/upload`
  - **Header:** `Content-Type: multipart/form-data`
  - **Form-data key:** `cv` (File PDF dưới 5MB).
  - **Thành công (201 Created):** Tải file lên thành công. Hệ thống kích hoạt ngầm quy trình đọc text PDF, phân tích từ khóa và tạo vector lưu trữ để phục vụ tính năng tìm kiếm AI.
  - **Lỗi vượt quá số lượng (400 Bad Request):** Mỗi ứng viên chỉ được tải tối đa 3 CV.
- **Đặt CV làm mặc định:** `PATCH /api/resumes/:id/default`
  - **Thành công (200 OK):** CV được chọn sẽ chuyển thành mặc định để nộp đơn ứng tuyển nhanh.
- **Xóa CV:** `DELETE /api/resumes/:id`
  - **Thành công (200 OK):** Xóa file PDF khỏi hệ thống và loại bỏ khỏi DB.

#### Kịch bản 10: Ứng tuyển công việc (Apply Job)

- **Nộp hồ sơ:** `POST /api/applications`
  - **Body:**
    ```json
    {
      "jobId": "<UUID_CUA_CONG_VIEC>",
      "resumeId": "<UUID_CUA_CV_NEU_KHONG_GUI_SE_LAY_MAC_DINH>",
      "coverLetter": "Tôi rất mong muốn được ứng tuyển vào vị trí này..."
    }
    ```
  - **Thành công (201 Created):** Trả về thông tin đơn ứng tuyển ở trạng thái `submitted`.
  - **Lỗi trùng lặp (400 Bad Request):** Đã nộp đơn vào công việc này trước đó.
  - **Lỗi trạng thái công việc (400 Bad Request):** Công việc chưa được admin duyệt hoặc đã hết hạn tuyển dụng (`deadline`).

#### Kịch bản 11: Lưu công việc (Bookmarks)

- **Lưu/Hủy lưu:** `POST /api/bookmarks/:jobId`
  - **Thành công (200 OK):** Trả về trạng thái `"bookmarked": true` (Đã lưu) hoặc `"bookmarked": false` (Đã bỏ lưu).

---

### 3.3 Nhóm API Nhà tuyển dụng (Recruiter Module)

_Yêu cầu Header `Authorization: Bearer <ACCESS_TOKEN>` của tài khoản có `role: "recruiter"`._

#### Kịch bản 12: Quản lý Thông tin Công ty

- **Lấy thông tin công ty:** `GET /api/employer/profile`
  - **Thành công (200 OK):** Trả về thông tin công ty và danh sách nhà tuyển dụng.
- **Cập nhật thông tin công ty:** `PUT /api/employer/profile`
  - **Body:** `{ "name": "ABC Corp", "description": "Tập đoàn công nghệ", "website": "https://abc.com", "address": "Quận 1", "city": "HCM", "size": "100-200" }`
  - **Thành công (200 OK):** Cập nhật thành công. Trạng thái công ty sẽ chuyển về `pending` để chờ Admin duyệt lại nhằm tránh thay đổi thông tin sai lệch sau khi đã duyệt.

#### Kịch bản 13: Đăng và Quản lý tin tuyển dụng

- **Đăng tin tuyển dụng mới:** `POST /api/employer/jobs`
  - **Điều kiện tuyển dụng:** Hồ sơ công ty chủ quản phải ở trạng thái `approved`.
  - **Body:**
    ```json
    {
      "title": "Tuyển dụng Nodejs Developer",
      "description": "Mô tả công việc...",
      "requirements": "Yêu cầu ứng viên...",
      "benefits": "Quyền lợi được hưởng...",
      "salaryMin": 1500,
      "salaryMax": 2500,
      "location": "Hồ Chí Minh",
      "jobType": "Full-time",
      "jobLevel": "Junior",
      "deadline": "2026-12-31",
      "skills": ["NodeJS", "PostgreSQL", "REST API"]
    }
    ```
  - **Thành công (201 Created):** Tin tuyển dụng được tạo ở trạng thái `pending` chờ Admin duyệt. Hệ thống chạy ngầm tiến trình nhúng vector thông tin công việc để hỗ trợ tìm kiếm AI.
- **Tạm dừng/Mở lại tin tuyển dụng:** `PATCH /api/employer/jobs/:id/toggle-pause`
  - **Thành công (200 OK):** Chuyển đổi trạng thái tin tuyển dụng qua lại giữa `approved` và `paused`.

#### Kịch bản 14: Xử lý Đơn ứng tuyển

- **Xem danh sách ứng viên đã nộp đơn:** `GET /api/employer/applicants?jobId=<UUID_JOB>`
  - **Thành công (200 OK):** Trả về danh sách ứng viên đã nộp đơn kèm link tải CV và thư xin việc.
- **Phê duyệt hoặc Từ chối hồ sơ ứng viên:** `PATCH /api/employer/applicants/:applicationId/status`
  - **Body:** `{ "status": "approved"|"rejected", "note": "Ứng viên có kỹ năng phù hợp, hẹn phỏng vấn" }`
  - **Thành công (200 OK):** Cập nhật trạng thái đơn ứng tuyển.

---

### 3.4 Nhóm API Quản trị viên (Admin Module)

_Yêu cầu Header `Authorization: Bearer <ACCESS_TOKEN>` của tài khoản có `role: "admin"`._

#### Kịch bản 15: Duyệt Hồ sơ Công ty

- **Xem công ty chờ duyệt:** `GET /api/admin/companies/pending`
  - **Thành công (200 OK):** Trả về danh sách công ty cần duyệt.
- **Duyệt/Từ chối:** `PATCH /api/admin/companies/:id/review`
  - **Body (Approve):** `{ "action": "approved" }`
  - **Body (Reject):** `{ "action": "rejected", "reason": "Thông tin mã số thuế không hợp lệ" }`
  - **Thành công (200 OK)**.

#### Kịch bản 16: Duyệt Tin tuyển dụng

- **Xem tin tuyển dụng chờ duyệt:** `GET /api/admin/jobs/pending`
  - **Thành công (200 OK)**.
- **Duyệt/Từ chối tin tuyển dụng:** `PATCH /api/admin/jobs/:id/review`
  - **Body (Approve):** `{ "action": "approved" }`
  - **Body (Reject):** `{ "action": "rejected", "reason": "Nội dung tuyển dụng vi phạm chính sách" }`
  - **Thành công (200 OK)**.

#### Kịch bản 17: Quản lý người dùng

- **Xem toàn bộ danh sách người dùng:** `GET /api/admin/users?role=recruiter`
- **Khóa/Mở khóa tài khoản người dùng:** `PATCH /api/admin/users/:id/toggle-lock`
  - **Thành công (200 OK):** Tài khoản bị khóa sẽ không thể đăng nhập hoặc gọi các API cần xác thực.

---

### 3.5 Nhóm API Chatbot RAG và Gợi ý thông minh (AI Assistant)

#### Kịch bản 18: Chat RAG tìm việc bằng AI (Đòi hỏi xác thực Candidate)

- **Gửi câu hỏi:** `POST /api/chat`
  - **Body:**
    ```json
    { "question": "Tìm giúp tôi công việc NodeJS lương trên 1500 USD ở HCM" }
    ```
  - **Luồng xử lý (RAG):**
    1. Gemini phân loại ý định câu hỏi (Group 1 - JOB_SEARCH).
    2. Chuyển đổi câu hỏi thành vector bằng HuggingFace.
    3. Tìm kiếm ngữ nghĩa trong bảng `job_vectors` sử dụng cosine similarity (`pgvector`).
    4. Gửi kết quả tìm được kết hợp với câu hỏi ban đầu qua Gemini để biên soạn câu trả lời tiếng Việt trôi chảy.
  - **Kết quả mong đợi (200 OK):** Trả về câu trả lời tự nhiên dạng văn bản kèm danh sách công việc liên quan.

#### Kịch bản 19: Tìm kiếm ngữ nghĩa công việc (Public API - Không cần xác thực)

- **Gửi yêu cầu lọc:** `GET /api/public/job-suggestions?keyword=NodeJS&location=HCM&salary=1000`
  - **Cách thức hoạt động:** Gemini chuẩn hóa bộ lọc của người dùng thành từ khóa tìm kiếm vector, sau đó truy vấn DB và trả về danh sách các công việc phù hợp nhất xếp theo độ tương đồng ngữ nghĩa.
  - **Kết quả mong đợi (200 OK):** Danh sách công việc có trường `matchedSkills`, `matchCount`, `matchPercent`.

---

## 4. Báo cáo Trạng thái Phản hồi Lỗi (Common Error Response Guide)

Dưới đây là cấu trúc các lỗi chuẩn cần kiểm thử và bắt lỗi trên Frontend:

| Mã Lỗi (HTTP Code)   | Lỗi cụ thể                                                          | Cấu trúc Response                                                                               |
| :------------------- | :------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------- |
| **400 Bad Request**  | Thiếu trường bắt buộc, dữ liệu không hợp lệ                         | `{ "message": "Họ và tên không hợp lệ (từ 2 đến 50 ký tự, chỉ chứa chữ cái và khoảng trắng)" }` |
| **401 Unauthorized** | Không gửi token, token hết hạn hoặc sai thông tin                   | `{ "message": "Không có quyền truy cập, token không hợp lệ hoặc đã hết hạn" }`                  |
| **403 Forbidden**    | Truy cập sai quyền (ví dụ ứng viên gọi API duyệt công ty của admin) | `{ "message": "Bạn không có quyền thực hiện hành động này" }`                                   |
| **404 Not Found**    | Không tìm thấy tài nguyên (CV, Job, Người dùng)                     | `{ "message": "Không tìm thấy tin tuyển dụng" }`                                                |
| **500 Server Error** | Lỗi kết nối DB, lỗi thư viện Sharp, lỗi API AI                      | `{ "message": "Lỗi server", "error": "Chi tiết lỗi..." }`                                       |
