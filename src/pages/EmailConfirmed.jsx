import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

// This page is shown after the user clicks the confirmation link in their email.
// Supabase redirects to /email-confirmed after verification.
export default function EmailConfirmed() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle className="w-16 h-16 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Confirmed!</h1>
        <p className="text-gray-600 mb-2">
          Your email address has been successfully verified.
        </p>
        <p className="text-sm text-gray-500 mb-8">
          You can now sign in to DeliveryHub. An admin will need to assign your role before you can access all features.
        </p>
        <Link
          to="/login"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition"
        >
          Go to Login
        </Link>
      </div>
    </div>
  );
}
