# Nhật Ký Phát Triển — App Thi Online HPTTS

> Mỗi buổi làm việc thêm 1 mục mới ở **đầu file** (mới nhất lên trên).
> Format: ngày | đã làm | vấn đề gặp | kế hoạch tiếp theo

---

## 2026-09-26 | Nghiệm thu C2 và push

### Đã làm
- Bốc đề thử trên dữ liệu production trong khối lệnh tự hủy: khóa cả 7 đề, mỗi đề một kỳ thi thử, một tài khoản học
  viên gọi `start_exam_attempt` và `get_questions_for_attempt`. Cả 7 đề: 50 câu, 50 nội dung khác nhau, không câu
  `retired`/đã xóa, đúng mô-đun và một ngân hàng; học viên tải đủ 50 câu. Sau đó 0 đề khóa, 0 kỳ thi thử, 0 bài.
- `check:boundaries` và `npm run build` đạt. Push 12 commit (Phase C, sửa khung admin, sửa bốc đề, C2, `exam_role`).

### Vấn đề gặp
- Không đề nào đang khóa; hàm bốc đề từ chối đề chưa khóa (từ P0). Nút "Khóa đề thi" đếm câu ở bảng cũ `questions`:
  6 đề khóa được, đề QC có 0 câu ở bảng cũ nên không khóa được. Ghi ở mục Open issues của `IMPLEMENTATION_LEDGER.md`.

### Kế hoạch tiếp theo
- Người dùng quyết: sửa kiểm tra khi khóa đề cho khớp hàm bốc đề (cần entry riêng).

---

## 2026-09-23 | Phase C: tách giao diện ngân hàng câu hỏi

### Đã làm
- Cất tạm thay đổi menu E-LEARNING chưa commit (`git stash`, ghi đầy đủ nội dung trong `docs/IMPLEMENTATION_LEDGER.md` mục "Parked changes"), pull 8 commit P0/P1/Phase B.
- Tách `QuestionLibraryDashboardPage` thành các route riêng: danh sách ngân hàng, cây kiến thức, câu hỏi (mới, có lọc theo trạng thái, mục cây, từ khóa), nhập tài liệu, rà soát bản nháp. Link cũ `?library=` tự chuyển hướng.
- Khôi phục dấu tiếng Việt cho các chuỗi bị mất dấu; mỗi màn có trạng thái đang tải, trống, lỗi.
- Tài liệu: `docs/implementation/2026-09-23-phase-c-question-bank-routes.md`, `docs/rollback/2026-09-23-phase-c-question-bank-routes.md`.
- 2026-09-24: rà UI theo antislop (bỏ câu chữ hứa tính năng chưa có, nút Tải lại khi lỗi, vùng bấm 44 px, số câu theo trạng thái bấm được).
- 2026-09-24: ranh giới dữ liệu ngân hàng câu hỏi (`docs/implementation/2026-09-24-question-bank-data-boundary.md`): đọc nghề và mô-đun chuyển vào `data/` của module; `check:boundaries` chặn module import `services/` cũ và chặn tầng ngoài `data/` import Supabase client. Đi chung một commit với Phase C.
- Sửa lỗi lint duy nhất của repo (`no-useless-escape` ở `src/services/questionImportService.ts`).
- 2026-09-24: click-through Admin trên Edge (điều khiển qua CDP, profile riêng). Phase C đạt. Phát hiện và sửa 3 lỗi có từ trước ở khung admin (`docs/implementation/2026-09-24-admin-shell-fixes.md`): F5 bị đẩy về `/login`, tiêu đề luôn "Dashboard", Tab lọt vào sidebar đang ẩn. Tách commit riêng sau Phase C.

