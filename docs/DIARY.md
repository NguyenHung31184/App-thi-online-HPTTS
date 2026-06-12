# Nhật Ký Phát Triển — App Thi Online HPTTS

> Mỗi buổi làm việc thêm 1 mục mới ở **đầu file** (mới nhất lên trên).
> Format: ngày | đã làm | vấn đề gặp | kế hoạch tiếp theo

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
