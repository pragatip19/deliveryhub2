import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';

export default function CheckEmail() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
        <div className="flex justify-center mb-4">
          <Mail className="w-16 h-16 text-blue-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
        <p className="text-gray-600 mb-2">
          We've sent a confirmation link to your email address.
        </p>
        <p className="text-sm text-gray-500 mb-8">
          Click the link in the email to verify your account. Once confirmed, you can sign in below.
        </p>
        <Link
          to="/login"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
