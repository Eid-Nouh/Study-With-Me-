import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [myRooms, setMyRooms] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMyRooms();
  }, []);

  const loadMyRooms = async () => {
    try {
      const response = await api.get('/rooms/my-rooms/');
      setMyRooms(response.data);
    } catch (error) {
      console.error('Error loading rooms:', error);
    }
  };

  const createRoom = async (e) => {
    e.preventDefault();
    if (!newRoomTitle.trim()) {
      alert('الرجاء إدخال عنوان الغرفة');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/rooms/create/', {
        title: newRoomTitle,
        description: newRoomDesc
      });

      const meetingCode = response.data.room.meeting_code;
      navigate(`/room/${meetingCode}`);
    } catch (error) {
      alert('فشل إنشاء الغرفة');
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      alert('الرجاء إدخال رمز الغرفة');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/rooms/join/', {
        meeting_code: joinCode.toUpperCase()
      });

      const meetingCode = response.data.room.meeting_code;
      navigate(`/room/${meetingCode}`);
    } catch (error) {
      alert('فشل الانضمام: رمز الغرفة غير صحيح');
    } finally {
      setLoading(false);
    }
  };

  const getAvatarLetter = (name) => {
    return (name || 'U')[0].toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a]">
      {/* Particles Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="particle w-[600px] h-[600px] bg-primary-500/5 rounded-full absolute -top-72 -left-72 animate-float" style={{animationDelay: '0s'}}></div>
        <div className="particle w-[500px] h-[500px] bg-purple-500/5 rounded-full absolute -bottom-64 -right-64 animate-float" style={{animationDelay: '3s'}}></div>
        <div className="particle w-72 h-72 bg-accent/5 rounded-full absolute top-1/2 left-3/4 animate-float" style={{animationDelay: '5s'}}></div>
      </div>

      {/* Navbar */}
      <nav className="fixed w-full top-0 z-50 glass" style={{background: 'rgba(10, 10, 26, 0.8)'}}>
        <div className="container mx-auto px-6 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
                <i className="fas fa-chalkboard-user text-white text-lg"></i>
              </div>
              <span className="text-xl font-bold gradient-text font-cairo">Study With Me</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                  {getAvatarLetter(user?.username)}
                </div>
                <span className="text-gray-300 text-sm font-cairo">{user?.username}</span>
              </div>
              <button
                onClick={logout}
                className="btn-secondary text-sm flex items-center gap-2 py-2"
              >
                <i className="fas fa-sign-out-alt"></i>
                <span className="font-cairo">خروج</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="relative z-10 container mx-auto px-6 pt-24 pb-12">
        {/* Welcome Header */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 font-cairo">
            مرحباً{' '}
            <span className="gradient-text">{user?.full_name || user?.username}</span>
          </h1>
          <p className="text-gray-500 text-lg">ابدأ جلسة جديدة أو انضم إلى جلسة موجودة</p>
        </div>

        {/* Cards Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Create Room Card */}
          <div className="glass-card p-8 animate-fade-in group" style={{animationDelay: '0.1s'}}>
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <i className="fas fa-plus-circle text-3xl text-green-400"></i>
              </div>
              <h3 className="text-xl font-bold text-white font-cairo">إنشاء غرفة جديدة</h3>
              <p className="text-gray-500 text-sm">أنشئ غرفة وادعُ الآخرين للانضمام</p>
            </div>
            <form onSubmit={createRoom}>
              <input
                type="text"
                value={newRoomTitle}
                onChange={(e) => setNewRoomTitle(e.target.value)}
                placeholder="عنوان الغرفة"
                required
                className="input-premium mb-3"
              />
              <textarea
                value={newRoomDesc}
                onChange={(e) => setNewRoomDesc(e.target.value)}
                placeholder="وصف الغرفة (اختياري)"
                rows="2"
                className="input-premium mb-4 resize-none"
              ></textarea>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full font-cairo flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-video"></i>}
                إنشاء غرفة
              </button>
            </form>
          </div>

          {/* Join Room Card */}
          <div className="glass-card p-8 animate-fade-in group" style={{animationDelay: '0.2s'}}>
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <i className="fas fa-link text-3xl text-primary-400"></i>
              </div>
              <h3 className="text-xl font-bold text-white font-cairo">الانضمام إلى غرفة</h3>
              <p className="text-gray-500 text-sm">أدخل رمز الغرفة للانضمام</p>
            </div>
            <form onSubmit={joinRoom}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="رمز الغرفة"
                required
                maxLength="6"
                className="input-premium mb-4 text-center text-2xl tracking-[0.5em] font-bold"
                style={{direction: 'ltr'}}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-500 to-purple-600 text-white py-3 rounded-xl hover:shadow-lg hover:shadow-primary-500/30 transition-all duration-300 font-cairo font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sign-in-alt"></i>}
                انضمام
              </button>
            </form>
          </div>
        </div>

        {/* My Rooms */}
        <div className="animate-fade-in" style={{animationDelay: '0.3s'}}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white font-cairo flex items-center gap-2">
              <i className="fas fa-history text-primary-400"></i>
              غرفي السابقة
            </h3>
            <button onClick={loadMyRooms} className="text-primary-400 hover:text-primary-300 text-sm transition-colors flex items-center gap-1">
              <i className="fas fa-sync-alt"></i>
              تحديث
            </button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myRooms.map((room, idx) => (
              <div
                key={room.id}
                className="glass-hover rounded-xl p-5 cursor-pointer animate-fade-in"
                style={{animationDelay: `${0.1 * (idx + 1)}s`}}
                onClick={() => navigate(`/room/${room.meeting_code}`)}
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-video text-2xl text-primary-400"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white text-lg truncate">{room.title}</h4>
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <i className="fas fa-code"></i>
                        {room.meeting_code}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="fas fa-users"></i>
                        {room.participants_count}
                      </span>
                    </div>
                  </div>
                  <i className="fas fa-chevron-left text-gray-600 mt-1"></i>
                </div>
              </div>
            ))}

            {myRooms.length === 0 && (
              <div className="col-span-full text-center py-12 glass-card">
                <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-inbox text-4xl text-gray-500"></i>
                </div>
                <p className="text-gray-400 text-lg font-cairo">لا توجد غرف بعد</p>
                <p className="text-gray-600 text-sm">أنشئ غرفة جديدة أو انضم إلى واحدة!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
