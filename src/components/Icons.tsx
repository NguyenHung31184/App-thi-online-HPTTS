import type { SVGProps } from 'react';
import {
  LayoutDashboard,
  CreditCard,
  FileText,
  Calendar,
  ClipboardCheck,
  Settings,
  GraduationCap,
  FileSignature,
  BarChart3,
  RefreshCw,
  LogOut,
  Menu,
  ListChecks,
} from 'lucide-react';

const defaultProps = { size: 20, strokeWidth: 1.5 };

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

export const DashboardIcon = (p: IconProps) => <LayoutDashboard {...defaultProps} {...p} />;
export const IdCardIcon = (p: IconProps) => <CreditCard {...defaultProps} {...p} />;
export const ExamIcon = (p: IconProps) => <FileText {...defaultProps} {...p} />;
export const CalendarIcon = (p: IconProps) => <Calendar {...defaultProps} {...p} />;
export const GradingIcon = (p: IconProps) => <ClipboardCheck {...defaultProps} {...p} />;
export const SettingsIcon = (p: IconProps) => <Settings {...defaultProps} {...p} />;
export const PracticalIcon = (p: IconProps) => <GraduationCap {...defaultProps} {...p} />;
export const EssayGradingIcon = (p: IconProps) => <FileSignature {...defaultProps} {...p} />;
export const ReportIcon = (p: IconProps) => <BarChart3 {...defaultProps} {...p} />;
export const SyncIcon = (p: IconProps) => <RefreshCw {...defaultProps} {...p} />;
export const LogoutIcon = (p: IconProps) => <LogOut {...defaultProps} {...p} />;
export const MenuIcon = (p: IconProps) => <Menu {...defaultProps} {...p} />;
export const QuestionBankIcon = (p: IconProps) => <ListChecks {...defaultProps} {...p} />;
