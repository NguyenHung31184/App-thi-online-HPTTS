# Kế hoạch e-learning: soạn và học đều ở App thi online

Ngày lập: 13/10/2026. Trạng thái: giai đoạn 1 và 2 đã lên production ngày 13/10/2026 (migration rút bài đã áp; chưa thử trên điện thoại thật); xem
`docs/implementation/2026-10-13-elearning-authoring-and-assignment.md`. Giai đoạn 3 và 4: code xong 15/10/2026, migration
`20261015090000_elearning_quiz_and_report.sql` (repo app quản lý) đã chạy thử, CHƯA áp, chưa push. Giai đoạn 5–7 chưa bắt đầu.

Kế hoạch này thay phần **bố trí giữa hai app** của `docs/KE_HOACH_ELEARNING_HPTTS.md` (repo app quản lý, lập
04–05/10). Các quy tắc nghiệp vụ ở mục 4 của file đó và thiết kế SCORM trong `docs/KE_HOACH_SCORM_ACTIVEPRESENTER.md`
vẫn dùng.

## 1. Quyết định bố trí

Chủ dự án chốt ngày 13/10/2026: app quản lý dùng để theo dõi, giám sát và báo cáo; App thi online là nơi soạn (đề,
kỳ thi, và từ nay cả bài học). Hiện chỉ admin soạn; sau này mở cho giáo viên và giáo vụ.

| Việc | App |
|---|---|
| Soạn bài học, khối nội dung, gói SCORM | App thi |
| Quiz trong bài, lấy câu từ ngân hàng câu hỏi | App thi |
| Giao bài cho lớp, đặt ngày mở và hạn học | App thi |
| Học viên học, làm quiz, nộp bài tập | App thi |
| Giáo viên chấm bài tập | App thi |
| Báo cáo tiến độ theo lớp, theo học viên | App quản lý xem; số liệu sinh ra ở App thi |
| Lớp, ghi danh, lịch học | App quản lý (nguồn dữ liệu, như hiện nay) |
| Xét điều kiện dự thi, cấp chứng chỉ từ kết quả học | App quản lý |

Lý do: đề và kỳ thi đã soạn ở App thi; quiz trong bài cần ngân hàng câu hỏi, mà ngân hàng nằm ở App thi; người soạn
không phải làm việc trên hai app.

File migration database vẫn đặt trong repo app quản lý, vì toàn bộ migration của hệ thống ở đó.

## 2. Hiện trạng (kiểm tra ngày 13/10/2026)

**Đã có trong database** (migration `20260611000000`, `20261005015028`, `20261005015428`, đã áp production):
`elearning_lessons`, `elearning_lesson_blocks`, `elearning_lesson_versions`, `elearning_class_assignments`,
`elearning_enrollment_progress`, `elearning_quiz_items`, bảng cũ `elearning_progress`; bốn hàm
`elearning_publish_lesson`, `elearning_assign_lesson`, `elearning_get_assigned_lessons`, `elearning_record_progress`.

**Đã có trong App thi** (`src/modules/elearning`): danh sách bài được giao, trình phát video, PDF, bài viết; tiến độ
ghi qua máy chủ; trình phát cũ cho bài chưa giao theo phiên bản.

**Đã có trong app quản lý**: màn "Quản lý E-Learning" (danh sách bài, hộp soạn bài, xuất bản và xem phiên bản). Sẽ
chuyển sang App thi ở giai đoạn 1.

**Chưa có**: giao diện giao bài cho lớp, quiz trong bài (đang bị chặn xuất bản), báo cáo tiến độ, SCORM, bài tập,
hỏi đáp, thông báo, lớp trực tuyến.

**Dữ liệu thật**: 2 bài học, 0 khối nội dung, 0 phiên bản, 0 bài được giao, 0 dòng tiến độ. Chưa có lớp nào dùng.

**Tài khoản**: 1 tài khoản có `exam_role = admin`; 17 tài khoản giảng viên chưa có vai trò ở App thi.

## 3. Tham khảo từ Frappe Learning

Nguồn: `D:\Data\New folder (2)\lms` (`frappe/lms`). Chỉ tham khảo cách tổ chức nghiệp vụ. Không chép mã: Frappe
chạy Python, MariaDB và Vue, và giấy phép AGPL-3.0 buộc công khai mã nguồn của app nào dùng mã của nó.

| Lấy ý tưởng | Dùng ở giai đoạn |
|---|---|
| Cấu hình quiz: số lượt, điểm đạt, có cho xem đáp án không | 3 |
| Trang tiến độ từng học viên trong một khóa | 4 |
| Chương SCORM là một loại nội dung | 5 |
| Bài tập nộp file, chấm và nhận xét | 7 |
| Ghi chú trong bài, hỏi đáp, đánh giá sau lớp | 7 |
| Lớp trực tuyến gắn vào thời khóa biểu | 7 |

Không lấy: bán khóa học và mã giảm giá, bảng việc làm, bài tập lập trình, huy hiệu.

## 4. Các giai đoạn

Mỗi giai đoạn theo quy trình ledger: tài liệu triển khai và rollback, mỗi bước một commit, chạy `npm test`, lint,
`check:boundaries`, build, `arch:score`. Thay đổi database: chạy thử trong giao dịch tự hủy, chủ dự án duyệt rồi mới
áp production.

### Giai đoạn 1: chuyển phần soạn bài sang App thi (cỡ vừa)

