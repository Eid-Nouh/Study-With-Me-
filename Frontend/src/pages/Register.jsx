import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    password2: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.password2) {
      setError('كلمة المرور غير متطابقة');
      return;
    }

    setLoading(true);
    setError('');

    const result = await register(formData);

    if (result.success) {
      navigate('/dashboard');
    } else {
      if (typeof result.error === 'object') {
        const firstError = Object.values(result.error)[0];
        setError(firstError?.[0] || 'فشل إنشاء الحساب');
      } else {
        setError(result.error);
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="particle w-96 h-96 bg-primary-500/10 rounded-full absolute -top-48 -right-48 animate-float" style={{animationDelay: '0s'}}></div>
        <div className="particle w-80 h-80 bg-purple-500/10 rounded-full absolute -bottom-40 -left-40 animate-float" style={{animationDelay: '2s'}}></div>
        <div className="particle w-64 h-64 bg-accent/5 rounded-full absolute top-1/3 -left-32 animate-float" style={{animationDelay: '4s'}}></div>
      </div>

      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 shadow-lg shadow-primary-500/25 mb-4">
            <i className="fas fa-user-plus text-3xl text-white"></i>
          </div>
          <h1 className="text-3xl font-bold gradient-text font-cairo">Study With Me</h1>
          <p className="text-gray-500 mt-1">ادرس معي - منصة التعاون عن بعد</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-white font-cairo">انضم إلينا</h2>
            <p className="text-gray-500 text-sm">أنشئ حسابك مجاناً وابدأ التعلم</p>
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
                اسم المستخدم *
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                className="input-premium"
                placeholder="اختر اسم مستخدم"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-300 text-sm font-bold mb-2 font-cairo">
                <i className="fas fa-envelope text-primary-400 ml-2"></i>
                البريد الإلكتروني
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="input-premium"
                placeholder="example@mail.com"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-300 text-sm font-bold mb-2 font-cairo">
                <i className="fas fa-user-tag text-primary-400 ml-2"></i>
                الاسم الكامل
              </label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className="input-premium"
                placeholder="اسمك الكامل"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="mb-4">
                <label className="block text-gray-300 text-sm font-bold mb-2 font-cairo">
                  <i className="fas fa-lock text-primary-400 ml-2"></i>
                  كلمة المرور *
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="input-premium"
                  placeholder="••••••••"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-300 text-sm font-bold mb-2 font-cairo">
                  <i className="fas fa-check-circle text-primary-400 ml-2"></i>
                  التأكيد *
                </label>
                <input
                  type="password"
                  name="password2"
                  value={formData.password2}
                  onChange={handleChange}
                  required
                  className="input-premium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-lg font-cairo flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><i className="fas fa-spinner fa-spin"></i> جاري إنشاء الحساب...</>
              ) : (
                <><i className="fas fa-check-circle"></i> إنشاء حساب</>
              )}
            </button>
          </form>

          <div className="text-center mt-6 pt-6 border-t border-white/5">
            <p className="text-gray-500 text-sm">
              لديك حساب بالفعل؟
              <Link to="/login" className="text-primary-400 hover:text-primary-300 mr-1 font-bold transition-colors">
                سجل دخولك
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
