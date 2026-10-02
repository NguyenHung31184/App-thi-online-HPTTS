import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
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
import AdminPracticalTemplatesPage from './pages/admin/AdminPracticalTemplatesPage';
import AdminPracticalTemplateFormPage from './pages/admin/AdminPracticalTemplateFormPage';
import AdminPracticalSessionsPage from './pages/admin/AdminPracticalSessionsPage';
import AdminPracticalSessionFormPage from './pages/admin/AdminPracticalSessionFormPage';
import AdminPracticalGradingPage from './pages/admin/AdminPracticalGradingPage';
import AdminPracticalGradingDetailPage from './pages/admin/AdminPracticalGradingDetailPage';
import AdminReportPage from './pages/admin/AdminReportPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import { AttemptResultPage } from './modules/exam-reporting/public';
import AdminSyncPage from './pages/admin/AdminSyncPage';
import ExamTakePage from './pages/ExamTakePage';
import ExamIntroPage from './pages/ExamIntroPage';
import ExamResultPage from './pages/ExamResultPage';
import PracticalTakePage from './pages/PracticalTakePage';
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
            <Route path="practical-templates" element={<AdminPracticalTemplatesPage />} />
            <Route path="practical-templates/new" element={<AdminPracticalTemplateFormPage />} />
            <Route path="practical-templates/:id" element={<AdminPracticalTemplateFormPage />} />
            <Route path="practical-sessions" element={<AdminPracticalSessionsPage />} />
            <Route path="practical-sessions/new" element={<AdminPracticalSessionFormPage />} />
            <Route path="practical-sessions/:id" element={<AdminPracticalSessionFormPage />} />
            <Route path="practical-grading" element={<AdminPracticalGradingPage />} />
            <Route path="practical-grading/:attemptId" element={<AdminPracticalGradingDetailPage />} />
            <Route path="report" element={<AdminReportPage />} />
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
