# Nhật Ký Phát Triển — App Thi Online HPTTS

> Mỗi buổi làm việc thêm 1 mục mới ở **đầu file** (mới nhất lên trên).
> Format: ngày | đã làm | vấn đề gặp | kế hoạch tiếp theo

---

## 2026-10-05 | Đồ thi online vào Thùng rác của app quản lý

**Đã làm**
- Kỳ thi lý thuyết chuyển sang xóa mềm (trước xóa hẳn, mất luôn bài làm). Học viên, màn giám sát, trang tổng quan bỏ
  qua kỳ thi đã xóa: vá `start_exam_attempt`, `get_available_exam_windows`, `get_live_exam_monitor` bằng một phép thay
  có kiểm tra trong migration.
- Hàm `exam_trash_list`, `exam_trash_restore`, `exam_trash_hard_delete` (chỉ nhân viên) cho Thùng rác của app quản lý:
  đề thi, kỳ thi lý thuyết, mẫu đánh giá, ca chấm. Xóa vĩnh viễn được cả khi có điểm (quyết định của người vận hành);
  điểm đã sang bảng điểm và ảnh trong `exam-uploads` giữ nguyên.
- Test database 40/40. Chạy thử trên production rồi áp dụng `20261005090000`, `20261005091000` lúc không ai đang thi.

## 2026-10-04 | Admin tạo kỳ thi thực hành, Sổ chuyên cần chỉ chấm

**Đã làm**
- Quyết định của người vận hành: mẫu, tiêu chí và kỳ thi thực hành đều do admin tạo trên App thi; Sổ chuyên cần chấm
  theo đó; App quản lý theo dõi. Bản ẩn nút "Thêm kỳ thi" (chưa push) được thay bằng hướng này.
- Form "Thêm kỳ thi" tạo kỳ thi chấm tại sân (`teacher_grading`), bỏ ô mã truy cập (tự sinh). Tạo trùng lớp và mẫu bị
  từ chối bằng câu dễ hiểu.
- Sổ chuyên cần (repo riêng) hiện danh sách kỳ thi thay cho hai ô chọn lớp và đề.
- Edge trên bản local: tạo trùng bị từ chối; tạo kỳ thi lớp thử với mẫu xe nâng container thì hiện ngay trên Sổ chuyên
  cần (kiểm luôn migration kỳ chấm chưa xóa); đã xóa mềm kỳ thi thử đó.
- Xóa mềm kỳ chấm lớp RTG Khóa 44 theo mẫu Khóa 43 (thử nghiệm, người vận hành yêu cầu xóa).

- Mục "Chấm thực hành" (luồng cũ: học viên nộp ảnh, giáo viên kéo thanh trượt, bấm đồng bộ tay) thay bằng "Kết quả thực
  hành", chỉ xem, tự cập nhật mỗi 10 giây như giám sát lý thuyết: tổng quan ca thi, từng học viên với trạng thái, điểm
  /100 và /10, đạt hay không, đã gửi TTDT chưa; trang chi tiết có điểm từng tiêu chí kèm lỗi đã trừ, thời gian chu kỳ,
  bảo hộ, lỗi loại, ảnh (URL ký), giám khảo. Bỏ trang chấm bằng thanh trượt vì lưu ở đó ghi đè kết quả đã khóa tại sân.
- Edge trên bản local với lớp thử: 3/3 xong, 1 đạt, 1 loại thi, 1 thiếu bảo hộ; chi tiết Học viên thử 1 đúng 94/100.

- Gỡ luồng "học viên tự chụp ảnh nộp bài" theo yêu cầu: màn `PracticalTakePage`, route `/practical/:attemptId`, khối
  "Thi thực hành đang mở" ở trang chủ học viên, `application/attempts.ts`, `data/attempt-repository.ts`, các hook và hàm
  domain chỉ luồng này dùng, `platform/storage/exam-uploads.ts`. RPC và test database giữ nguyên. `arch:score` 73,4%,
  38/46 route.

**Tiếp theo**: sửa ngày thi kỳ RTG Khóa 43 thành 09/10; thử phiếu chấm Word thật; diễn tập 08/10; thi 09/10.

## 2026-10-03 | Khung app theo bản mẫu, nhập mẫu đánh giá từ file

