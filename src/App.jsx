import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { FormsProvider } from './context/FormsContext.jsx';
import LoginPage from './components/auth/LoginPage.jsx';
import AppShell from './components/layout/AppShell.jsx';
import Dashboard from './components/views/Dashboard.jsx';
import Repository from './components/views/Repository.jsx';
import FormWizard from './components/form/FormWizard.jsx';
import FormDetail from './components/approval/FormDetail.jsx';
import { SignedOFs, ChurnVoidRequest } from './components/views/SignedChurnVoid.jsx';
import AdminUsers from './components/views/AdminUsers.jsx';
import { useForms } from './context/FormsContext.jsx';
import { useParams, useNavigate } from 'react-router-dom';
import { getFY } from './utils/dates.js';

function FormDetailRoute() {
  const { id }    = useParams();
  const { forms } = useForms();
  const form      = forms.find(f => f.id === id);
  if (!form) return <div className="p-8 text-brand-faint">Order Form not found.</div>;
  return <FormDetail form={form}/>;
}

function NewFormPage() {
  const navigate = useNavigate();
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-brand-faint">←</button>
        <div>
          <h2 className="text-xl font-bold" style={{ color:'#1B2B4B' }}>New Order Form</h2>
          <p className="text-sm text-brand-faint">Fynd General Template · {getFY(new Date().toISOString())}</p>
        </div>
      </div>
      <FormWizard/>
    </div>
  );
}

function ProtectedApp() {
  return (
    <FormsProvider>
      <AppShell>
        <Routes>
          <Route path="/dashboard"    element={<Dashboard/>}/>
          <Route path="/repository"   element={<Repository/>}/>
          <Route path="/form/new"     element={<NewFormPage/>}/>
          <Route path="/form/:id"     element={<FormDetailRoute/>}/>
          <Route path="/signed"       element={<SignedOFs/>}/>
          <Route path="/churn-void"   element={<ChurnVoidRequest/>}/>
          <Route path="/admin-users"  element={<AdminUsers/>}/>
          <Route path="*"             element={<Navigate to="/dashboard" replace/>}/>
        </Routes>
      </AppShell>
    </FormsProvider>
  );
}

export default function App() {
  const { user } = useAuth();
  return user ? <ProtectedApp/> : <LoginPage/>;
}
