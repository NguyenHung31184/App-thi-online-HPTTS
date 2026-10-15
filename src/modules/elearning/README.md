# E-learning

Nền API cho bài học theo ghi danh và phiên bản, ngày 05/10/2026.

- `domain/assigned-learning.ts`: DTO catalog, nội dung và receipt lưu tiến độ.
- `data/assigned-learning-repository.ts`: RPC `elearning_get_assigned_lessons` và `elearning_record_progress`.
- `public.ts`: API dùng bởi các phần khác của app.

Danh sách và player đã thuộc `ui/catalog` và `ui/player`, route xuất qua `public.ts`. Không còn service cũ.
`queries/use-learning-catalog.ts` và `use-legacy-player.ts` điều phối giao diện; `application/legacy-learning.ts`
gom bài theo mô-đun; `data/legacy-learning-repository.ts` đọc/ghi nguồn legacy. Quy tắc hoàn thành nằm trong domain.

Luồng phiên bản dùng `AssignedLearningList`/`AssignedLessonPlayer`, catalog và receipt theo enrollment/assignment.
Video ghi khoảng phát thực tế và nhận xác nhận hoàn thành từ server. Bài legacy chưa được giao snapshot vẫn có player riêng.
Migration e-learning thuộc repo app quản lý; dữ liệu nguồn cũ bị ẩn đối với lớp đã giao snapshot để tránh vượt điều kiện mở bài.

## Soạn bài và giao bài (từ 13/10/2026)

Khu quản trị: `/admin/lessons` (`ui/authoring/LessonsPage`) và `/admin/lessons/:lessonId` (`LessonEditorPage` với
`BlockEditor`, `PublishPanel`, `AssignmentPanel`). `ui/BlockContent` hiện một khối như học viên thấy, không ghi tiến độ.

- `domain/lesson-authoring.ts`: kiểm tra form khối và form giao bài, điều kiện xuất bản, so bản nháp với phiên bản,
  đếm tiến độ theo lớp, đổi lỗi máy chủ thành câu tiếng Việt.
- `data/lesson-authoring-repository.ts`: đọc ghi bài và khối; đọc phiên bản, bản giao, lớp của mô-đun; gọi
  `elearning_publish_lesson`, `elearning_assign_lesson`, `elearning_archive_assignment`.
- `application/manage-lessons.ts`, `queries/use-lesson-authoring.ts`.

Nội dung nhập bằng đường dẫn `https://`, chưa có tải file lên. Video có đo thời gian phải dài từ 15 giây. Chi tiết:
`docs/implementation/2026-10-13-elearning-authoring-and-assignment.md`.

## Bài kiểm tra cuối bài (từ 15/10/2026)

- `domain/quiz.ts`: dạng câu chấm được, trạng thái trả lời, gói gửi máy chủ, số lượt còn lại, câu báo lỗi.
- Soạn: `ui/authoring/QuizQuestionPicker` chọn câu đã duyệt của mô-đun từ `question_bank` vào `elearning_quiz_items`.
- Học: `ui/QuizBlock` gọi `elearning_submit_quiz`; lượt làm đọc từ `elearning_quiz_attempts` (chỉ đọc).
- Trình duyệt không bao giờ nhận đáp án: phiên bản chỉ có câu hỏi; đáp án nằm ở `elearning_private.quiz_answer_keys`.
- Kết quả quiz không ghi vào điểm thi chính thức. Migration: `20261015090000_elearning_quiz_and_report.sql` (repo app quản lý).

API record progress không nhận user ID hoặc điểm từ browser. Quyền học, điều kiện mở bài và
hoàn thành video tính ở backend. Client phải báo các khoảng phát liên tục hợp lệ, không dùng
vị trí tua làm khoảng đã xem. Báo cáo tiến độ nằm ở app quản lý (`/learning-progress`). SCORM chưa triển khai.