**Đã làm**
- Khung app theo bản mẫu chấm thi, giữ nhận diện HPTTS: nhóm menu viết thường tiếng Việt, mục đang chọn có vạch cyan,
  đầu trang có đường dẫn và chip thật (mạng, số điểm chờ gửi TTDT). Bỏ nhãn in hoa dãn chữ. Đăng xuất chỉ trên máy này.
- Nhập mẫu đánh giá từ Excel theo mẫu (4 sheet, tải trên trang nhập) hoặc Word phiếu chấm của trung tâm (bảng, khung
  thời gian, mục "Các lỗi vi phạm", bước đề xuất). Xem bản nháp và cảnh báo trước khi tạo.
- Đã push (`6b0a349`), CI đạt; Edge trên production: nút "Nhập từ file" và trang nhập có.
- Xóa mềm 3 kỳ chấm thực hành thừa do lỗi Sổ chuyên cần ngày 02/10 tạo ra.
- Nút Sửa, Xóa, Chấm bài ở Mẫu đánh giá, Kỳ thi thực hành và Tiêu chí thành icon như trang Đề thi lý thuyết
  (`src/shared/ui/IconAction.tsx`). Đã push (`5056c86`), Edge trên production: đủ nút, hộp xác nhận xóa vẫn mở.
- Bước thao tác trong trang soạn mẫu: bỏ, lên, xuống thành icon (`474dc28`).
- Chấm thử theo yêu cầu: tạo mẫu "THI THỬ – RTG (xóa sau)" từ file Excel mẫu, chấm Học viên thử 1 của lớp thử trên Sổ
  chuyên cần production (96/100, TTDT nhận 9,6), rồi xóa mềm kỳ chấm và mẫu.
- Migration `20261003120000_practical_session_unique_live` (`5065ee1`): kỳ chấm đã xóa mềm không chặn kỳ mới cùng lớp
  và mẫu. Chạy thử trên production, người vận hành đồng ý, đã áp dụng.

**Vấn đề gặp**: luật ranh giới không cho domain import `src/shared`, nên bộ đọc Word xuất qua `question-bank/public.ts`.
Danh sách lỗi đánh số bằng kiểu "List Number" của Word không mang số trong đoạn văn: đọc mọi đoạn của mục lỗi.

**Tiếp theo**: người vận hành thử phiếu chấm Word thật; giáo viên RTG xem lỗi trừ nhanh; diễn tập 08/10; thi 09/10.

## 2026-10-02 (tối) | Điểm TTDT tháng 3–4, nhật ký đồng bộ, thi thực hành chấm tại sân

**Đã làm**
- Bỏ nút "Dọn lỗi cũ (30 ngày)" (không có quyền xóa nên chưa từng xóa được). Gửi lại 66 bài tháng 3–4 TTDT đang trống
  điểm (6 bài TTDT có điểm khác giữ nguyên theo người vận hành); TTDT có đủ 66.
- Phát hiện và sửa `exam_sync_log.module_id` kiểu uuid: từ 29/09 mọi lần gửi lý thuyết ghi nhật ký lỗi và bị gửi lại
  liên tục. Migration `20261002160000` đã áp dụng; hàng đợi về thành công. Lịch `exam-maintenance` đang chạy mỗi phút.
- Thực hành chấm tại sân (Sổ chuyên cần): `practical_attempts.student_id`, trạng thái `not_eligible`, điểm đạt; tổng
  /100 gửi TTDT /10 (`20261003090000`). Mẫu đề có cấu hình chấm tại sân, mô-đun TTDT, xóa mềm (`20261003100000`).
  Đã tạo đề RTG Khóa 43 theo phiếu chấm. Đã push (`c103b7d`), CI đạt.
- Thử trọn luồng với lớp thử trong TTDT: 94/100 → 9,4; loại thi → 0 và phải thi lại; thiếu bảo hộ → không gửi.

**Vấn đề gặp**: chép phiên production sang app local làm mất phiên production (xoay refresh token). Sổ chuyên cần tự
đăng xuất toàn cục khi tải hồ sơ chậm (đã sửa bên Sổ chuyên cần).

**Tiếp theo**: giáo viên RTG xem lại lỗi trừ nhanh; diễn tập 08/10; xóa mềm lớp thử sau diễn tập. Ghi nhận: bucket
`exam-uploads` đang công khai và policy cho mọi tài khoản đọc toàn bộ; xử lý sau ngày thi.

