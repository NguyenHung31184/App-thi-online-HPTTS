# Tổng kết App-thi-online-HPTTS — Đã làm / Chưa làm

*(Cập nhật theo codebase hiện tại)*

---

## 1. TÍNH NĂNG (Features)

### 1.1. Đã thực hiện

| Hạng mục | Chi tiết |
|----------|----------|
| **Thi lý thuyết** | Tạo đề thi (exams), câu hỏi (trắc nghiệm, kéo thả, tự luận, có ảnh), import câu hỏi từ file, ngân hàng câu hỏi theo nghề. Kỳ thi (exam_windows): lớp, thời gian, mã truy cập, 1 đề hoặc nhiều đề (random 1 khi vào). Thí sinh vào thi bằng mã, làm bài, đếm giờ, autosave đáp án, nộp bài. Chấm tự động (RPC `grade_attempt`) cho trắc nghiệm/khách quan; chấm tay cho tự luận (essay grading). |
| **Thi thực hành** | Mẫu thi (templates) + tiêu chí chấm (criteria). Phiên thi (sessions): lớp, thời gian, mã. Thí sinh vào → tải ảnh minh chứng theo tiêu chí → nộp bài. GV chấm từng tiêu chí, tổng điểm có weight; đồng bộ điểm sang TTDT (sync). |
| **Phân quyền** | Role: admin, teacher, proctor, student. Profile (role, student_id). Admin/teacher/proctor vào `/admin` (sidebar đầy đủ). Nâng role teacher theo bảng `instructors` (chuyên ngành Lý thuyết). |
| **Xác thực thí sinh** | Trang `/verify-cccd`: upload ảnh CCCD → OCR (proxy Chatbot) → verify với TTDT → lưu student_id/code/name vào sessionStorage + (nếu có) profile. Bắt buộc xác thực CCCD trước khi vào phòng thi (lý thuyết + thực hành) trừ admin. |
| **Dashboard** | Thí sinh: danh sách kỳ thi lý thuyết + thi thực hành đang mở (theo lớp), nhập mã → Vào thi. Admin/teacher: thống kê (kỳ mở, bài làm, tỷ lệ đạt, biểu đồ, log vi phạm). |
| **Báo cáo & đồng bộ** | Báo cáo bài làm (lọc theo đề/kỳ), báo cáo vi phạm (audit log), xuất CSV/Excel. Đồng bộ điểm lý thuyết và thực hành sang TTDT (API receive-exam-results), log sync (exam_sync_log, practical_sync_log), retry thủ công. |
| **Kết quả thí sinh** | Trang "Kết quả" (`/student/results`): danh sách bài thi **lý thuyết** đã hoàn thành, điểm, đạt/không đạt, link xem chi tiết. |
| **Intro trước khi thi** | Trang intro (`/exam/:attemptId/intro`): xem thông tin đề, xác nhận rồi vào làm bài. |

### 1.2. Chưa / Chưa đầy đủ

| Hạng mục | Ghi chú |
|----------|--------|
| **Giới hạn số lần làm thi thực hành** | Mỗi session thí sinh có thể tạo nhiều attempt (mỗi lần bấm "Vào thi thực hành" = 1 attempt mới). Chưa có ràng buộc "1 session = 1 attempt" hoặc "chỉ được làm lại nếu chưa nộp". |
| **Kết quả thi thực hành cho thí sinh** | Trang "Kết quả" chỉ hiển thị bài thi lý thuyết. Chưa có màn xem điểm/trạng thái bài thi thực hành đã nộp/đã chấm. |
| **Luồng vào thi lý thuyết** | Hiện có thể vào thẳng `/exam/:attemptId` (làm bài). Có trang intro nhưng luồng "Dashboard → Intro → Làm bài" chưa được bắt buộc thống nhất (ví dụ: sau khi tạo attempt có redirect qua intro hay không tùy chỗ). |
| **Thông báo / Email** | Không có gửi email thông báo kỳ thi, nhắc nộp bài, hoặc gửi kết quả. |

---

## 2. BẢO MẬT (Security)

### 2.1. Đã thực hiện

