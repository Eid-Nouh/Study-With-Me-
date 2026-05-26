import json
from channels.generic.websocket import AsyncWebsocketConsumer
from urllib.parse import parse_qs
from rest_framework_simplejwt.tokens import AccessToken
from accounts.models import User
from channels.db import database_sync_to_async

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_code = self.scope['url_route']['kwargs']['room_code']
        self.room_group_name = f'chat_{self.room_code}'

        query_string = self.scope['query_string'].decode()
        params = parse_qs(query_string)
        token = params.get('token', [None])[0]

        if not token:
            print("No token provided")
            await self.close()
            return

        try:
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            self.user = await self.get_user(user_id)
            if not self.user:
                await self.close()
                return
        except Exception as e:
            print(f"Token error: {e}")
            await self.close()
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # Send participants list to all
        participants = await self.get_participants(self.room_code)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': {
                    'type': 'participants_list',
                    'participants': participants
                }
            }
        )

        # Notify others
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': {
                    'type': 'system',
                    'message': f'{self.user.username} انضم إلى الغرفة'
                }
            }
        )

        # Send welcome
        await self.send(text_data=json.dumps({
            'type': 'system',
            'message': f'مرحباً {self.user.username} في غرفة {self.room_code}'
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            # Notify others
            if hasattr(self, 'user'):
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message',
                        'message': {
                            'type': 'system',
                            'message': f'{self.user.username} غادر الغرفة'
                        }
                    }
                )
                # Updated participants list
                participants = await self.get_participants(self.room_code)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message',
                        'message': {
                            'type': 'participants_list',
                            'participants': participants
                        }
                    }
                )
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get('type', '')

        if msg_type == 'message':
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': {
                        'type': 'chat',
                        'username': getattr(self, 'user', None).username if hasattr(self, 'user') else 'مستخدم',
                        'message': data.get('message', ''),
                    }
                }
            )
        elif msg_type == 'reaction':
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': {
                        'type': 'reaction',
                        'username': getattr(self, 'user', None).username if hasattr(self, 'user') else 'مستخدم',
                        'emoji': data.get('emoji', ''),
                    }
                }
            )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event['message']))

    @database_sync_to_async
    def get_user(self, user_id):
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None

    @database_sync_to_async
    def get_participants(self, room_code):
        from .models import Room, Participant
        from .serializers import ParticipantSerializer
        try:
            room = Room.objects.get(meeting_code=room_code, is_active=True)
            participants = Participant.objects.filter(room=room, left_at__isnull=True)
            return ParticipantSerializer(participants, many=True).data
        except Room.DoesNotExist:
            return []

class WebRTCConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_code = self.scope['url_route']['kwargs']['room_code']
        self.webrtc_group_name = f'webrtc_{self.room_code}'

        query_string = self.scope['query_string'].decode()
        params = parse_qs(query_string)
        token = params.get('token', [None])[0]

        if not token:
            await self.close()
            return

        try:
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            self.user = await self.get_user(user_id)
            if not self.user:
                await self.close()
                return
        except Exception:
            await self.close()
            return

        self.user_group_name = f'user_{self.user.id}'

        await self.channel_layer.group_add(self.webrtc_group_name, self.channel_name)
        await self.channel_layer.group_add(self.user_group_name, self.channel_name)
        await self.accept()

        # Notify others in room about new user
        await self.channel_layer.group_send(
            self.webrtc_group_name,
            {
                'type': 'webrtc_signal',
                'message': {
                    'type': 'user_joined',
                    'user_id': self.user.id,
                    'username': self.user.username
                },
                'sender_channel': self.channel_name
            }
        )

    async def disconnect(self, close_code):
        if hasattr(self, 'webrtc_group_name'):
            # Notify others
            if hasattr(self, 'user'):
                await self.channel_layer.group_send(
                    self.webrtc_group_name,
                    {
                        'type': 'webrtc_signal',
                        'message': {
                            'type': 'user_left',
                            'user_id': self.user.id,
                            'username': self.user.username
                        },
                        'sender_channel': self.channel_name
                    }
                )
            await self.channel_layer.group_discard(self.webrtc_group_name, self.channel_name)
            if hasattr(self, 'user_group_name'):
                await self.channel_layer.group_discard(self.user_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        to_user_id = data.get('to_user_id')

        if to_user_id:
            # Send directly to specific user
            await self.channel_layer.group_send(
                f'user_{to_user_id}',
                {
                    'type': 'webrtc_signal',
                    'message': {
                        **data,
                        'from_user_id': self.user.id,
                        'from_username': self.user.username
                    },
                    'sender_channel': self.channel_name
                }
            )

    async def webrtc_signal(self, event):
        if event.get('sender_channel') != self.channel_name:
            await self.send(text_data=json.dumps(event['message']))

    @database_sync_to_async
    def get_user(self, user_id):
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None
