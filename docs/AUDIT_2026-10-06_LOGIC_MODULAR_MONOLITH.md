# Rà soát logic và modular monolith ngày 06/10/2026

## Kết luận

Dự án có phần lớn chức năng thi lý thuyết và quản trị, nhưng chưa thể kết luận hoàn thiện toàn bộ. Còn sai lệch kết quả giữa các màn hình, xem lại bài không theo snapshot, cấu hình tự luận có thể không chấm được và lỗi migration tái lập được.

Mức tách modular monolith đo bằng công cụ của repo là **73,5% dòng mã nghiệp vụ**, **38/46 route (82,6%)**, **5/10 tiêu chí (50%)**. Ba số này đo ba khía cạnh khác nhau, không cộng hoặc lấy trung bình thành một phần trăm chất lượng. Chưa đạt mục tiêu 90% route và 85% mã nghiệp vụ trong module.

Không gán phần trăm hoàn thiện tính năng vì chưa có bộ acceptance criteria được chốt và chưa chạy nghiệm thu với tài khoản, camera, database và TTDT thật.

## Phạm vi và kiểm tra

- Đọc source frontend, API, server đồng bộ, migration, test và tài liệu thay đổi gần đây.
- Rà soát bản làm việc hiện tại, bao gồm thay đổi chưa commit ở OCR và module e-learning. Kết quả không nhất thiết trùng bản đã triển khai.
- `npm.cmd test`: **27 file, 223 test đạt**.
- `npm.cmd run build`: đạt cả TypeScript và Vite; Vite cảnh báo chunk lớn, gồm các chunk khoảng 733 KB, 976 KB, 1.542 KB sau minify.
- `npm.cmd run lint`: 0 lỗi, 1 cảnh báo dependency của effect retry đồng bộ ở `src/pages/ExamResultPage.tsx:131`.
- `npm.cmd run check:boundaries`: đạt, vẫn có 3 ngoại lệ import và 27 file legacy được cho phép.
- `npm.cmd run arch:score`: 16.128/21.931 dòng nghiệp vụ trong module; 38/46 route; 3 service legacy, 437 dòng.
- Tái lập riêng lỗi migration xóa mềm bằng PGlite trong bộ nhớ. Không sửa source ứng dụng hoặc database thật.
- Chưa kiểm tra production, chưa kiểm chứng toàn bộ migration trên schema TTDT thật, chưa chạy browser end-to-end hoặc tải đồng thời.

## Phát hiện theo ưu tiên

### 1. P1: Quy tắc Đạt/Chưa đạt không thống nhất

**Đã xác nhận qua code và test hiện có.**

- `src/pages/ExamResultPage.tsx:162`: làm tròn điểm thô và ngưỡng trước khi so sánh.
- `src/modules/exam-reporting/domain/attempt-review.ts:174`: trang quản trị dùng cùng quy tắc làm tròn.
- `src/pages/StudentResultsPage.tsx:76`: danh sách học viên so sánh tỷ lệ điểm gốc với ngưỡng.
- `src/modules/exam-reporting/domain/report-rows.ts`, hàm `isPassed`: báo cáo so sánh tỷ lệ gốc.
- `server/exam-sync.ts`, trường `payload.passed`: TTDT nhận kết luận theo tỷ lệ gốc.

Ví dụ `raw_score=69.6`, `total_max=100`, `score=0.696`, `pass_threshold=0.7`: chi tiết hiện Đạt; danh sách, báo cáo và payload TTDT kết luận Chưa đạt. Test `attempt-review.test.ts` hiện còn khẳng định 69,6 là đạt, nên toàn bộ test xanh không phát hiện được sai lệch liên màn hình này.

**Đề xuất:** chốt quy tắc nghiệp vụ duy nhất và dùng chung giữa các màn hình/backend; làm tròn hiển thị tách khỏi quyết định đạt. Thêm kiểm tra hợp đồng cho điểm sát ngưỡng và bài bị đình chỉ. Danh sách học viên cũng cần kiểm tra `disqualified`, hiện chỉ kiểm tra điểm.

### 2. P1: Xem lại bài sử dụng ngân hàng hiện tại thay vì đề đã cấp

**Đã xác nhận qua đường đọc dữ liệu.**

`src/modules/exam-reporting/application/attempt-result.ts:41` gọi `selectBankQuestions`; `data/attempt-result-repository.ts:37` đọc trực tiếp `question_bank` gồm nội dung, khóa đáp án, điểm. Trong khi đó chấm server dùng `exam_private.attempt_papers` chụp tại thời điểm tạo attempt.

