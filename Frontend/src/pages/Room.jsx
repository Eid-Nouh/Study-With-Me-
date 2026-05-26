import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const Room = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [roomDetails, setRoomDetails] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [showParticipants, setShowParticipants] = useState(true);
  const [cameraError, setCameraError] = useState(false);

  const wsChat = useRef(null);
  const wsWebRTC = useRef(null);
  const localStream = useRef(null);
  const peerConnections = useRef({});
  const localVideoRef = useRef(null);
  const videosGridRef = useRef(null);
  const chatEndRef = useRef(null);

  const addChatMessage = (username, message) => {
    setChatMessages(prev => [...prev, {
      type: 'chat',
      username,
      message,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    }]);
  };

  const addSystemMessage = (message) => {
    setChatMessages(prev => [...prev, {
      type: 'system',
      message
    }]);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const showEmojiAnimation = (emoji, username) => {
    const id = `reaction-${Date.now()}`;
    const div = document.createElement('div');
    div.id = id;
    div.className = 'reaction-float text-7xl';
    div.textContent = emoji;
    div.style.left = `${20 + Math.random() * 60}%`;
    div.style.top = `${30 + Math.random() * 40}%`;
    document.body.appendChild(div);
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.remove();
    }, 2000);
  };

  const updateParticipantHand = (username, raised) => {
    setParticipants(prev => prev.map(p =>
      p.user?.username === username ? { ...p, hand_raised: raised } : p
    ));
  };

  const getAvatarLetter = (name) => (name || 'U')[0].toUpperCase();

  // ========== WebSocket Chat ==========
  const initWebSocket = () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const wsUrl = `/ws/chat/${roomCode}/?token=${token}`;

    if (wsChat.current && wsChat.current.readyState === WebSocket.OPEN) {
      wsChat.current.close();
    }

    wsChat.current = new WebSocket(wsUrl);

    wsChat.current.onopen = () => {
      addSystemMessage('متصل بالشات');
    };

    wsChat.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'chat') {
          addChatMessage(data.username, data.message);
        } else if (data.type === 'system') {
          addSystemMessage(data.message);
        } else if (data.type === 'reaction') {
          showEmojiAnimation(data.emoji, data.username);
        } else if (data.type === 'raise_hand') {
          updateParticipantHand(data.username, data.raised);
          if (data.raised && isHost) {
            addSystemMessage(`\u{1F64B} ${data.username} رفع يده`);
          }
        } else if (data.type === 'participants_list') {
          setParticipants(data.participants);
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    };

    wsChat.current.onclose = () => {
      addSystemMessage('انقطع الاتصال، جاري إعادة المحاولة...');
      setTimeout(() => {
        if (wsChat.current?.readyState === WebSocket.CLOSED) {
          initWebSocket();
        }
      }, 3000);
    };
  };

  // ========== WebRTC Signaling ==========
  const initWebRTC = () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const wsUrl = `/ws/webrtc/${roomCode}/?token=${token}`;

    wsWebRTC.current = new WebSocket(wsUrl);

    wsWebRTC.current.onopen = () => {};

    wsWebRTC.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      await handleWebRTCMessage(data);
    };

    wsWebRTC.current.onclose = () => {
      setTimeout(() => {
        if (wsWebRTC.current?.readyState === WebSocket.CLOSED) {
          initWebRTC();
        }
      }, 3000);
    };
  };

  const handleWebRTCMessage = async (data) => {
    if (data.type === 'user_joined') {
      if (data.user_id !== user?.id) {
        playJoinSound();
        // Add to participants list instantly
        setParticipants(prev => {
          if (prev.some(p => p.user?.id === data.user_id)) return prev;
          return [...prev, {
            user: { id: data.user_id, username: data.username },
            role: 'participant',
            is_muted: false,
            is_video_off: true,
            hand_raised: false
          }];
        });
        if (localStream.current) {
          await createPeerConnection(data.user_id, data.username, true);
        }
      }
    } else if (data.type === 'user_left') {
      setParticipants(prev => prev.filter(p => p.user?.id !== data.user_id));
      removeRemoteVideo(data.user_id);
      delete peerConnections.current[data.user_id];
    } else if (data.type === 'offer') {
      await handleOffer(data);
    } else if (data.type === 'answer') {
      await handleAnswer(data);
    } else if (data.type === 'ice_candidate') {
      await handleIceCandidate(data);
    } else if (data.type === 'you_were_muted') {
      if (localStream.current) {
        const audioTrack = localStream.current.getAudioTracks()[0];
        if (audioTrack) audioTrack.enabled = false;
        setIsMuted(true);
      }
      addSystemMessage(`\u{1F507} تم كتمك بواسطة ${data.by}`);
    } else if (data.type === 'you_were_kicked') {
      addSystemMessage(`\u{1F6AA} تم طردك من الغرفة بواسطة ${data.by}`);
      setTimeout(() => navigate('/dashboard'), 2000);
    }
  };

  // ========== WebRTC Peer Connection ==========
  const createPeerConnection = async (userId, username, isInitiator) => {
    if (peerConnections.current[userId]) return;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });

    peerConnections.current[userId] = { pc, username };

    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        pc.addTrack(track, localStream.current);
      });
    }

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      addRemoteVideo(userId, username, remoteStream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && wsWebRTC.current?.readyState === WebSocket.OPEN) {
        wsWebRTC.current.send(JSON.stringify({
          type: 'ice_candidate',
          candidate: event.candidate,
          to_user_id: userId
        }));
      }
    };

    if (isInitiator && localStream.current) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        wsWebRTC.current.send(JSON.stringify({
          type: 'offer',
          offer,
          to_user_id: userId
        }));
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }
  };

  const handleOffer = async (data) => {
    const userId = data.from_user_id;
    const username = data.from_username;

    let connection = peerConnections.current[userId];
    if (!connection) {
      await createPeerConnection(userId, username, false);
      connection = peerConnections.current[userId];
    }

    const pc = connection.pc;
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    wsWebRTC.current.send(JSON.stringify({
      type: 'answer',
      answer,
      to_user_id: userId
    }));
  };

  const handleAnswer = async (data) => {
    const connection = peerConnections.current[data.from_user_id];
    if (connection && connection.pc.signalingState === 'have-local-offer') {
      await connection.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  };

  const handleIceCandidate = async (data) => {
    const connection = peerConnections.current[data.from_user_id];
    if (connection && data.candidate) {
      try {
        await connection.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  };

  const addRemoteVideo = (userId, username, stream) => {
    const container = document.getElementById(`remote-container-${userId}`);
    if (container) return;

    const videosGrid = videosGridRef.current;
    if (!videosGrid) return;

    const div = document.createElement('div');
    div.id = `remote-container-${userId}`;
    div.className = 'relative bg-dark-200 rounded-xl overflow-hidden aspect-video border border-white/10 animate-fade-in video-container';
    div.innerHTML = `
      <video id="video-${userId}" autoplay playsinline class="w-full h-full object-cover"></video>
      <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">${escapeHtml(username[0]?.toUpperCase() || 'U')}</div>
          <span class="text-white text-sm font-cairo">${escapeHtml(username)}</span>
        </div>
      </div>
    `;
    videosGrid.appendChild(div);

    const videoElement = document.getElementById(`video-${userId}`);
    if (videoElement) {
      videoElement.srcObject = stream;
    }
  };

  const removeRemoteVideo = (userId) => {
    const container = document.getElementById(`remote-container-${userId}`);
    if (container) container.remove();

    const connection = peerConnections.current[userId];
    if (connection) {
      connection.pc.close();
      delete peerConnections.current[userId];
    }
  };

  const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // ========== Notification Sound ==========
  const audioCtx = useRef(null);

  const playJoinSound = () => {
    try {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtx.current;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1108.73, now + 0.1);
      osc.frequency.setValueAtTime(1318.51, now + 0.2);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      // Audio not supported, silently ignore
    }
  };

  // ========== Camera ==========
  const initCamera = async () => {
    try {
      setCameraError(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      localStream.current = stream;

      // Disable video track by default (camera starts off)
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) videoTrack.enabled = false;
      setIsVideoOff(true);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      addSystemMessage('تم تجهيز الكاميرا والصوت');
      return true;
    } catch (error) {
      console.error('Camera error:', error);
      setCameraError(true);
      addSystemMessage('تعذر الوصول إلى الكاميرا/الميكروفون');
      return false;
    }
  };

  // ========== Load Room ==========
  const loadRoomDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/rooms/${roomCode}/`);
      setRoomDetails(response.data);

      const participantsList = response.data.participants || [];
      setParticipants(participantsList);

      const currentParticipant = participantsList.find(p => p.user?.id === user?.id);
      if (currentParticipant?.role === 'host') {
        setIsHost(true);
      }

      const camOk = await initCamera();
      if (camOk) {
        addSystemMessage('تم تجهيز الكاميرا والصوت');
      }
      initWebSocket();
      initWebRTC();

    } catch (error) {
      console.error('Error loading room:', error);
      if (error.response?.status === 403) {
        alert('ليس لديك صلاحية الدخول لهذه الغرفة');
      } else {
        alert('حدث خطأ في تحميل الغرفة');
      }
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [roomCode, user?.id, navigate]);

  // ========== Send Message ==========
  const sendMessage = () => {
    if (!chatInput.trim()) return;

    if (!wsChat.current || wsChat.current.readyState !== WebSocket.OPEN) {
      addSystemMessage('غير متصل بالشات...');
      initWebSocket();
      return;
    }

    wsChat.current.send(JSON.stringify({
      type: 'message',
      message: chatInput
    }));

    addChatMessage('أنت', chatInput);
    setChatInput('');
  };

  // ========== Reactions ==========
  const sendReaction = (emoji) => {
    if (wsChat.current?.readyState === WebSocket.OPEN) {
      wsChat.current.send(JSON.stringify({
        type: 'reaction',
        emoji
      }));
    }
    showEmojiAnimation(emoji, 'أنت');
  };

  // ========== Controls ==========
  const toggleMute = () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        addSystemMessage(audioTrack.enabled ? 'تم تشغيل الميكروفون' : 'تم كتم الميكروفون');
      }
    }
  };

  const toggleVideo = () => {
    if (localStream.current) {
      const videoTrack = localStream.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        addSystemMessage(videoTrack.enabled ? 'تم تشغيل الكاميرا' : 'تم إيقاف الكاميرا');
      }
    }
  };

  const toggleHandRaise = async () => {
    try {
      const response = await api.post(`/rooms/${roomCode}/hand/`);
      setHandRaised(response.data.hand_raised);
      addSystemMessage(response.data.hand_raised ? 'تم رفع اليد' : 'تم إلغاء رفع اليد');
    } catch (error) {
      console.error('Error raising hand:', error);
    }
  };

  // ========== Host Actions ==========
  const muteParticipant = async (userId) => {
    try {
      await api.post(`/rooms/${roomCode}/mute/`, { user_id: userId });
      addSystemMessage('تم كتم المستخدم');
    } catch (error) {
      console.error('Error muting participant:', error);
    }
  };

  const kickParticipant = async (userId) => {
    if (confirm('هل أنت متأكد من طرد هذا المشارك؟')) {
      try {
        await api.post(`/rooms/${roomCode}/kick/`, { user_id: userId });
        addSystemMessage('تم طرد المستخدم');
      } catch (error) {
        console.error('Error kicking participant:', error);
      }
    }
  };

  const lockRoom = async () => {
    try {
      await api.post(`/rooms/${roomCode}/lock/`);
      setRoomDetails(prev => ({ ...prev, is_locked: !prev?.is_locked }));
      addSystemMessage(roomDetails?.is_locked ? 'تم فتح الغرفة' : 'تم قفل الغرفة');
    } catch (error) {
      console.error('Error locking room:', error);
    }
  };

  // ========== Leave Room ==========
  const leaveRoom = async () => {
    if (confirm('هل أنت متأكد من مغادرة الغرفة؟')) {
      try {
        await api.post(`/rooms/${roomCode}/leave/`);
        if (localStream.current) {
          localStream.current.getTracks().forEach(track => track.stop());
        }
        if (wsChat.current) wsChat.current.close();
        if (wsWebRTC.current) wsWebRTC.current.close();
        Object.values(peerConnections.current).forEach(conn => conn.pc.close());
        navigate('/dashboard');
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    addSystemMessage('تم نسخ رمز الغرفة');
  };

  // ========== Effect ==========
  useEffect(() => {
    loadRoomDetails();
    return () => {
      if (wsChat.current) wsChat.current.close();
      if (wsWebRTC.current) wsWebRTC.current.close();
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
      }
      Object.values(peerConnections.current).forEach(conn => conn.pc.close());
    };
  }, [loadRoomDetails]);

  // ========== Render ==========
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-primary-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary-500 animate-spin"></div>
            <div className="absolute inset-2 rounded-full bg-primary-500/10 flex items-center justify-center">
              <i className="fas fa-video text-primary-400 text-xl"></i>
            </div>
          </div>
          <p className="text-gray-400 text-lg font-cairo">جاري تحميل الغرفة...</p>
        </div>
      </div>
    );
  }

  const reactionButtons = [
    { emoji: '\u{1F44D}', icon: 'fa-thumbs-up' },
    { emoji: '\u{1F44F}', icon: 'fa-hands-clapping' },
    { emoji: '\u{1F602}', icon: 'fa-face-laugh' },
    { emoji: '\u2764\uFE0F', icon: 'fa-heart' },
    { emoji: '\u{1F389}', icon: 'fa-party-popper' },
  ];

  return (
    <div className="h-screen flex flex-col bg-[#0a0a1a]">
      {/* Header */}
      <header className="glass px-4 py-3 flex justify-between items-center z-20" style={{background: 'rgba(10, 10, 26, 0.9)'}}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white transition-colors w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">
            <i className="fas fa-arrow-right"></i>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
              <i className="fas fa-video text-white text-sm"></i>
            </div>
            <h1 className="text-lg font-bold text-white font-cairo">{roomDetails?.title}</h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 bg-white/5 px-3 py-1.5 rounded-lg">
            <i className="fas fa-code"></i>
            <span dir="ltr">{roomDetails?.meeting_code}</span>
          </div>
          {roomDetails?.is_locked && (
            <span className="text-red-400 text-sm flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded-lg">
              <i className="fas fa-lock"></i>
              مقفلة
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyRoomCode} className="btn-secondary text-sm py-2 px-3 flex items-center gap-2">
            <i className="fas fa-copy"></i>
            <span className="hidden sm:inline font-cairo">نسخ الرمز</span>
          </button>
          <button onClick={leaveRoom} className="btn-danger text-sm py-2 px-4 flex items-center gap-2">
            <i className="fas fa-sign-out-alt"></i>
            <span className="hidden sm:inline font-cairo">مغادرة</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-4 overflow-auto bg-gradient-to-br from-[#0a0a1a] to-[#0d0d24]">
          <div id="videosGrid" ref={videosGridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
            {/* Local Video */}
            <div className="relative bg-dark-200 rounded-xl overflow-hidden aspect-video border-2 border-primary-500/50 shadow-lg shadow-primary-500/10 animate-fade-in video-container">
              {cameraError ? (
                <div className="absolute inset-0 flex items-center justify-center bg-dark-300">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-2">
                      <i className="fas fa-user text-3xl text-primary-400"></i>
                    </div>
                    <p className="text-gray-500 text-sm font-cairo">الكاميرا غير متوفرة</p>
                  </div>
                </div>
              ) : (
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                      {getAvatarLetter(user?.username)}
                    </div>
                    <span className="text-white text-sm font-cairo">{user?.username}</span>
                    <span className="text-primary-300 text-xs bg-primary-500/20 px-1.5 py-0.5 rounded">أنت</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${isMuted ? 'bg-red-500/30 text-red-400' : 'bg-green-500/30 text-green-400'}`}>
                      <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                    </span>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${isVideoOff ? 'bg-red-500/30 text-red-400' : 'bg-green-500/30 text-green-400'}`}>
                      <i className={`fas ${isVideoOff ? 'fa-video-slash' : 'fa-video'}`}></i>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-96 sidebar-glass flex flex-col border-r border-white/5" style={{background: 'rgba(12, 12, 30, 0.95)'}}>
          {/* Tabs */}
          <div className="flex border-b border-white/5">
            <button
              onClick={() => { setShowParticipants(true); setShowChat(false); }}
              className={`flex-1 py-3 text-sm font-bold font-cairo transition-colors ${showParticipants ? 'text-primary-400 border-b-2 border-primary-500' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <i className="fas fa-users ml-1"></i>
              المشاركين
            </button>
            <button
              onClick={() => { setShowParticipants(false); setShowChat(true); }}
              className={`flex-1 py-3 text-sm font-bold font-cairo transition-colors ${showChat ? 'text-primary-400 border-b-2 border-primary-500' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <i className="fas fa-comments ml-1"></i>
              الشات
            </button>
          </div>

          {/* Participants */}
          {showParticipants && (
            <div className="p-3 space-y-1 overflow-y-auto flex-1">
              {participants.map((p, idx) => (
                <div key={p.id || idx} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500/30 to-purple-500/30 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {getAvatarLetter(p.user?.username)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white text-sm font-cairo truncate">{p.user?.username}</span>
                        {p.role === 'host' && (
                          <span className="text-yellow-400 text-xs" title="المضيف">
                            <i className="fas fa-crown"></i>
                          </span>
                        )}
                        {p.hand_raised && (
                          <span className="text-yellow-400 text-xs" title="رفع اليد">
                            <i className="fas fa-hand-paper"></i>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${p.is_muted ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                      <i className={`fas ${p.is_muted ? 'fa-microphone-slash' : 'fa-microphone'} text-[10px]`}></i>
                    </span>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${p.is_video_off ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                      <i className={`fas ${p.is_video_off ? 'fa-video-slash' : 'fa-video'} text-[10px]`}></i>
                    </span>
                    {isHost && p.user?.id !== user?.id && (
                      <>
                        <button onClick={() => muteParticipant(p.user?.id)} className="w-6 h-6 rounded-full bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-gray-400 hover:text-red-400 transition-all text-xs" title="كتم">
                          <i className="fas fa-volume-off"></i>
                        </button>
                        <button onClick={() => kickParticipant(p.user?.id)} className="w-6 h-6 rounded-full bg-white/5 hover:bg-orange-500/20 flex items-center justify-center text-gray-400 hover:text-orange-400 transition-all text-xs" title="طرد">
                          <i className="fas fa-user-slash"></i>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {participants.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <i className="fas fa-users text-4xl mb-3 opacity-30"></i>
                  <p className="font-cairo">لا يوجد مشاركون آخرون</p>
                </div>
              )}
            </div>
          )}

          {/* Chat */}
          {showChat && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className="animate-fade-in">
                    {msg.type === 'chat' && (
                      <div className={`flex ${msg.username === 'أنت' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[85%] p-2.5 rounded-2xl ${
                          msg.username === 'أنت'
                            ? 'bg-gradient-to-r from-primary-600 to-purple-600 rounded-tr-sm'
                            : 'bg-white/[0.06] rounded-tl-sm'
                        }`}>
                          <div className={`text-xs mb-0.5 ${msg.username === 'أنت' ? 'text-primary-200' : 'text-primary-400'}`}>
                            {msg.username}
                          </div>
                          <div className="text-white text-sm break-words">{msg.message}</div>
                          <div className={`text-[10px] mt-0.5 ${msg.username === 'أنت' ? 'text-primary-300' : 'text-gray-500'}`}>
                            {msg.timestamp}
                          </div>
                        </div>
                      </div>
                    )}
                    {msg.type === 'system' && (
                      <div className="flex justify-center">
                        <div className="text-gray-500 text-xs italic bg-white/[0.03] px-3 py-1.5 rounded-full font-cairo">
                          <i className="fas fa-circle text-[4px] ml-1 align-middle"></i>
                          {msg.message}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="p-3 border-t border-white/5">
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="اكتب رسالة..."
                    className="input-premium text-sm py-2"
                  />
                  <button onClick={sendMessage} className="btn-primary py-2 px-4 flex items-center justify-center">
                    <i className="fas fa-paper-plane"></i>
                  </button>
                </div>
                <div className="flex gap-2 justify-center">
                  {reactionButtons.map((r, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendReaction(r.emoji)}
                      className="w-9 h-9 rounded-full bg-white/[0.04] hover:bg-white/[0.1] hover:scale-125 transition-all flex items-center justify-center text-lg"
                      title={r.emoji}
                    >
                      {r.emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sidebar toggle hint on mobile */}
          <div className="hidden p-2 border-t border-white/5 text-center">
            <button onClick={() => setShowChat(!showChat)} className="text-gray-500 text-xs font-cairo">
              <i className="fas fa-exchange-alt ml-1"></i>
              تبديل
            </button>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
        <div className="glass flex items-center gap-3 p-2 rounded-2xl shadow-2xl" style={{background: 'rgba(15, 15, 35, 0.9)', border: '1px solid rgba(255,255,255,0.08)'}}>
          <button
            onClick={toggleMute}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
              isMuted
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-white/[0.06] text-white hover:bg-white/[0.12]'
            }`}
            title={isMuted ? 'تشغيل الميكروفون' : 'كتم الميكروفون'}
          >
            <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-lg`}></i>
          </button>

          <button
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
              isVideoOff
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-white/[0.06] text-white hover:bg-white/[0.12]'
            }`}
            title={isVideoOff ? 'تشغيل الكاميرا' : 'إيقاف الكاميرا'}
          >
            <i className={`fas ${isVideoOff ? 'fa-video-slash' : 'fa-video'} text-lg`}></i>
          </button>

          <button
            onClick={toggleHandRaise}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
              handRaised
                ? 'bg-yellow-500/20 text-yellow-400 animate-glow'
                : 'bg-white/[0.06] text-white hover:bg-white/[0.12]'
            }`}
            title={handRaised ? 'إلغاء رفع اليد' : 'رفع اليد'}
          >
            <i className="fas fa-hand-paper text-lg"></i>
          </button>

          <div className="w-px h-8 bg-white/10"></div>

          {isHost && (
            <button
              onClick={lockRoom}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                roomDetails?.is_locked
                  ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                  : 'bg-white/[0.06] text-white hover:bg-white/[0.12]'
              }`}
              title={roomDetails?.is_locked ? 'فتح الغرفة' : 'قفل الغرفة'}
            >
              <i className={`fas ${roomDetails?.is_locked ? 'fa-lock' : 'fa-lock-open'} text-lg`}></i>
            </button>
          )}

          <button
            onClick={() => { setShowChat(true); setShowParticipants(false); }}
            className="w-12 h-12 rounded-xl bg-white/[0.06] text-white hover:bg-white/[0.12] flex items-center justify-center transition-all duration-300 lg:hidden"
            title="الشات"
          >
            <i className="fas fa-comment-dots text-lg"></i>
          </button>

          <button
            onClick={copyRoomCode}
            className="w-12 h-12 rounded-xl bg-white/[0.06] text-white hover:bg-primary-500/20 hover:text-primary-400 flex items-center justify-center transition-all duration-300"
            title="نسخ الرمز"
          >
            <i className="fas fa-copy text-lg"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Room;
