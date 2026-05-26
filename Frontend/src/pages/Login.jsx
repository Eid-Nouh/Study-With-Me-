import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(username, password);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="particle w-96 h-96 bg-primary-500/10 rounded-full absolute -top-48 -left-48 animate-float" style={{animationDelay: '0s'}}></div>
        <div className="particle w-80 h-80 bg-purple-500/10 rounded-full absolute -bottom-40 -right-40 animate-float" style={{animationDelay: '2s'}}></div>
        <div className="particle w-64 h-64 bg-accent/5 rounded-full absolute top-1/3 -right-32 animate-float" style={{animationDelay: '4s'}}></div>
        <div className="particle w-48 h-48 bg-pink-500/5 rounded-full absolute bottom-1/4 left-1/4 animate-float" style={{animationDelay: '1s'}}></div>
      </div>

      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 shadow-lg shadow-primary-500/25 mb-4">
            <i className="fas fa-chalkboard-user text-3xl text-white"></i>
          </div>
          <h1 className="text-3xl font-bold gradient-text font-cairo">Study With Me</h1>
          <p className="text-gray-500 mt-1">ادرس معي - منصة التعاون عن بعد</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-white font-cairo">مرحباً بعودتك</h2>
            <p className="text-gray-500 text-sm">سجل دخولك للانضمام إلى جلساتك</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-center text-sm animate-slide-up">
              <i className="fas fa-exclamation-circle ml-2"></i>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-300 text-sm font-bold mb-2 font-cairo">
                <i className="fas fa-user text-primary-400 ml-2"></i>
                اسم المستخدم
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="input-premium"
                placeholder="أدخل اسم المستخدم"
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-300 text-sm font-bold mb-2 font-cairo">
                <i className="fas fa-lock text-primary-400 ml-2"></i>
                كلمة المرور
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-premium"
                placeholder="أدخل كلمة المرور"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-lg font-cairo flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><i className="fas fa-spinner fa-spin"></i> جاري تسجيل الدخول...</>
              ) : (
                <><i className="fas fa-sign-in-alt"></i> دخول</>
              )}
            </button>
          </form>

          <div className="text-center mt-6 pt-6 border-t border-white/5">
            <p className="text-gray-500 text-sm">
              ليس لديك حساب؟
              <Link to="/register" className="text-primary-400 hover:text-primary-300 mr-1 font-bold transition-colors">
                سجل الآن
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
