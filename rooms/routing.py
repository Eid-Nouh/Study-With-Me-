from django.urls import path
from . import consumers

websocket_urlpatterns = [
    path('ws/chat/<str:room_code>/', consumers.ChatConsumer.as_asgi()),
    path('ws/webrtc/<str:room_code>/', consumers.WebRTCConsumer.as_asgi()),
]