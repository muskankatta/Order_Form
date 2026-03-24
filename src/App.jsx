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
import { useForms } from './context/FormsContext.jsx';
import { useParams } from 'react-router-dom';

function FormDetailRoute() {
  const { id }   = useParams();
  const { forms }= useForms();
  const form     = forms.find(f => f.id === id);
  if (!form) return <div className="p-8 text-brand-faint">Order Form not found.</div>;
  return <FormDetail form={form}/>;
}

function NewFormPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-bold text-navy">New Order Form</h2>
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
          <Route path="/dashboard"   element={<Dashboard/>}/>
          <Route path="/repository"  element={<Repository/>}/>
          <Route path="/form/new"    element={<NewFormPage/>}/>
          <Route path="/form/:id"    element={<FormDetailRoute/>}/>
          <Route path="/signed"      element={<SignedOFs/>}/>
          <Route path="/churn-void"  element={<ChurnVoidRequest/>}/>
          <Route path="*"            element={<Navigate to="/dashboard" replace/>}/>
        </Routes>
      </AppShell>
    </FormsProvider>
  );
}

export default function App() {
  const { user } = useAuth();
  return user ? <ProtectedApp/> : <LoginPage/>;
}
