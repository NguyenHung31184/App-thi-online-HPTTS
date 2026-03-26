import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import Layout from './pages/Layout';
import RoleSelectPage from './pages/RoleSelectPage';
import StudentInfoPage from './pages/StudentInfoPage';
import DashboardPage from './pages/DashboardPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminExamsPage from './pages/admin/AdminExamsPage';
import AdminExamFormPage from './pages/admin/AdminExamFormPage';
import AdminExamDetailPage from './pages/admin/AdminExamDetailPage';
import AdminQuestionHomePage from './pages/admin/AdminQuestionHomePage';
import AdminOccupationQuestionsPage from './pages/admin/AdminOccupationQuestionsPage';
import AdminQuestionBankFormPage from './pages/admin/AdminQuestionBankFormPage';
import AdminQuestionBankImportPage from './pages/admin/AdminQuestionBankImportPage';
import AdminQuestionsPage from './pages/admin/AdminQuestionsPage';
import AdminQuestionFormPage from './pages/admin/AdminQuestionFormPage';
import AdminQuestionImportPage from './pages/admin/AdminQuestionImportPage';
import AdminWindowsPage from './pages/admin/AdminWindowsPage';
import AdminWindowFormPage from './pages/admin/AdminWindowFormPage';
import AdminReportPage from './pages/admin/AdminReportPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import ExamTakePage from './pages/ExamTakePage';
import ExamIntroPage from './pages/ExamIntroPage';
import ExamResultPage from './pages/ExamResultPage';
import StudentExamsPage from './pages/StudentExamsPage';
import StudentResultsPage from './pages/StudentResultsPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" richColors closeButton />
        <Routes>
          <Route path="/start" element={<RoleSelectPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/student-info" element={<StudentInfoPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="exams" element={<AdminExamsPage />} />
            <Route path="exams/new" element={<AdminExamFormPage />} />
            <Route path="questions" element={<AdminQuestionHomePage />} />
            <Route path="questions/occupation/:occupationId" element={<AdminOccupationQuestionsPage />} />
            <Route path="questions/occupation/:occupationId/new" element={<AdminQuestionBankFormPage />} />
            <Route path="questions/occupation/:occupationId/import" element={<AdminQuestionBankImportPage />} />
            <Route path="questions/occupation/:occupationId/questions/:qId" element={<AdminQuestionBankFormPage />} />
            <Route path="exams/:id" element={<AdminExamDetailPage />} />
            <Route path="exams/:id/edit" element={<AdminExamFormPage />} />
            <Route path="exams/:id/questions" element={<AdminQuestionsPage />} />
            <Route path="exams/:id/questions/import" element={<AdminQuestionImportPage />} />
            <Route path="exams/:id/questions/new" element={<AdminQuestionFormPage />} />
            <Route path="exams/:id/questions/:qId" element={<AdminQuestionFormPage />} />
            <Route path="windows" element={<AdminWindowsPage />} />
            <Route path="windows/new" element={<AdminWindowFormPage />} />
            <Route path="windows/:id" element={<AdminWindowFormPage />} />
            <Route path="report" element={<AdminReportPage />} />
          </Route>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="student/exams" element={<StudentExamsPage />} />
            <Route path="student/results" element={<StudentResultsPage />} />
            <Route path="exam/:attemptId/intro" element={<ExamIntroPage />} />
            <Route path="exam/:attemptId" element={<ExamTakePage />} />
            <Route path="exam/:attemptId/result" element={<ExamResultPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
