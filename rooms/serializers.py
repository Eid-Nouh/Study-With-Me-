from rest_framework import serializers
from .models import Room, Participant
from accounts.serializers import UserSerializer

class ParticipantSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Participant
        fields = ['id', 'user', 'role', 'joined_at', 'is_muted', 'is_video_off', 'hand_raised']

class RoomSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    participants = serializers.SerializerMethodField()
    participants_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Room
        fields = ['id', 'meeting_code', 'title', 'description', 'created_by', 
                  'created_at', 'is_active', 'is_locked', 'max_participants', 
                  'participants_count', 'participants']
    
    def get_participants_count(self, obj):
        return obj.get_participants_count()
    
    def get_participants(self, obj):
        active_participants = obj.participants.filter(left_at__isnull=True)
        return ParticipantSerializer(active_participants, many=True).data