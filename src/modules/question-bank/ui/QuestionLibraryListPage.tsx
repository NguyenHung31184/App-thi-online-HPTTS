import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../../contexts/AuthContext';
import { useCreateQuestionLibrary, useModuleOptions, useOccupationOptions, useQuestionLibraries } from '../queries/use-question-library';
import { errorMessage, focusRing, libraryCourse, moduleLabel } from './labels';
import { BackLink, EmptyState, ErrorState, LoadingState } from './states';

const fieldClass = `mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100 ${focusRing}`;

export default function QuestionLibraryListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const legacyLibraryId = params.get('library');
  const { data: libraries = [], isLoading, error, refetch } = useQuestionLibraries();
  const { data: occupations = [], error: occupationsError } = useOccupationOptions();
  const createLibrary = useCreateQuestionLibrary();
  const [occupationId, setOccupationId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { data: modules = [] } = useModuleOptions(occupationId);

  if (legacyLibraryId) return <Navigate to={`/admin/question-libraries/${encodeURIComponent(legacyLibraryId)}`} replace />;

  const changeOccupation = (value: string) => {
    setOccupationId(value);
    setModuleId('');
  };

  const submitLibrary = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) { toast.error('Bạn cần đăng nhập để tạo ngân hàng.'); return; }
    try {
      const library = await createLibrary.mutateAsync({ occupationId, moduleId: moduleId || null, name, description, createdBy: user.id });
      toast.success('Đã tạo ngân hàng câu hỏi.');
      navigate(`/admin/question-libraries/${library.id}`);
    } catch (reason) {
      toast.error(errorMessage(reason, 'Không thể tạo ngân hàng.'));
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Ngân hàng câu hỏi</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Mỗi mô-đun có một ngân hàng câu hỏi; mô-đun dùng chung cho nhiều nghề thì các nghề dùng chung ngân hàng đó. Chọn ngân hàng để xem cây kiến thức, câu hỏi và phiếu nhập tài liệu.</p>
        </div>
        <BackLink to="/admin/questions">Mở kho câu hỏi cũ</BackLink>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
        <section aria-labelledby="library-list-heading" className="min-w-0">
          <h2 id="library-list-heading" className="mb-3 text-sm font-semibold text-slate-900">Ngân hàng hiện có</h2>
          {isLoading && <LoadingState>Đang tải ngân hàng câu hỏi…</LoadingState>}
          {error && <ErrorState title="Không tải được danh sách ngân hàng" detail={errorMessage(error, 'Kiểm tra kết nối mạng.')} onRetry={() => void refetch()} />}
          {!isLoading && !error && libraries.length === 0 && (
            <EmptyState title="Chưa có ngân hàng nào">
              <p>Tạo ngân hàng đầu tiên bằng biểu mẫu “Tạo ngân hàng”. Câu hỏi cũ vẫn mở được trong kho câu hỏi cũ.</p>
            </EmptyState>
          )}
          {libraries.length > 0 && (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {libraries.map((library) => (
                <li key={library.id}>
                  <Link to={`/admin/question-libraries/${library.id}`} className={`block px-4 py-3 hover:bg-slate-50 ${focusRing} focus-visible:outline-offset-[-2px]`}>
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-slate-900">{library.name}</span>
                      {library.status === 'archived' && <span className="text-xs font-medium text-slate-600">Đã lưu trữ</span>}
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-600">{libraryCourse(library, occupations)}</span>
                    {library.description && <span className="mt-1 block text-sm text-slate-500 line-clamp-2">{library.description}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="create-library-heading" className="h-fit rounded-xl border border-slate-200 bg-white p-4">
          <h2 id="create-library-heading" className="font-semibold text-slate-900">Tạo ngân hàng</h2>
          {occupationsError && <p role="alert" className="mt-2 text-sm text-rose-800">Không tải được danh sách nghề. Tải lại trang trước khi tạo ngân hàng.</p>}
          <form className="mt-4 space-y-3" onSubmit={submitLibrary}>
            <label className="block text-sm font-medium text-slate-700">Nghề đào tạo
              <select value={occupationId} onChange={(event) => changeOccupation(event.target.value)} required className={fieldClass}>
                <option value="">Chọn nghề</option>
                {occupations.map((occupation) => <option key={occupation.id} value={occupation.id}>{occupation.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">Mô-đun
              <select value={moduleId} onChange={(event) => setModuleId(event.target.value)} disabled={!occupationId} required className={fieldClass}>
                <option value="">Chọn mô-đun</option>
                {modules.map((module) => <option key={module.id} value={module.id}>{moduleLabel(module)}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">Tên ngân hàng
              <input value={name} onChange={(event) => setName(event.target.value)} required minLength={3} maxLength={160} className={fieldClass} placeholder="Ví dụ: An toàn vận hành RTG" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Mô tả
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className={fieldClass} placeholder="Phạm vi kiến thức và mục đích sử dụng" />
            </label>
            <button disabled={createLibrary.isPending} className={`min-h-11 w-full rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}>
              {createLibrary.isPending ? 'Đang tạo…' : 'Tạo ngân hàng'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