- 2026-09-24: phát hiện hàm bốc đề cho câu lặp ở mô-đun QTHH-AT (4 nghề dùng chung, mỗi nghề một bản sao của cùng 150 câu): 326/326 bài có câu lặp. Đã soạn migration `20260924094701_draw_exclude_duplicate_content.sql` (loại trùng theo lời dẫn + phương án), kiểm chứng bằng giả lập 300 lượt bốc và kiểm tra 7 đề không thiếu câu; đã chạy trên production (phiên bản `20260924094701`), nội dung hàm khớp file, quyền giữ nguyên. Lập báo cáo chỉ đọc cho 203 bài đã nộp (file Excel ngoài repo vì có tên học viên).

- 2026-09-24: commit Phase C (`178dbb5`), admin shell fixes (`9b5ea6b`), bản sửa bốc đề (`b4f65a1`), chưa push. Bắt đầu Phase C2 "một kho câu hỏi": migration `20260924111343` đã chạy trên production. 7 ngân hàng theo mô-đun, 2.798 dòng đã gắn ngân hàng, QTHH-AT gộp 4 bản sao thành 150 câu dùng chung (450 bản sao chuyển `retired`, không xóa), trigger tự gắn câu mới vào ngân hàng của mô-đun.

- 2026-09-24: C2 bước 2 lát 1, editor soạn câu trong module ngân hàng (7 kiểu câu). Không chép 3 hành vi của form cũ vốn làm đổi câu khi chỉ mở rồi lưu (ép kéo thả 4 ô, chia lại điểm ý tự luận khi mở, ghi vị trí ô cho mọi câu 4 nhãn). Mở rồi lưu 6 câu thật trên Edge: md5 nội dung không đổi.

- 2026-09-24: C2 bước 2 lát 2, nhập Excel/CSV/ZIP ngay trong ngân hàng (`/admin/question-libraries/<id>/questions/import`), dùng được cho cả ngân hàng dùng chung QTHH-AT. Mỗi dòng đi qua đúng hàm dựng câu của editor. Dòng đọc không được thì báo lỗi kèm số dòng thay vì tự điền đáp án mặc định như bộ nhập cũ. Dòng trùng (theo khóa của hàm bốc đề) bị bỏ qua. Ảnh tải lên trước, câu lưu trong một lần ghi: hoặc đủ cả, hoặc không câu nào. Sửa lỗi cũ: CSV UTF-8 không có BOM bị mất dấu tiếng Việt; "Đ;S" bị đọc thành toàn Sai. Thử trên Edge với 6 câu `[TEST]` ở trạng thái nháp, kiểm tra DB, rồi xóa mềm.

- 2026-09-24: C2 bước 3, bỏ kho câu hỏi cũ. Trước khi bỏ, chuyển vào tab Câu hỏi của ngân hàng những gì chỉ màn cũ có: lọc theo loại câu, lọc câu lỗi dữ liệu kèm cảnh báo, chọn nhiều để đổi trạng thái hoặc xóa, xóa từng câu trong editor, xuất Excel (cùng cột với file nhập). Khi xóa, câu đã có trong bài thi của học viên được chuyển sang "Ngừng sử dụng" thay vì xóa, vì `grade_attempt` bỏ qua câu đã xóa. URL cũ `/admin/questions/...` tự chuyển tới ngân hàng tương ứng; 4 trang cũ đã xóa. Viết lại hướng dẫn nhập câu hỏi (`docs/HUONG_DAN_SOAN_DE_VA_IMPORT_CAU_HOI.md`). Kiểm tra 7 ngân hàng thật: 1.100 câu đang dùng, 0 câu lỗi.

### Vấn đề gặp
- `node_modules` trên máy thiếu `@tanstack/react-query` sau khi pull; đã `npm install` (lockfile giữ nguyên).
- Chưa click thử khi đăng nhập admin và giáo viên.
- Phát hiện route guard của giáo viên cho mở mọi URL `/admin/...` (lỗi có từ trước, ghi ở mục "Open issues" trong ledger, chưa sửa).

### Kế hoạch tiếp theo
- Nghiệm thu C2: click thử bằng tài khoản giáo viên; thử bốc đề trên một đề thử đã kiểm định.
- Sau C2: nhập tài liệu Word (cần file mẫu của trung tâm), rồi giám sát trực tuyến.

