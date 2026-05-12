export default function NoAccess({ email, onLogout }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 max-w-md w-full p-8 text-center">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71
                 c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898
                 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Access Not Granted</h2>
        <p className="text-sm text-gray-500 mb-1">
          <span className="font-medium text-gray-700">{email}</span>
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Your account isn't on the authorised user list. Contact Muskan to request access.
        </p>
        <button
          onClick={onLogout}
          className="w-full py-2.5 px-4 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
