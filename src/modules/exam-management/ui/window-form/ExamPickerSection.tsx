import { useState } from 'react';
import { examOptionLabel, type ExamChoice } from '../../domain/window-form';

interface ExamPickerSectionProps {
  isEdit: boolean;
  exams: ExamChoice[];
  useMultiExams: boolean;
  onUseMultiExamsChange: (value: boolean) => void;
  examId: string;
  onExamIdChange: (value: string) => void;
  selectedExamIds: string[];
  onSelectedExamIdsChange: (ids: string[]) => void;
  titlesWithoutModule: string[];
}

const hasNoModule = (exam: ExamChoice | undefined) => !exam?.module_id || String(exam.module_id).trim() === '';

/** One exam, or a list the student is dealt one of at random. Create and edit keep their own wording. */
export function ExamPickerSection({
  isEdit,
  exams,
  useMultiExams,
  onUseMultiExamsChange,
  examId,
  onExamIdChange,
  selectedExamIds,
  onSelectedExamIdsChange,
  titlesWithoutModule,
}: ExamPickerSectionProps) {
  const [addExamSelect, setAddExamSelect] = useState('');
  const hasMissingModule = titlesWithoutModule.length > 0;

  const addExam = () => {
    if (addExamSelect && !selectedExamIds.includes(addExamSelect)) {
      onSelectedExamIdsChange([...selectedExamIds, addExamSelect]);
      setAddExamSelect('');
    }
  };

  return (
    <div>
      <span className="block text-sm font-medium text-slate-700 mb-2">Chế độ đề thi</span>
      <div className={`flex gap-4 ${isEdit ? 'mb-2' : 'mb-5'}`}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="examMode" checked={!useMultiExams} onChange={() => onUseMultiExamsChange(false)} className="text-indigo-600" />
          <span>Một đề</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="examMode" checked={useMultiExams} onChange={() => onUseMultiExamsChange(true)} className="text-indigo-600" />
          <span>{isEdit ? 'Nhiều đề (quay 1 trong N)' : 'Nhiều đề (quay 1 trong N — thí sinh vào thi được gán ngẫu nhiên 1 đề)'}</span>
        </label>
      </div>

      {!useMultiExams ? (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Đề thi *</label>
          <select value={examId} onChange={(e) => onExamIdChange(e.target.value)} required className="w-full border border-slate-300 rounded-lg px-3 py-2">
            <option value="">— Chọn đề —</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>{examOptionLabel(exam)}</option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">Nếu tiêu đề giống nhau, dùng thêm mô tả (— Mô tả) để phân biệt.</p>
        </div>
      ) : (
        <div>
          {!isEdit && (
            <>
              <label className="block text-sm font-medium text-slate-700 mb-1">Danh sách đề (quay 1 trong N) *</label>
              <p className="text-xs text-slate-500 mb-2">Thí sinh vào thi sẽ nhận ngẫu nhiên một trong các đề dưới đây.</p>
            </>
          )}
          <div className="flex flex-wrap gap-2 mb-2">
            <select
              value={addExamSelect}
              onChange={(e) => setAddExamSelect(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 min-w-[200px]"
            >
              <option value="">— Thêm đề —</option>
              {exams
                .filter((exam) => !selectedExamIds.includes(exam.id))
                .map((exam) => (
                  <option key={exam.id} value={exam.id}>{examOptionLabel(exam)}</option>
                ))}
            </select>
            <button
              type="button"
              onClick={addExam}
              disabled={!addExamSelect}
              className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50"
            >
              Thêm
            </button>
          </div>
          <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {selectedExamIds.map((id) => {
              const exam = exams.find((e) => e.id === id);
              const description = (exam?.description ?? '').trim();
              return (
                <li key={id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-slate-800">
                    <span className="block">{exam?.title ?? id}</span>
                    {description && <span className="block text-xs text-slate-500 mt-0.5">{description}</span>}
                    {hasNoModule(exam) && (
                      <span
                        className="ml-0 mt-1 inline-block text-amber-600 font-medium text-xs"
                        title={isEdit ? 'Chưa gắn mô-đun' : 'Chưa gắn mô-đun — đồng bộ TTDT sẽ lỗi'}
                      >
                        (chưa mô-đun)
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectedExamIdsChange(selectedExamIds.filter((other) => other !== id))}
                    className="text-red-600 hover:text-red-700 text-sm shrink-0 ml-2"
                  >
                    Xóa
                  </button>
                </li>
              );
            })}
            {selectedExamIds.length === 0 && (
              <li className="px-3 py-4 text-slate-500 text-sm">
                {isEdit ? 'Chưa có đề nào.' : 'Chưa thêm đề nào. Chọn đề ở dropdown trên rồi bấm Thêm.'}
              </li>
            )}
          </ul>
          {selectedExamIds.length > 0 && (
            <div className="mt-2 rounded-lg border p-3 text-sm bg-slate-50 border-slate-200">
              {isEdit ? (
                <>
                  <p className="font-medium text-slate-700">Đồng bộ điểm TTDT</p>
                  <p className="text-slate-600 mt-1">Mọi đề trong danh sách phải đã gắn mô-đun. Nếu thiếu, thí sinh quay trúng đề đó sẽ bị báo lỗi sau khi nộp bài.</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-slate-700">Lưu ý đồng bộ điểm TTDT</p>
                  <p className="text-slate-600 mt-1">
                    Thí sinh vào thi sẽ được gán ngẫu nhiên một trong các đề trên. Để điểm đồng bộ sang TTDT không lỗi, <strong>mọi đề trong danh sách phải đã gắn mô-đun</strong> (vào Đề thi → Sửa từng đề → chọn Mô-đun → Cập nhật).
                  </p>
                </>
              )}
              {hasMissingModule && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded text-amber-800">
                  {isEdit ? (
                    <>
                      <p className="font-semibold">Chưa thể cập nhật</p>
                      <p className="mt-1">Các đề chưa mô-đun: <strong>{titlesWithoutModule.join(', ')}</strong>. Vào Đề thi → Sửa từng đề → chọn Mô-đun rồi quay lại.</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">Không thể lưu kỳ thi</p>
                      <p className="mt-1">Các đề sau chưa gắn mô-đun: <strong>{titlesWithoutModule.join(', ')}</strong></p>
                      <p className="mt-1 text-sm">Vui lòng vào <strong>Đề thi</strong> → Sửa từng đề trên → chọn <strong>Mô-đun</strong> → Cập nhật, rồi quay lại trang này để lưu kỳ thi.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
