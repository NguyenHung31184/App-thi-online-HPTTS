# Exam taking

Module này sở hữu luồng vào thi lý thuyết, dữ liệu bài làm đang mở và các RPC P0.

- `data/` là nơi duy nhất của lát P0 gọi Supabase RPC/query.
- `application/` công bố các use case không phụ thuộc React.
- `queries/` chứa React Query key và hooks.
- `public.ts` là API duy nhất cho route hoặc module khác.

Không còn facade trong `src/services`. Route trang chủ, hướng dẫn và làm bài được xuất qua `public.ts`.

- `application/load-session.ts` kiểm tra chủ bài và tải câu hỏi/thời hạn; `upload-exam-file.ts` nén ảnh trước khi gọi adapter Edge.
- `queries/use-exam-session.ts` điều phối camera, fullscreen, lưu bài, heartbeat, vi phạm và nộp bài.
- `domain/session-paper.ts` giữ thứ tự câu ổn định khi tải lại và tính trạng thái câu đã trả lời.
- `ui/session/ExamTakePage.tsx` hiển thị trạng thái; `TheoryQuestionList.tsx` render các loại câu hỏi.
- `ui/proctoring` chứa camera bằng chứng và giám sát trong lúc thi. Module `exam-monitoring` sở hữu màn theo dõi của giám thị.

Kiểm tra ranh giới bằng `npm run check:boundaries`; CI chặn hồi quy kiến trúc qua `npm run arch:score -- --check`.