Sửa nội dung hoặc đáp án ngân hàng sau khi cấp bài sẽ giữ đúng điểm tổng nhờ snapshot, nhưng màn xem lại có thể hiển thị nội dung/đáp án mới, hoặc thiếu câu nếu hàng bị xóa cứng. Điều này gây khó đối chiếu khi khiếu nại kết quả.

**Đề xuất:** RPC dành cho người có quyền xem lại trả snapshot của attempt và điểm từng câu, gồm khóa đáp án chỉ sau khi được phép; không cấp quyền đọc trực tiếp schema riêng tư cho browser.

### 3. P1: Có thể phát hành câu tự luận không có khóa chấm

**Đã xác nhận qua validator, luồng khóa đề và SQL chấm.**

- `src/modules/question-bank/domain/question-draft.ts:278`: keys rỗng tạo `answer_key=''`; draft mới mặc định published.
- `question-validation.ts`: chấp nhận tự luận có khóa trống với giải thích rằng có thể chấm tay.
- `exam-management/application/manage-exams.ts`: kiểm tra đủ ngân hàng theo blueprint, không kiểm tra khóa chấm tự luận.
- `20260929090000_atomic_exam_submission.sql`, nhánh `main_idea/video_paragraph`: chỉ ghi điểm khi có khóa và câu trả lời phù hợp; điểm tối đa vẫn tính cả câu.
- `docs/implementation/2026-09-28-remove-essay-grading-screen.md`: màn chấm tay đã bị gỡ theo yêu cầu trước đây.

Kết quả: câu không có keys có thể vào đề và bị tính 0 khi nộp mà không có luồng UI chấm bù. Không coi việc gỡ màn chấm tay là lỗi; lỗi nằm ở cấu hình phát hành chưa được điều chỉnh theo quyết định đó.

**Đề xuất:** chặn published/khóa đề nếu tự luận thiếu khóa hợp lệ. Chấm theo tìm chuỗi từ khóa hiện chỉ phù hợp rubric đã chốt, không bảo đảm hiểu nghĩa hoặc phát hiện câu phủ định.

### 4. P1: Migration xóa mềm không chạy được với định nghĩa trước đó trong repo

**Đã tái lập bằng PGlite.**

`supabase/migrations/20261005090000_exam_window_soft_delete.sql:22` tìm chuỗi nguyên văn `WHERE auth.uid() IS NOT NULL AND ew.start_at`. Định nghĩa `get_available_exam_windows` trong `20260920100000_p0_secure_exam_attempts.sql` có xuống dòng trước `AND`, nên `pg_get_functiondef` không chứa chuỗi cần thay.

Tái lập: tạo bảng phụ thuộc tối thiểu trong PGlite, nạp nguyên định nghĩa `get_available_exam_windows` từ migration cũ, rồi chạy migration xóa mềm. Kết quả:

```text
exam_window_soft_delete: public.get_available_exam_windows() no longer contains the expected text
```

Test database hiện không nạp định nghĩa đầy đủ của hàm này, nên bước patch bỏ qua hàm không tồn tại và test vẫn xanh. Đây là lỗi khả năng dựng lại môi trường từ repo; chưa chứng minh production đang lỗi vì định nghĩa production có thể khác.

**Đề xuất:** migration sửa tiếp theo định nghĩa rõ hàm hoặc patch không phụ thuộc khoảng trắng; bổ sung kiểm tra upgrade từ schema thực tế. Không sửa lịch sử migration đã áp dụng trên production.

### 5. P1 cần kiểm chứng database chung: Liên kết CCCD chưa được bảo đảm trọn vẹn ở server

**Đường code đã xác nhận; khả năng khai thác phụ thuộc policy/trigger ở database TTDT chung.**

- `api/verify-cccd-for-exam.ts` xác thực token nhưng chuyển tiếp `req.body`, kể cả email tài khoản do client cung cấp; API trong repo không tự lưu kết quả xác minh vào profile.
- `identity-access/application/session.ts:53` lưu session hiển thị rồi gọi `updateMyStudentId(...).catch(() => {})` mà không chờ kết quả.
- `identity-access/data/profile-repository.ts:22` browser cập nhật `profiles.student_id` trực tiếp.
- Policy `Users update own profile` trong migration `003_rls_policies.sql` ràng buộc chủ hàng, không giới hạn riêng trường student_id/role. Repo này không chứa đầy đủ cơ chế bảo vệ profile của hệ thống dùng chung.