- Thêm mục "Bài học" vào menu quản trị App thi, cạnh "Ngân hàng câu hỏi" và "Đề thi".
- Danh sách bài theo mô-đun; soạn khối video, PDF, bài viết; sắp xếp khối; xem trước như học viên thấy.
- Xuất bản thành phiên bản cố định qua `elearning_publish_lesson`; xem lại các phiên bản.
- App quản lý: mục "Quản lý E-Learning" đổi thành nút mở sang App thi, giống "Đề thi lý thuyết". Xóa màn soạn cũ sau
  khi bản mới chạy ổn.
- Xong khi: admin soạn và xuất bản được một bài có đủ ba loại khối trên App thi, không cần mở app quản lý.

### Giai đoạn 2: giao bài cho lớp và học thử (cỡ vừa)

- Màn giao bài: chọn lớp, phiên bản, ngày mở, hạn học, bắt buộc hay không, học tuần tự hay không.
- Dùng `elearning_assign_lesson`; học viên chỉ thấy bài của lớp mình ghi danh.
- Học thử với lớp `TEST-TH` trên điện thoại: mở bài, xem video dở rồi quay lại, hoàn thành bài.
- Xong khi: tiến độ của học viên thử ghi đúng trong `elearning_enrollment_progress`, tua video tới cuối không được
  tính là đã xem.

### Giai đoạn 3: quiz cuối bài (cỡ lớn)

- Người soạn chọn câu từ ngân hàng câu hỏi cho khối quiz, đặt điểm đạt (mặc định 80%) và số lượt (mặc định 3).
- Phiên bản bài lưu bản chụp câu hỏi không kèm đáp án; chấm ở máy chủ; lưu từng lượt làm.
- Kết quả quiz không ghi vào điểm thi chính thức.
- Xong khi: đáp án không xuất hiện trong dữ liệu gửi về trình duyệt, và bài có quiz chỉ hoàn thành khi quiz đạt.

### Giai đoạn 4: báo cáo tiến độ (cỡ vừa)

- Hàm báo cáo theo lớp, mô-đun, học viên: phần trăm hoàn thành, bài quá hạn, điểm quiz.
- App quản lý: màn báo cáo trong nhóm "Học tập và kết quả", lọc và xuất Excel.
- App thi: người soạn xem tiến độ của lớp ngay tại bài đã giao.
- Xong khi: số trên báo cáo khớp với số đếm trực tiếp trong database cho lớp thử.

### Giai đoạn 5: SCORM 1.2 cho ActivePresenter (cỡ lớn)

Theo `KE_HOACH_SCORM_ACTIVEPRESENTER.md`, đổi một điểm: kho gói, nhập ZIP và giao bài nằm ở App thi. Phải thử hạ
tầng lưu và phát gói trước khi viết giao diện (mục 5.2 của file đó).

### Giai đoạn 6: phân quyền giáo viên và giáo vụ (cỡ lớn)

Làm trước khi cấp tài khoản soạn cho người thứ hai. Không phụ thuộc giai đoạn 3–5, có thể chen lên sớm.

- Vai trò ở App thi: `admin`, `teacher`, thêm vai trò cho giáo vụ. Vai trò do app quản lý cấp qua
  `profiles.exam_role`, như hiện nay.
- Phạm vi: giáo viên chỉ soạn và xem trong các mô-đun mình được phân công; giáo vụ giao bài và xem báo cáo của mọi
  lớp, không sửa nội dung.
- Thực thi ở database (RLS và hàm), không chỉ ẩn nút trên giao diện. Áp cho cả đề thi, kỳ thi và bài học.
- Ghi người tạo và người sửa cho bài học, phiên bản, lượt giao bài.
- Xong khi: tài khoản giáo viên thử không đọc, không sửa được bài và câu hỏi của mô-đun khác, kiểm tra bằng test
  database.

Để giai đoạn 6 không phải sửa lại dữ liệu, từ giai đoạn 1 mọi bảng mới đều có cột người tạo, và mọi thao tác ghi đi
qua hàm ở máy chủ.

### Giai đoạn 7: mở rộng (từng phần, cỡ vừa mỗi phần)

- Bài tập nộp file hoặc ảnh, giáo viên chấm và nhận xét.
- Ghi chú trong bài, hỏi đáp theo bài.
- Thông báo trong app và nhắc hạn học.
- Lớp trực tuyến gắn vào lịch học đã có ở app quản lý.
- Nối kết quả học vào xét điều kiện dự thi và cấp chứng chỉ, sau khi thống nhất nghiệp vụ.

## 5. Việc cần chủ dự án quyết

1. Giai đoạn 6 làm sớm (ngay sau giai đoạn 2) hay sau SCORM. Phụ thuộc vào lúc nào cấp tài khoản cho giáo viên.
2. Vai trò giáo vụ được làm những gì: chỉ giao bài và xem báo cáo, hay cả soạn.
3. Lớp thật nào dùng thử đầu tiên sau `TEST-TH`.
4. Bài giảng ActivePresenter hiện có bao nhiêu, dung lượng mỗi gói: quyết định hạ tầng lưu ở giai đoạn 5.

## 6. Ngoài phạm vi

SCORM 2004, gói nhiều SCO, H5P, xAPI, tự chuyển PowerPoint trên máy chủ, bán khóa học, cổng thanh toán riêng,
huy hiệu, chạy Frappe song song.