| Hạng mục | Chi tiết |
|----------|----------|
| **Supabase Auth** | Đăng nhập email/password; session. |
| **RLS (Row Level Security)** | Bật RLS cho các bảng chính. Thí sinh: đọc attempt/câu hỏi của mình; đọc exam_windows/practical_sessions theo lớp (enrollments). Admin/teacher: full quyền tương ứng. Câu hỏi thí sinh lấy qua RPC `get_questions_for_student` (không trả `answer_key`). |
| **Mã truy cập kỳ thi** | Vào thi (lý thuyết/thực hành) phải nhập đúng access_code; kiểm tra thời gian start_at/end_at. |
| **Kiểm tra quyền attempt** | Trang làm bài/result kiểm tra `attempt.user_id === user.id` (hoặc student session). |

### 2.2. Chưa / Cần lưu ý

| Hạng mục | Ghi chú |
|----------|--------|
| **Rate limit / chống brute force** | Không thấy giới hạn số lần nhập sai mã truy cập hoặc rate limit API. |
| **Bảo vệ API TTDT** | API key TTDT lưu trong env (VITE_*); gọi từ client. Nếu cần bảo mật cao hơn nên gọi qua backend proxy. |
| **Cập nhật mật khẩu / Quên mật khẩu** | Chưa có màn đổi mật khẩu hay gửi email reset mật khẩu (Supabase hỗ trợ sẵn, chưa tích hợp UI). |

---

## 3. CHỐNG GIAN LẬN (Proctoring / Anti-cheating)

### 3.1. Đã thực hiện

| Hạng mục | Chi tiết |
|----------|----------|
| **Bắt buộc chụp ảnh khuôn mặt** | Trước khi làm bài lý thuyết: bật camera, chụp ảnh, upload lên Storage, ghi audit `photo_taken`. Chỉ sau bước này mới vào fullscreen và xem đề. |
| **Toàn màn hình (fullscreen)** | Yêu cầu fullscreen khi làm bài (trừ iOS không hỗ trợ thì bỏ qua). Thoát fullscreen → ghi audit `fullscreen_exited`, chụp evidence, tăng đếm vi phạm; đủ N lần (MAX_VIOLATIONS = 3) thì **tự động nộp bài**. |
| **Chụp evidence khi vi phạm** | Component `ProctoringEvidenceCapture`: chụp frame camera → upload lên Storage (exam-uploads), trả URL. Dùng cho: focus_lost, visibility_hidden, fullscreen_exited, ai_cell_phone, ai_prohibited_object, ai_no_face, ai_multiple_face. |
| **Audit log** | Mọi sự kiện vi phạm ghi vào `attempt_audit_logs` (event + metadata, kèm evidence_url nếu có). |
| **Tab ẩn / mất focus** | Document visibility hidden → ghi `visibility_hidden`. Window blur → ghi `focus_lost`. Có thể kết hợp chụp evidence (tùy luồng). |
| **Chặn copy/paste** | Trên trang làm bài: chặn copy/paste và ghi audit `copy_paste_blocked`. |
| **AI giám sát (tùy chọn)** | Component `AiObjectProctorBurst`: COCO-SSD (TensorFlow.js) phát hiện điện thoại, vật cấm, không mặt, nhiều mặt. Chạy burst (mỗi 60s chạy 5s). Bật khi `VITE_AI_PROCTORING_ENABLED=1`. Khi vi phạm: ghi audit + có thể chụp evidence. |
| **Báo cáo vi phạm** | Admin xem log vi phạm (dashboard 24h; báo cáo chi tiết). Xuất báo cáo có thể gồm audit events. |

### 3.2. Chưa / Hạn chế

| Hạng mục | Ghi chú |
|----------|--------|
| **Thi thực hành** | Không có proctoring (camera, fullscreen, audit) trên trang thi thực hành; chỉ nộp ảnh minh chứng. |
| **Khóa chuột trong khung** | Chưa có giới hạn chuột chỉ trong vùng trang thi. |
| **Ghi âm / stream video liên tục** | Chỉ chụp ảnh tại thời điểm vi phạm (và ảnh khuôn mặt lúc bắt đầu); không ghi video/audio liên tục. |
| **Chống mở tab khác** | Chỉ ghi nhận (visibility/blur), không khóa mở tab mới (trình duyệt thường không cho phép). |