Nếu cập nhật bị chặn/lỗi, UI vẫn báo xác thực thành công nhưng server RPC có thể không nhận đúng học viên. Nếu database cho phép tự đổi student_id mà không có kiểm chứng, quyền theo lớp và danh tính đồng bộ có thể bị sai. Không kết luận có lỗ hổng production khi chưa đọc policy/trigger hiện hành.

**Đề xuất:** dùng email lấy từ token trên server; server kiểm chứng và liên kết học viên trước khi trả thành công; chặn sửa các trường danh tính/quyền nhạy cảm trực tiếp từ client; kiểm tra cả insert/update policy và trigger của profiles ở TTDT.

### 6. P2: Bộ đếm vi phạm trình duyệt mất khi tải lại trang

**Đã xác nhận qua state/ref.**

`src/pages/ExamTakePage.tsx:672` đặt `violationCountRef.current=0` khi mở attempt, không khôi phục số lần blur/ẩn tab/thoát fullscreen từ server. Học viên có thể tải lại trang sau 1–2 lần để bộ đếm bắt đầu lại. Audit vẫn có thể giữ lịch sử, nhưng quy tắc tự nộp sau 3 lần không tồn tại bền vững xuyên phiên. Chính sách AI có RPC/state bền vững riêng, không nên đánh đồng hai nhóm.

**Đề xuất:** server ghi và đếm nhóm vi phạm theo attempt, gộp sự kiện trùng; trang chỉ hiển thị quyết định của server. Thử tải lại, mở hai tab, mất mạng và quay lại bài.

### 7. P2: Kết quả lịch sử thay đổi theo cấu hình hiện tại

**Đã xác nhận qua nguồn dữ liệu đọc.**

`server/exam-sync.ts` lấy `module_id`, lớp và ngưỡng đạt từ exam/window/template hiện tại. Báo cáo cũng đọc cấu hình hiện tại. Snapshot lý thuyết giữ câu hỏi/deadline nhưng chưa giữ toàn bộ hợp đồng kết quả đó. Sửa ngưỡng đạt hoặc gắn lại module trước retry có thể đổi payload/kết luận của bài cũ.

Thực hành: `practical-exams/application/results.ts` đọc tiêu chí hiện tại qua `selectCriteria`; repository lọc `is_deleted=false`. Xóa mềm tiêu chí sau chấm vẫn giữ hàng điểm nhưng tiêu chí đó biến mất khỏi chi tiết kết quả. Đổi điểm tối đa/tên/rubric cũng đổi cách diễn giải bài lịch sử.

**Đề xuất:** snapshot/version đề và mẫu thực hành, lưu danh tính đích đồng bộ/ngưỡng đạt theo bài; đọc cả tiêu chí đã được dùng để chấm, kể cả tiêu chí đã nghỉ dùng.

### 8. P2: Tự kết thúc bài quá hạn phụ thuộc cấu hình đồng bộ TTDT

**Đã xác nhận qua API.**

`api/exam-maintenance.ts:16` trả 503 khi thiếu URL/key TTDT trước khi gọi `finalize_expired_exam_attempts`. Nếu cấu hình đồng bộ thiếu, chức năng kết thúc bài quá hạn cũng không chạy dù Supabase còn hoạt động.

Repo có script `scripts/schedule-exam-maintenance.sql` dùng pg_cron/Vault; chưa kiểm chứng lịch này đang cài và chạy trong production. Không có lịch Vercel trong `vercel.json` không đồng nghĩa không có scheduler.

**Đề xuất:** tách điều kiện cấu hình finalize và delivery, giám sát last-run/job backlog. Nghiệm thu đóng browser trước hạn và kiểm tra server tự hoàn thành bài.

### 9. P2: E-learning chưa nối UI với API versioned mới

`src/modules/elearning/README.md` xác nhận catalog/player vẫn dùng service cũ; module mới có API theo phiên bản nhưng chưa tích hợp giao diện. Tài liệu cảnh báo nguồn cũ bị ẩn đối với lớp được giao snapshot, nên phải nối UI trước khi bật giao phiên bản cho lớp thật. SCORM và báo cáo e-learning chưa triển khai.

### 10. P3: Tài liệu và kiểm tra kiến trúc chưa đại diện đầy đủ trạng thái thực

README và tổng kết tính năng còn nhắc chấm tự luận, học viên nộp ảnh thực hành, xóa cứng, API key phía client, trong khi nhiều phần đã đổi. Không dùng các tài liệu này làm bằng chứng chức năng còn thiếu/đã hoàn thành.