---

## 2026-06-12 — Hoàn thiện tracking video (3 lỗ hổng)

### Đã làm (`LessonPlayerPage.tsx` + `elearningStudyService.ts`)
1. **Resume vị trí xem dở**: `onLoadedMetadata` → `video.currentTime = watched_seconds` (chỉ khi đã xem >5s, chưa sát cuối, block chưa hoàn thành) + toast "Tiếp tục từ phút X"
2. **Drive MP4 track được**: video Drive thử `<video src=uc?export=download>` trước (timeupdate hoạt động → auto-complete 90% + resume); `onError` (file lớn bị Drive chặn stream) → fallback iframe `/preview` + nút hoàn thành tay
3. **Ghi vét tiến độ khi rời trang**: đổi block ở sidebar / bấm về danh sách (unmount) → upsert thường; đóng tab / chuyển app (`pagehide` + `visibilitychange hidden`) → `flushProgressKeepalive` mới trong service (fetch keepalive thẳng REST PostgREST vì supabase-js không hỗ trợ; access token cache sẵn trong ref)
- Chế độ xem trước admin/GV: mọi đường ghi đều bị chặn như cũ

### Lưu ý kỹ thuật
- Drive `uc?export=download` chỉ stream tốt với file vừa/nhỏ (<~100MB); file lớn dính trang virus-scan → tự fallback iframe, không vỡ UI
- Ghi vét chỉ gửi `watched_seconds` (Prefer: merge-duplicates) — không đụng status/quiz_score

---

## 2026-06-11 — Tính năng Học trực tuyến (E-Learning lát 1)

### Đã làm
- `services/elearningStudyService.ts`: lấy mô-đun theo lớp học viên (enrollments → classes → courses → course_modules), bài học đã xuất bản, tiến độ; upsert `elearning_progress` theo (user_id, block_id)
- `pages/StudentLearnPage.tsx`: danh sách bài học gom theo mô-đun, thanh % hoàn thành, **học tuần tự** (bài sau khóa đến khi bài trước xong)
- `pages/LessonPlayerPage.tsx`: sidebar khối nội dung + player — YouTube/Drive nhúng iframe, video HTML5 (Cloudinary/VPS/link mp4) tự hoàn thành khi xem ≥90% và lưu watched_seconds mỗi 15s, PDF iframe, bài viết text
- Route `/student/learn`, `/student/learn/:lessonId` + menu STUDENT "Học trực tuyến"
- Types `Elearning*` thêm vào `src/types/index.ts` (repo này dùng types viết tay, không gen)

### Vấn đề gặp
- Không có — RLS tiến độ dùng đúng pattern `attempts` (`user_id = auth.uid()`), học viên đã có Supabase auth thật

### Bổ sung cùng ngày — Chế độ xem trước cho Admin/GV
- `Layout.tsx`: admin có thêm nhóm menu "XEM TRƯỚC → Học trực tuyến"
- `StudentLearnPage.tsx`: role admin/teacher → dropdown chọn lớp bất kỳ (banner vàng), mọi bài mở khóa, không tải/hiển thị tiến độ
- `LessonPlayerPage.tsx`: preview không ghi `elearning_progress` (chặn cả markCompleted lẫn timeupdate), ẩn nút "Đánh dấu đã học xong"
- `elearningStudyService.ts`: tách `getModulesWithLessonsByClassIds(classIds)` dùng chung cho preview và học viên

### Kế hoạch tiếp theo
- Lát 2: khối Quiz trong bài học (RPC không lộ answer_key, tái dùng `question_bank`)
- Nâng cấp tracking video YouTube bằng IFrame Player API (đếm giây xem thật thay vì nút bấm tay)
- Cân nhắc ràng buộc thời gian xem tối thiểu cho video iframe (YouTube/Drive không tracking được)
