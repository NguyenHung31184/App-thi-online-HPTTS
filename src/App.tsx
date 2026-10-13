import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider, LoginPage, RoleSelectPage, VerifyCccdPage } from './modules/identity-access/public';
import RouteLoadBoundary from './app/RouteLoadBoundary';

const Layout = lazy(() => import('./app/layouts/Layout'));
const AdminLayout = lazy(() => import('./app/layouts/AdminLayout'));
const BankCheckPage = lazy(() => import('./modules/exam-management/public').then((m) => ({ default: m.BankCheckPage })));
const ExamDetailPage = lazy(() => import('./modules/exam-management/public').then((m) => ({ default: m.ExamDetailPage })));
const ExamFormPage = lazy(() => import('./modules/exam-management/public').then((m) => ({ default: m.ExamFormPage })));
const ExamsPage = lazy(() => import('./modules/exam-management/public').then((m) => ({ default: m.ExamsPage })));
const WindowFormPage = lazy(() => import('./modules/exam-management/public').then((m) => ({ default: m.WindowFormPage })));
const WindowsPage = lazy(() => import('./modules/exam-management/public').then((m) => ({ default: m.WindowsPage })));
const PracticalResultDetailPage = lazy(() => import('./modules/practical-exams/public').then((m) => ({ default: m.ResultDetailPage })));
const PracticalResultsPage = lazy(() => import('./modules/practical-exams/public').then((m) => ({ default: m.ResultsPage })));
const PracticalSessionFormPage = lazy(() => import('./modules/practical-exams/public').then((m) => ({ default: m.SessionFormPage })));
const PracticalSessionsPage = lazy(() => import('./modules/practical-exams/public').then((m) => ({ default: m.SessionsPage })));
const PracticalTemplateFormPage = lazy(() => import('./modules/practical-exams/public').then((m) => ({ default: m.TemplateFormPage })));
const PracticalTemplateImportPage = lazy(() => import('./modules/practical-exams/public').then((m) => ({ default: m.TemplateImportPage })));
const PracticalTemplatesPage = lazy(() => import('./modules/practical-exams/public').then((m) => ({ default: m.TemplatesPage })));
const AdminDashboardPage = lazy(() => import('./modules/exam-reporting/public').then((m) => ({ default: m.AdminDashboardPage })));
const AttemptResultPage = lazy(() => import('./modules/exam-reporting/public').then((m) => ({ default: m.AttemptResultPage })));
const ReportPage = lazy(() => import('./modules/exam-reporting/public').then((m) => ({ default: m.ReportPage })));
const ExamResultPage = lazy(() => import('./modules/exam-reporting/public').then((m) => ({ default: m.ExamResultPage })));
const StudentResultsPage = lazy(() => import('./modules/exam-reporting/public').then((m) => ({ default: m.StudentResultsPage })));
const SyncLogPage = lazy(() => import('./modules/integrations/public').then((m) => ({ default: m.SyncLogPage })));
const DashboardPage = lazy(() => import('./modules/exam-taking/public').then((m) => ({ default: m.DashboardPage })));
const ExamTakePage = lazy(() => import('./modules/exam-taking/public').then((m) => ({ default: m.ExamTakePage })));
const ExamIntroPage = lazy(() => import('./modules/exam-taking/public').then((m) => ({ default: m.ExamIntroPage })));
const StudentExamsPage = lazy(() => import('./modules/exam-taking/public').then((m) => ({ default: m.AvailableTheoryExamsPage })));
const StudentLearnPage = lazy(() => import('./modules/elearning/public').then((m) => ({ default: m.StudentLearnPage })));
const LessonPlayerPage = lazy(() => import('./modules/elearning/public').then((m) => ({ default: m.LessonPlayerPage })));
const LessonsPage = lazy(() => import('./modules/elearning/public').then((m) => ({ default: m.LessonsPage })));
const LessonEditorPage = lazy(() => import('./modules/elearning/public').then((m) => ({ default: m.LessonEditorPage })));
const LegacyQuestionBankRedirect = lazy(() => import('./modules/question-bank/public').then((m) => ({ default: m.LegacyQuestionBankRedirect })));
const QuestionEditorPage = lazy(() => import('./modules/question-bank/public').then((m) => ({ default: m.QuestionEditorPage })));
const QuestionImportReviewPage = lazy(() => import('./modules/question-bank/public').then((m) => ({ default: m.QuestionImportReviewPage })));
const QuestionLibraryImportsPage = lazy(() => import('./modules/question-bank/public').then((m) => ({ default: m.QuestionLibraryImportsPage })));
const QuestionLibraryLayout = lazy(() => import('./modules/question-bank/public').then((m) => ({ default: m.QuestionLibraryLayout })));
const QuestionLibraryListPage = lazy(() => import('./modules/question-bank/public').then((m) => ({ default: m.QuestionLibraryListPage })));
const QuestionLibraryQuestionsPage = lazy(() => import('./modules/question-bank/public').then((m) => ({ default: m.QuestionLibraryQuestionsPage })));
const QuestionLibraryStructurePage = lazy(() => import('./modules/question-bank/public').then((m) => ({ default: m.QuestionLibraryStructurePage })));
const QuestionSpreadsheetImportPage = lazy(() => import('./modules/question-bank/public').then((m) => ({ default: m.QuestionSpreadsheetImportPage })));

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" richColors closeButton />
        <RouteLoadBoundary>
        <Suspense fallback={<p className="p-6 text-slate-700" role="status">Đang tải trang…</p>}>
        <Routes>
          <Route path="/start" element={<RoleSelectPage />} />
          <Route path="/login" element={<LoginPage />} />
          {/* Thí sinh vào thi: xác thực CCCD không yêu cầu Supabase auth */}
          <Route path="/verify-cccd" element={<VerifyCccdPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="exams" element={<ExamsPage />} />
            <Route path="exams/new" element={<ExamFormPage />} />
            <Route path="questions" element={<Navigate to="/admin/question-libraries" replace />} />
            <Route path="question-libraries" element={<QuestionLibraryListPage />} />
            <Route path="question-libraries/imports/:jobId" element={<QuestionImportReviewPage />} />
            <Route path="question-libraries/:libraryId" element={<QuestionLibraryLayout />}>
              <Route index element={<QuestionLibraryStructurePage />} />
              <Route path="questions" element={<QuestionLibraryQuestionsPage />} />
              <Route path="questions/new" element={<QuestionEditorPage />} />
              <Route path="questions/import" element={<QuestionSpreadsheetImportPage />} />
              <Route path="questions/:questionId" element={<QuestionEditorPage />} />
              <Route path="imports" element={<QuestionLibraryImportsPage />} />
              <Route path="imports/:jobId" element={<QuestionImportReviewPage />} />
            </Route>
            <Route path="questions/occupation/:occupationId" element={<LegacyQuestionBankRedirect target="questions" />} />
            <Route path="questions/occupation/:occupationId/new" element={<LegacyQuestionBankRedirect target="new" />} />
            <Route path="questions/occupation/:occupationId/import" element={<LegacyQuestionBankRedirect target="import" />} />
            <Route path="questions/occupation/:occupationId/questions/:qId" element={<LegacyQuestionBankRedirect target="question" />} />
            <Route path="exams/:id" element={<ExamDetailPage />} />
            <Route path="exams/:id/edit" element={<ExamFormPage />} />
            <Route path="exams/:id/questions" element={<BankCheckPage />} />
            <Route path="windows" element={<WindowsPage />} />
            <Route path="windows/new" element={<WindowFormPage />} />
            <Route path="windows/:id" element={<WindowFormPage />} />
            <Route path="practical-templates" element={<PracticalTemplatesPage />} />
            <Route path="practical-templates/new" element={<PracticalTemplateFormPage />} />
            <Route path="practical-templates/import" element={<PracticalTemplateImportPage />} />
            <Route path="practical-templates/:id" element={<PracticalTemplateFormPage />} />
            <Route path="practical-sessions" element={<PracticalSessionsPage />} />
            <Route path="practical-sessions/new" element={<PracticalSessionFormPage />} />
            <Route path="practical-sessions/:id" element={<PracticalSessionFormPage />} />
            <Route path="practical-grading" element={<PracticalResultsPage />} />
            <Route path="practical-grading/:attemptId" element={<PracticalResultDetailPage />} />
            <Route path="report" element={<ReportPage />} />
            <Route path="attempts/:attemptId/result" element={<AttemptResultPage />} />
            <Route path="lessons" element={<LessonsPage />} />
            <Route path="lessons/:lessonId" element={<LessonEditorPage />} />
            <Route path="sync" element={<SyncLogPage />} />
          </Route>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="student/exams" element={<StudentExamsPage />} />
            <Route path="student/results" element={<StudentResultsPage />} />
            <Route path="student/learn" element={<StudentLearnPage />} />
            <Route path="student/learn/:lessonId" element={<LessonPlayerPage />} />
            <Route path="exam/:attemptId/intro" element={<ExamIntroPage />} />
            <Route path="exam/:attemptId" element={<ExamTakePage />} />
            <Route path="exam/:attemptId/result" element={<ExamResultPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </Suspense>
        </RouteLoadBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