Bộ đo kiến trúc chỉ quét `src`, không đo ranh giới `api`, `server`, SQL hoặc worker. Có test trong mỗi module không đồng nghĩa đủ độ bao phủ. CI chỉ in score, không chặn điểm thấp. Boundary pass hiện vẫn chấp nhận ngoại lệ/legacy.

## Trạng thái các nhóm tính năng

| Nhóm | Đánh giá theo source hiện tại |
|---|---|
| Đề thi, kỳ thi, ngân hàng | Có CRUD, blueprint, khóa đề, bốc câu chống trùng, Excel/ZIP/Word, xóa mềm; cần chặn cấu hình tự luận lỗi và xác minh migration |
| Thi lý thuyết | Có quyền server, mã truy cập/rate limit, resume, timer, autosave, nộp/chấm nguyên tử; cần thử browser/mobile/mất mạng thực tế |
| Loại câu hỏi | Đã có UI và nhánh chấm cho single/multiple choice, kéo thả, đúng-sai, matching, tự luận/video; tài liệu nói kéo thả chưa làm đã cũ |
| Giám sát | Có ảnh, AI, sự việc/risk score, xem bằng chứng, live monitoring; bộ đếm rời tab cần bền vững |
| Kết quả/báo cáo | Có màn học viên, quản trị, lọc/xuất báo cáo; còn sai lệch ngưỡng đạt và nguồn dữ liệu review |
| TTDT | Có proxy server, canonical payload, outbox, lease, retry và log; cần kiểm chứng scheduler và tiếp nhận thật |
| Thực hành | App này soạn mẫu/tiêu chí/kỳ thi và xem kết quả; chấm hiện trường ở Sổ chuyên cần, không phải chức năng chấm đầy đủ trong repo này |
| Học viên tự nộp ảnh thực hành | Đã bỏ có chủ đích ngày 04/10; không tính là việc chưa hoàn thiện |
| Kết quả thực hành cho học viên | Chưa có route trong khu học viên; trang hiện tại là khu quản trị. Chỉ cần bổ sung nếu thuộc yêu cầu sản phẩm |
| E-learning | Nền API module mới có, UI còn legacy/chưa tích hợp versioned learning |

## Phần kiến trúc còn thiếu

| Tiêu chí | Kết quả |
|---|---|
| >=85% mã nghiệp vụ trong module | Chưa đạt: 73,5% |
| >=90% route nghiệp vụ qua public.ts | Chưa đạt: 82,6% |
| Supabase chỉ trong data/platform | Chưa đạt: 6 file ngoài tầng |
| Module gọi nhau qua public.ts | Đạt theo checker |
| Domain độc lập | Đạt theo checker |
| UI module không gọi data/Supabase | Đạt theo checker |
| Không còn services cũ | Chưa đạt: 3 file |
| pages chỉ là shell | Chưa đạt: 9/10 trang còn nghiệp vụ |
| Mỗi module có unit test | Đạt tiêu chí hiện diện, không phải coverage |
| CI chạy boundary và score | Đạt, score chưa có ngưỡng chặn |

Sáu file gọi Supabase ngoài data/platform: `pages/ExamResultPage.tsx`, `pages/LessonPlayerPage.tsx`, `pages/StudentResultsPage.tsx`, `services/attemptService.ts`, `services/elearningStudyService.ts`, `services/examUploadService.ts`.

## Thứ tự hoàn thiện đề nghị

1. Thống nhất kết luận đạt, khóa chấm tự luận, snapshot xem lại; bổ sung kiểm tra hợp đồng liên màn hình và backend.
2. Sửa khả năng upgrade migration, kiểm chứng bảo vệ profile và scheduler trên schema TTDT dùng chung.
3. Thử một ca thi thử đủ vai trò: đăng nhập/xác minh, bốc đề, camera, tải lại, mất mạng, trả lời sát hạn, nộp trùng, tự hết hạn, xem lại, đồng bộ và retry.
4. Tách luồng làm bài/AI vào `exam-taking`; chuyển player và catalog sang e-learning mới khi được triển khai.
5. Dọn services, pages và ngoại lệ; cập nhật tài liệu; đặt ngưỡng CI theo kế hoạch. Đo lại thay vì tuyên bố đạt 90% chỉ vì đã di chuyển file.

Kiểm thử frontend không thay thế kiểm thử database; test database chọn lọc hiện tại không thay thế upgrade toàn bộ migration trên schema tương ứng. Báo cáo này chưa xác nhận số lượng người thi đồng thời hoặc readiness của production.
