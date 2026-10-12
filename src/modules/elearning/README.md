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

API record progress không nhận user ID hoặc điểm từ browser. Quyền học, điều kiện mở bài và
hoàn thành video tính ở backend. Client phải báo các khoảng phát liên tục hợp lệ, không dùng
vị trí tua làm khoảng đã xem. Báo cáo và SCORM chưa triển khai.
