# Question import worker

Worker chạy riêng khỏi Vercel để đọc DOCX, PDF và ảnh có bố cục phức tạp.

Biến môi trường cần có: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `QUESTION_IMPORT_WORKER_TOKEN`.

Vercel gọi worker qua `QUESTION_IMPORT_WORKER_URL` và cùng token. Worker chỉ tạo bản nháp; người dùng phải rà soát trước khi câu hỏi được phát hành.
