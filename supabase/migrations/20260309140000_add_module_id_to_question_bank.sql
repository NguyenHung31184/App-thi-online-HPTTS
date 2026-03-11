-- Thêm cột module_id (kiểu text) để gắn câu hỏi ngân hàng với học phần/mô-đun từ TTDT.
-- Dùng text để khớp với modules.id (ví dụ: 'm07', 'm08', ...).

alter table public.question_bank
  add column if not exists module_id text;