## 2026-10-02 (chiều) | Modular monolith: file theo dõi tiến độ, giai đoạn 2

### Đã làm
- Push 1a, 1b (`ca8f136..4871f6d`, CI đạt) và file theo dõi `docs/MODULAR_MONOLITH_TIEN_DO.md` (`ce48a3d`): bảng
  giai đoạn, commit, lệnh rollback, việc còn mở.
- Giai đoạn 2, module `exam-reporting` (`e32affd` … bước 5): Dashboard admin, Báo cáo lý thuyết, trang kết quả một
  lượt thi; xóa `reportService`, `dashboardService`. Luật thuần vào `domain/` kèm 27 test (tổng 175).
- Kết quả: 54.3% mã nghiệp vụ trong module, 25/46 route, 5/10 tiêu chí.
- Kiểm tra trên Edge (bản local so với production, chỉ xem): dashboard giống hệt; 6 đề có số bài và số tín hiệu khớp;
  2 file Excel đúng tên sheet và cột; link bằng chứng AI mở được (ký mới); trang kết quả một lượt thi khớp điểm, 50 câu,
  ảnh lúc vào thi hiện.

### Vấn đề gặp
- Phiên đăng nhập production trong Edge hết hạn; người dùng đăng nhập lại.
- Lỗi có sẵn: tab "Tín hiệu giám sát" không lọc theo đề/kỳ thi và dừng ở 1.000 dòng (production cũng vậy). Đã sửa
  bằng `attempts!inner` và đọc theo trang; số trên Edge khớp đếm trực tiếp trong database (QC 170, đề lớn 2.276).

- Push giai đoạn 2 và bản sửa lọc tín hiệu (`2259f3f`, `e062e20`, CI đạt).
- Giai đoạn 3, module `practical-exams` (`c13ab5e` … bước 4): 3 service, 7 trang, adapter tải ảnh
  `src/platform/storage/`. 62.6% mã nghiệp vụ trong module, 34/46 route. Edge: các trang có dữ liệu giống production.
  Form thêm mẫu không còn mất con trỏ sau ký tự đầu.
- Cửa sổ Edge kiểm thử (cổng 9333) bị đóng; mở lại bằng hồ sơ cũ trong scratchpad, vẫn còn đăng nhập.

- Push giai đoạn 3 (`c040039`, CI đạt). Giai đoạn 4 (e-learning) hoãn theo quyết định của người dùng: stash
  E-LEARNING sửa đúng các file đó.
- Giai đoạn 5 (`b3e7341` … bước 5): `identity-access` (đăng nhập, vai trò, chặn quyền có test, CCCD) và `integrations`
  (đồng bộ TTDT, nhật ký, OCR). 72% mã nghiệp vụ trong module, 38/46 route, còn 3 service cũ. Edge: chặn quyền, F5,
  /start, /login, /verify-cccd, Nhật ký đồng bộ giống production.

### Kế hoạch tiếp theo
- Hỏi người dùng trước khi push giai đoạn 5 (ngoài giờ thi; đụng đăng nhập mọi người).
- Thử đăng nhập giáo viên và học viên thật sau khi push.
- Thử luồng thi thực hành trên dữ liệu thật khi người dùng đồng ý.
- Giai đoạn 6 (`exam-taking`) chỉ sau một buổi thi thử có giám sát AI ổn định.

---

## 2026-10-02 | Modular monolith: giai đoạn 0, 1a, 1b

### Đã làm
- Giai đoạn 0 (đã push `ca8f136`): luật ranh giới tầng, allowlist, điểm kiến trúc trong CI. Mốc 25.3%, 4/10 tiêu chí.
- 1a (`c8c9682`): bỏ trang thêm/sửa/nhập câu hỏi theo đề; chi tiết đề đếm câu trong ngân hàng của mô-đun.
- 1b (`5578bd7` … `ad99cd0`): module `exam-management` (data, application, queries, 6 trang ui), module `integrations`
  (danh bạ TTDT), `shared/ui`; xóa 4 service trung gian. Quy tắc thuần vào `domain/` kèm test (148 test).