---

## 4. GIAO DIỆN (UI/UX)

### 4.1. Đã thực hiện

| Hạng mục | Chi tiết |
|----------|----------|
| **Công nghệ** | React 19, Vite 7, TypeScript, Tailwind CSS. Layout có sidebar (AppLayout), responsive. |
| **Trang chính** | Login (email/mã HV), Role select, Verify CCCD, Dashboard (kỳ thi + mã truy cập), Student Exams, Student Results, Exam intro, Exam làm bài, Exam result, Practical làm bài. |
| **Admin** | Sidebar: Dashboard, Đề thi, Soạn câu hỏi, Kỳ thi (windows), Chấm tự luận, Mẫu thi thực hành, Phiên thi thực hành, Chấm thực hành, Báo cáo, Đồng bộ điểm. Form CRUD đề/kỳ/câu hỏi/template/session; danh sách có lọc. |
| **Nhất quán** | Dùng Tailwind, component dùng chung (ConfirmationModal, SortableOptionList, LabelOnImageDrop, ExamCard, Icons). Toast (sonner) cho thông báo. |
| **Trải nghiệm làm bài** | Đếm giờ, autosave, nút nộp bài có xác nhận; hiển thị số câu đã trả lời; câu hỏi kéo thả, tự luận, trắc nghiệm. |

### 4.2. Chưa / Cần cải thiện

| Hạng mục | Ghi chú |
|----------|--------|
| **Giao diện thi thực hành** | Trang practical đơn giản (danh sách tiêu chí + upload ảnh + nộp). Chưa có intro riêng, chưa có đồng hồ đếm ngược theo duration_minutes của template. |
| **Kết quả sau khi nộp** | Thi thực hành: sau nộp chỉ trở về dashboard hoặc thông báo; chưa có trang "Kết quả thi thực hành" cho thí sinh (điểm, trạng thái chấm). |
| **Thống nhất luồng vào thi** | Có ExamIntroPage nhưng luồng "tạo attempt → redirect intro → làm bài" chưa thống nhất toàn app (ví dụ một số chỗ có thể skip intro). |
| **Ngôn ngữ** | Nội dung chủ yếu tiếng Việt; một nhãn menu vẫn tiếng Anh (Exams, Result). |
| **Tối ưu mobile** | Layout responsive nhưng trải nghiệm làm bài (fullscreen, camera) trên mobile chưa được tối ưu rõ ràng. |
| **Tính năng trợ năng** | Chưa có mô tả aria, focus management đặc biệt cho màn hình làm bài. |

---

## 5. TÓM TẮT THEO NHÓM

| Nhóm | Đã làm | Chưa làm / Cần bổ sung |
|------|--------|-------------------------|
| **Tính năng** | Thi lý thuyết + thực hành đầy đủ, CRUD đề/kỳ/câu hỏi/template/session, chấm tự động + chấm tay, CCCD, dashboard, báo cáo, sync TTDT, kết quả thí sinh (lý thuyết). | Giới hạn 1 attempt/session cho thực hành; trang kết quả thi thực hành cho thí sinh; luồng intro thống nhất; thông báo/email. |
| **Bảo mật** | Auth, RLS, mã truy cập, kiểm tra quyền attempt. | Rate limit, proxy API TTDT, đổi mật khẩu / quên mật khẩu. |
| **Chống gian lận** | Ảnh khuôn mặt, fullscreen, audit log, evidence khi vi phạm, visibility/blur, copy/paste block, AI proctoring (tùy env). | Proctoring cho thi thực hành; khóa chuột; ghi hình liên tục; trang thực hành không có giám sát. |
| **Giao diện** | React + Tailwind, đủ trang chính và admin, form danh sách, toast. | Intro/đồng hồ cho thực hành; trang kết quả thực hành cho SV; thống nhất luồng intro; nhất quán ngôn ngữ; tối ưu mobile/accessibility. |

---

*Tài liệu này phản ánh trạng thái code tại thời điểm tổng kết; khi thêm tính năng mới nên cập nhật lại.*
