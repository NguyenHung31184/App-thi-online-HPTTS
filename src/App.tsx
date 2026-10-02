import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './modules/identity-access/public';
import LoginPage from './pages/LoginPage';
import Layout from './pages/Layout';
import VerifyCccdPage from './pages/VerifyCccdPage';
import RoleSelectPage from './pages/RoleSelectPage';
import DashboardPage from './pages/DashboardPage';
import AdminLayout from './pages/admin/AdminLayout';
import {
  BankCheckPage,
  ExamDetailPage,
  ExamFormPage,
  ExamsPage,
  WindowFormPage,
  WindowsPage,
} from './modules/exam-management/public';
import {
  GradingDetailPage as PracticalGradingDetailPage,
  GradingListPage as PracticalGradingListPage,
  PracticalTakePage,
  SessionFormPage as PracticalSessionFormPage,
  SessionsPage as PracticalSessionsPage,
  TemplateFormPage as PracticalTemplateFormPage,
  TemplatesPage as PracticalTemplatesPage,
} from './modules/practical-exams/public';
import { AdminDashboardPage, AttemptResultPage, ReportPage } from './modules/exam-reporting/public';
import AdminSyncPage from './pages/admin/AdminSyncPage';
import ExamTakePage from './pages/ExamTakePage';
import ExamIntroPage from './pages/ExamIntroPage';
import ExamResultPage from './pages/ExamResultPage';
import StudentExamsPage from './pages/StudentExamsPage';
import StudentResultsPage from './pages/StudentResultsPage';
import StudentLearnPage from './pages/StudentLearnPage';
import LessonPlayerPage from './pages/LessonPlayerPage';
import {
  LegacyQuestionBankRedirect,
  QuestionEditorPage,
  QuestionImportReviewPage,
  QuestionLibraryImportsPage,
  QuestionLibraryLayout,
  QuestionLibraryListPage,
  QuestionLibraryQuestionsPage,
  QuestionLibraryStructurePage,
  QuestionSpreadsheetImportPage,
} from './modules/question-bank/public';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" richColors closeButton />
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
            <Route path="practical-templates/:id" element={<PracticalTemplateFormPage />} />
            <Route path="practical-sessions" element={<PracticalSessionsPage />} />
            <Route path="practical-sessions/new" element={<PracticalSessionFormPage />} />
            <Route path="practical-sessions/:id" element={<PracticalSessionFormPage />} />
            <Route path="practical-grading" element={<PracticalGradingListPage />} />
            <Route path="practical-grading/:attemptId" element={<PracticalGradingDetailPage />} />
            <Route path="report" element={<ReportPage />} />
            <Route path="attempts/:attemptId/result" element={<AttemptResultPage />} />
            <Route path="sync" element={<AdminSyncPage />} />
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
            <Route path="practical/:attemptId" element={<PracticalTakePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