- Kết quả: 43.6% mã nghiệp vụ trong module, 22/46 route do module sở hữu, 5/10 tiêu chí.
- Kiểm tra trên Edge (bản local, chỉ xem): danh sách đề, chi tiết, kiểm tra ngân hàng, sửa đề, danh sách kỳ thi,
  form sửa kỳ thi (nạp đúng dữ liệu), form tạo kỳ thi; không có lỗi trang.

### Vấn đề gặp
- Xóa kỳ thi và "Xóa báo cáo thi thử" vẫn là xóa cứng; giữ nguyên khi chuyển code, chờ quyết định.

### Kế hoạch tiếp theo
- Hỏi người dùng trước khi push các commit 1a, 1b.
- Bảng giám sát: ưu tiên lượt đang làm (phần giám sát AI đã commit ở `0267b37`).
- Giai đoạn 2 theo kế hoạch.

---

## 2026-10-01 | Thi thử trên production, sửa lỗi vào lại tạo lượt mới

### Đã làm
- Thi thử (30/09) với học viên thử `hv100228`, lớp FL-K103, đề QC (đã khóa theo đồng ý của người dùng), kỳ thi thử TD30.
  Luồng: đăng nhập → xác thực CCCD nhập tay → vào thi → chụp bàn làm việc, khuôn mặt (người dùng trước webcam).
- Worker `exam-maintenance` tự chốt lượt quá giờ trên production (lần chạy 23:05:00, `finalized: 1`); thi thử không tạo
  việc đồng bộ.
- Bảng giám sát hiện đúng thẻ học viên (đã hủy bài, lần thi, vi phạm).
- Sửa: vào lại kỳ thi bằng mã giờ làm tiếp lượt đang mở (`8b32bfb`, migration `20260930160000` đã áp dụng sau chạy thử);
  thử lại 01/10 với kỳ thi thử TD01: hai lần vào cùng lượt `2a50b880…`, chỉ 1 lượt.
- Dọn: xóa mềm học viên thử và ghi danh, đóng kỳ thi thử TD01 (TD30 đã hết giờ), xóa file mật khẩu tạm.

### Vấn đề gặp
- Camera laptop bị tắt quyền riêng tư (hình ổ khóa) → không thấy mặt; bật lại thì chạy.
- Bản đang chạy hủy bài sau 16 lần "không thấy mặt" trong 35 giây; người dùng đang sửa chính sách giám sát AI (chưa commit).
- Tài khoản thi `hv100228` vẫn còn (học viên đã xóa mềm, file mật khẩu đã xóa).

### Kế hoạch tiếp theo
- Người dùng hoàn thiện giám sát AI; sau đó bảng giám sát ưu tiên lượt đang làm khi một học viên có nhiều lượt.
- Thi thử lại khi giám sát AI mới đã lên production.

---

## 2026-09-28 | Bỏ 2 biểu đồ, giữ thứ tự phương án, nhập đề từ Word

### Đã làm
- Bỏ "Phân phối điểm số" và "Top đề thi" ở dashboard (`8fa4af0`).
- Câu có phương án kiểu "Đáp án a, b đúng", "Tất cả các ý trên" không còn bị đảo; mọi phương án trắc nghiệm hiện chữ
  a), b), c) (`cadcb58`). 105/1.194 câu trong ngân hàng được giữ thứ tự.
- Nhập đề từ Word .docx ngay trên trình duyệt (`b8437de`): đáp án theo chữ đỏ / tô nền / in đậm / gạch chân (chọn theo
  file, máy đề xuất), dòng "Đáp án:", bảng đáp án cuối file; ảnh tách khỏi file và gắn đúng câu, có ảnh thu nhỏ khi xem
  trước; câu nghi ngờ lưu ở Bản nháp kèm ghi chú. Thử trên production với file ĐẾ (134 câu, 13 câu có ảnh) rồi xóa mềm.

### Vấn đề gặp
- File của trung tâm trình bày nhiều kiểu: cả câu trong một đoạn có xuống dòng mềm, "Câu 46" dính cuối phương án của
  câu 45, gõ nhầm "Cây 13.", cùng câu hỏi khác đáp án (ĐẾ câu 28/40/76, 32/62). Bộ đọc báo lỗi hoặc đánh dấu xem lại.
- Một số file không có đáp án (Forklift, NH Cont, Lái xe ô tô 3–4); 24 file .doc cũ phải lưu lại thành .docx.

