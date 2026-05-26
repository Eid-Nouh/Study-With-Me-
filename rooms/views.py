from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Room, Participant
from .serializers import RoomSerializer
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

class CreateRoomView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        title = request.data.get('title')
        description = request.data.get('description', '')

        if not title:
            return Response({'error': 'العنوان مطلوب'}, status=status.HTTP_400_BAD_REQUEST)

        room = Room.objects.create(title=title, description=description, created_by=request.user)
        Participant.objects.create(room=room, user=request.user, role='host')

        return Response({'room': RoomSerializer(room).data}, status=status.HTTP_201_CREATED)

class JoinRoomView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        meeting_code = request.data.get('meeting_code', '').upper()
        room = get_object_or_404(Room, meeting_code=meeting_code, is_active=True)

        if room.is_locked:
            return Response({'error': 'الغرفة مقفلة'}, status=status.HTTP_403_FORBIDDEN)

        participant, created = Participant.objects.get_or_create(
            room=room, user=request.user,
            defaults={'role': 'participant'}
        )

        if not created and participant.left_at:
            participant.left_at = None
            participant.save()

        return Response({'room': RoomSerializer(room).data})

class MyRoomsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rooms = Room.objects.filter(
            participants__user=request.user,
            participants__left_at__isnull=True,
            is_active=True
        )
        return Response(RoomSerializer(rooms, many=True).data)

class RoomDetailsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, meeting_code):
        room = get_object_or_404(Room, meeting_code=meeting_code, is_active=True)

        if not Participant.objects.filter(room=room, user=request.user, left_at__isnull=True).exists():
            return Response({'error': 'لست مشاركاً في هذه الغرفة'}, status=status.HTTP_403_FORBIDDEN)

        return Response(RoomSerializer(room).data)

class LeaveRoomView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, meeting_code):
        room = get_object_or_404(Room, meeting_code=meeting_code)
        participant = Participant.objects.filter(room=room, user=request.user, left_at__isnull=True).first()

        if participant:
            participant.left_at = timezone.now()
            participant.save()

            # Broadcast to chat group
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f'chat_{room.meeting_code}',
                {
                    'type': 'chat_message',
                    'message': {
                        'type': 'system',
                        'message': f'{request.user.username} غادر الغرفة'
                    }
                }
            )

        return Response({'message': 'تم مغادرة الغرفة'})

class RaiseHandView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, meeting_code):
        room = get_object_or_404(Room, meeting_code=meeting_code)

        participant = Participant.objects.filter(
            room=room,
            user=request.user,
            left_at__isnull=True
        ).first()

        if not participant:
            return Response({'error': 'أنت لست مشاركاً في هذه الغرفة'},
                          status=status.HTTP_403_FORBIDDEN)

        participant.hand_raised = not participant.hand_raised
        participant.save()

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'chat_{room.meeting_code}',
            {
                'type': 'chat_message',
                'message': {
                    'type': 'raise_hand',
                    'username': request.user.username,
                    'raised': participant.hand_raised
                }
            }
        )

        return Response({
            'hand_raised': participant.hand_raised,
            'message': 'تم رفع اليد' if participant.hand_raised else 'تم إلغاء رفع اليد'
        })

class MuteParticipantView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, meeting_code):
        room = get_object_or_404(Room, meeting_code=meeting_code)
        target_user_id = request.data.get('user_id')

        if not target_user_id:
            return Response({'error': 'معرف المستخدم مطلوب'}, status=status.HTTP_400_BAD_REQUEST)

        host_participant = Participant.objects.filter(
            room=room, user=request.user, role='host', left_at__isnull=True
        ).first()

        if not host_participant:
            return Response({'error': 'أنت لست مضيف الغرفة'}, status=status.HTTP_403_FORBIDDEN)

        target_participant = Participant.objects.filter(
            room=room, user_id=target_user_id, left_at__isnull=True
        ).first()

        if not target_participant:
            return Response({'error': 'المستخدم غير موجود في الغرفة'}, status=status.HTTP_404_NOT_FOUND)

        target_participant.is_muted = True
        target_participant.save()

        # Send mute notification directly to the target user
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'user_{target_user_id}',
            {
                'type': 'webrtc_signal',
                'message': {
                    'type': 'you_were_muted',
                    'by': request.user.username,
                }
            }
        )

        return Response({'message': 'تم كتم المستخدم', 'is_muted': True})

class KickParticipantView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, meeting_code):
        room = get_object_or_404(Room, meeting_code=meeting_code)
        target_user_id = request.data.get('user_id')

        if not target_user_id:
            return Response({'error': 'معرف المستخدم مطلوب'}, status=status.HTTP_400_BAD_REQUEST)

        host_participant = Participant.objects.filter(
            room=room, user=request.user, role='host', left_at__isnull=True
        ).first()

        if not host_participant:
            return Response({'error': 'أنت لست مضيف الغرفة'}, status=status.HTTP_403_FORBIDDEN)

        target_participant = Participant.objects.filter(
            room=room, user_id=target_user_id, left_at__isnull=True
        ).first()

        if not target_participant:
            return Response({'error': 'المستخدم غير موجود في الغرفة'}, status=status.HTTP_404_NOT_FOUND)

        target_participant.left_at = timezone.now()
        target_participant.save()

        # Send kick notification directly to the target user
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'user_{target_user_id}',
            {
                'type': 'webrtc_signal',
                'message': {
                    'type': 'you_were_kicked',
                    'by': request.user.username,
                }
            }
        )

        # Broadcast system message to chat
        async_to_sync(channel_layer.group_send)(
            f'chat_{room.meeting_code}',
            {
                'type': 'chat_message',
                'message': {
                    'type': 'system',
                    'message': f'تم طرد {target_participant.user.username} بواسطة {request.user.username}'
                }
            }
        )

        return Response({'message': 'تم طرد المستخدم'})

class LockRoomView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, meeting_code):
        room = get_object_or_404(Room, meeting_code=meeting_code)

        participant = Participant.objects.filter(
            room=room, user=request.user, role='host', left_at__isnull=True
        ).first()

        if not participant:
            return Response({'error': 'أنت لست مضيف الغرفة'}, status=status.HTTP_403_FORBIDDEN)

        room.is_locked = not room.is_locked
        room.save()

        # Broadcast to chat
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'chat_{room.meeting_code}',
            {
                'type': 'chat_message',
                'message': {
                    'type': 'system',
                    'message': f'تم {"قفل" if room.is_locked else "فتح"} الغرفة بواسطة {request.user.username}'
                }
            }
        )

        return Response({
            'message': f'تم {"قفل" if room.is_locked else "فتح"} الغرفة',
            'is_locked': room.is_locked
        })
