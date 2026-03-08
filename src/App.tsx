import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import Layout from './pages/Layout';
import VerifyCccdPage from './pages/VerifyCccdPage';
import DashboardPage from './pages/DashboardPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminExamsPage from './pages/admin/AdminExamsPage';
import AdminExamFormPage from './pages/admin/AdminExamFormPage';
import AdminExamDetailPage from './pages/admin/AdminExamDetailPage';
import AdminQuestionsPage from './pages/admin/AdminQuestionsPage';
import AdminQuestionFormPage from './pages/admin/AdminQuestionFormPage';
import AdminQuestionImportPage from './pages/admin/AdminQuestionImportPage';
import AdminWindowsPage from './pages/admin/AdminWindowsPage';
import AdminWindowFormPage from './pages/admin/AdminWindowFormPage';
import AdminEssayGradingPage from './pages/admin/AdminEssayGradingPage';
import AdminEssayGradingDetailPage from './pages/admin/AdminEssayGradingDetailPage';
import AdminPracticalTemplatesPage from './pages/admin/AdminPracticalTemplatesPage';
import AdminPracticalTemplateFormPage from './pages/admin/AdminPracticalTemplateFormPage';
import AdminPracticalSessionsPage from './pages/admin/AdminPracticalSessionsPage';
import AdminPracticalSessionFormPage from './pages/admin/AdminPracticalSessionFormPage';
import AdminPracticalGradingPage from './pages/admin/AdminPracticalGradingPage';
import AdminPracticalGradingDetailPage from './pages/admin/AdminPracticalGradingDetailPage';
import AdminReportPage from './pages/admin/AdminReportPage';
import AdminSyncPage from './pages/admin/AdminSyncPage';
import ExamTakePage from './pages/ExamTakePage';
import ExamResultPage from './pages/ExamResultPage';
import PracticalTakePage from './pages/PracticalTakePage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/exams" replace />} />
            <Route path="exams" element={<AdminExamsPage />} />
            <Route path="exams/new" element={<AdminExamFormPage />} />
            <Route path="exams/:id" element={<AdminExamDetailPage />} />
            <Route path="exams/:id/questions" element={<AdminQuestionsPage />} />
            <Route path="exams/:id/questions/import" element={<AdminQuestionImportPage />} />
            <Route path="exams/:id/questions/new" element={<AdminQuestionFormPage />} />
            <Route path="exams/:id/questions/:qId" element={<AdminQuestionFormPage />} />
            <Route path="windows" element={<AdminWindowsPage />} />
            <Route path="windows/new" element={<AdminWindowFormPage />} />
            <Route path="windows/:id" element={<AdminWindowFormPage />} />
            <Route path="essay-grading" element={<AdminEssayGradingPage />} />
            <Route path="essay-grading/:attemptId" element={<AdminEssayGradingDetailPage />} />
            <Route path="practical-templates" element={<AdminPracticalTemplatesPage />} />
            <Route path="practical-templates/new" element={<AdminPracticalTemplateFormPage />} />
            <Route path="practical-templates/:id" element={<AdminPracticalTemplateFormPage />} />
            <Route path="practical-sessions" element={<AdminPracticalSessionsPage />} />
            <Route path="practical-sessions/new" element={<AdminPracticalSessionFormPage />} />
            <Route path="practical-sessions/:id" element={<AdminPracticalSessionFormPage />} />
            <Route path="practical-grading" element={<AdminPracticalGradingPage />} />
            <Route path="practical-grading/:attemptId" element={<AdminPracticalGradingDetailPage />} />
            <Route path="report" element={<AdminReportPage />} />
            <Route path="sync" element={<AdminSyncPage />} />
          </Route>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="verify-cccd" element={<VerifyCccdPage />} />
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