### Kế hoạch tiếp theo
- Tạo thư viện cho cần trục chân đế và các nghề còn thiếu rồi nhập thật; sửa các câu lỗi trong file Word.
- Tổng duyệt thi thử (còn dở từ trước), báo cáo thi thực hành, PDF/ảnh chụp sau.

---

## 2026-09-28 | Thứ tự việc mới, bỏ màn chấm tự luận

### Đã làm
- Người dùng chốt: giám sát thi trực tuyến làm tiếp (thay "Bài làm gần đây" ở dashboard, nhóm theo lớp, 5–10
  học viên/lớp, người cần chú ý lên đầu, tín hiệu kết nối 20 giây, làm mới 15 giây); nhập đề Word và báo cáo thực hành
  để sau.
- Bỏ menu, route và trang "Chấm tự luận": `grade_attempt` đã chấm câu tự luận theo key.
- Giám sát thi trực tuyến: migration `20260928120000` (cột `last_seen_at`, `touch_attempt`, `get_live_exam_monitor`)
  chạy thử trên production đạt; trang làm bài gửi tín hiệu 20 giây; module `exam-monitoring` (nhóm theo lớp, 8 học
  viên đầu, người cần chú ý lên đầu, tự làm mới 15 giây) thay "Bài làm gần đây" ở dashboard. Người dùng duyệt:
  chạy migration rồi push.
- Bảng giám sát đổi sang thẻ theo ảnh mẫu người dùng gửi (tab theo lớp, lưới 3 cột, 6 thẻ/tab, bỏ "Nhận xét"); migration
  `20260928150000` trả thêm điểm và lần thi (chạy thử rồi chạy thật). 45 test đạt.
- Kết nối Supabase MCP mất giữa buổi; dùng `npx supabase db query --linked` thay thế.

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

- Người dùng đồng ý sửa: nút "Khóa đề thi" giờ kiểm tra ngân hàng câu hỏi của mô-đun theo đúng quy tắc hàm bốc đề
  (`docs/implementation/2026-09-26-lock-exam-checks-question-bank.md`). 21 tình huống mẫu đạt; SQL chỉ đọc cho thấy
  cả 7 đề (kể cả QC) sẽ khóa được. `e638b88`, đã push (người dùng: "Push đi, tôi sẽ khóa đề").

### Kế hoạch tiếp theo
- Người dùng tự khóa từng đề trước kỳ thi (đề nào chưa khóa thì học viên không vào được).

### Việc nhỏ (người dùng: "làm các việc nhỏ trước đi")
- Thêm Vitest 4.1.11 (`npm test`) và CI GitHub (ranh giới, lint, test, build). Test đầu tiên: 21 tình huống của hàm
  kiểm tra khi khóa đề, 11/11 đạt. `docs/implementation/2026-09-26-vitest-and-ci.md`.
- Chặn route giáo viên: `/admin` chỉ khớp chính nó, không còn là tiền tố mở mọi trang admin (`src/utils/adminAccess.ts`,
  24 test đường dẫn). Chưa thử trên trình duyệt vì chưa có tài khoản giáo viên.
- Điểm QTHH-AT cũ: 2 học viên phía trượt đã thi lại và đạt trong ngày (app quản lý lưu điểm đạt); tính lại chỉ đổi 1
  kết quả đạt. Người dùng chọn giữ nguyên điểm, đóng mục này trong ledger.
- Push `d502acc`, `5305972` (người dùng: "Push ngay").

### Giao diện theo nhận diện HPTTS (người dùng: "Toàn app, trước tổng duyệt")
- Theo `QuanltTTDT-HPTTS/DESIGN.md`: `indigo-*` trỏ sang dải `brand` theo vai trò (như app quản lý), `slate-*` sang `gray`,
  font Arial; logo chuẩn ở trang đăng nhập và đầu thanh bên; thanh bên `brand-900` phẳng; bỏ 22 gradient, bóng phát
  sáng, chấm nhấp nháy; nhãn trên dải màu đầu thẻ dời vào thân thẻ; nút cảnh báo vi phạm đủ tương phản.
- Thiếu file từ đơn vị thiết kế: favicon, logo âm bản, dải Tín – Tâm – Trí, font chính.

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
