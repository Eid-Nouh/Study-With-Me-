import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import path

from rooms.consumers import ChatConsumer, WebRTCConsumer

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter([
            path('ws/chat/<str:room_code>/', ChatConsumer.as_asgi()),
            path('ws/webrtc/<str:room_code>/', WebRTCConsumer.as_asgi()),
        ])
    ),
})