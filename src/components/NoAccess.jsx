export default function NoAccess({ email, onBack }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6"
         style={{ background: 'linear-gradient(135deg,#1B2B4B 0%,#0d1a2e 100%)' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0
                 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898
                 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Access Not Granted</h2>
        <p className="text-sm font-medium text-gray-700 mb-1">{email}</p>
        <p className="text-sm text-gray-500 mb-6">
          Your account isn't on the authorised user list.<br/>
          Contact <span className="font-medium text-gray-700">Muskan</span> to request access.
        </p>
        <button
          onClick={onBack}
          className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ background: '#1B2B4B' }}
          onMouseEnter={e => e.target.style.background = '#2d4a7a'}
          onMouseLeave={e => e.target.style.background = '#1B2B4B'}
        >
          ← Back to Sign In
        </button>
      </div>
    </div>
  );
}
