# Exam taking

Module này sở hữu luồng vào thi lý thuyết, dữ liệu bài làm đang mở và các RPC P0.

- `data/` là nơi duy nhất của lát P0 gọi Supabase RPC/query.
- `application/` công bố các use case không phụ thuộc React.
- `queries/` chứa React Query key và hooks.
- `public.ts` là API duy nhất cho route hoặc module khác.

Các service cũ còn lại là facade tạm thời cho những màn quản trị chưa chuyển.
