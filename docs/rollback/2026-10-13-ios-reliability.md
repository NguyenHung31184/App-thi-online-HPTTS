# Rollback nâng cấp iOS 2026-10-13

- Phạm vi: frontend exam-taking, shell, routes, HTML/CSS; không có migration hoặc sửa dữ liệu.
- Chưa deploy, chưa commit. Trước commit phải chỉ chọn các file của kế hoạch này, giữ riêng các thay đổi OCR đang có.
- Nếu bản triển khai có lỗi: đưa frontend về deployment trước đó; không rollback database.
- Với mã nguồn đã commit riêng: revert commit nâng cấp, rồi chạy build/tests/boundaries. Không dùng reset/clean toàn repo.
- Với mã nguồn chưa commit: xem diff từng file được ghi trong kế hoạch, hoàn tác đúng các hunk nâng cấp. Không ghi đè thay đổi của người dùng.
- Worker và frontend phải được deploy cùng bản build. Nếu Worker lỗi trên một thiết bị, ứng dụng có fallback; vẫn cần ghi nhận và điều tra thay vì đánh dấu nghiệm thu.
