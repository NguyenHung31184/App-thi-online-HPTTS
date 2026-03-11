-- Đổi kiểu cột module_id của bảng exams sang text
-- để lưu mã mô-đun dạng 'm07', 'm08', ... giống question_bank.module_id

alter table public.exams
  drop constraint if exists exams_module_id_fkey;

alter table public.exams
  alter column module_id type text using module_id::text;

