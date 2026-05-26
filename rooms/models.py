from django.db import models
from django.conf import settings
import random
import string

def generate_meeting_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

class Room(models.Model):
    meeting_code = models.CharField(max_length=10, unique=True, default=generate_meeting_code)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_rooms')
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    is_locked = models.BooleanField(default=False)
    max_participants = models.IntegerField(default=10)
    
    def __str__(self):
        return f"{self.title} ({self.meeting_code})"
    
    def get_participants_count(self):
        return self.participants.filter(left_at__isnull=True).count()

class Participant(models.Model):
    ROLE_CHOICES = [('host', 'منظم'), ('participant', 'مشارك')]
    
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='room_participants')
    joined_at = models.DateTimeField(auto_now_add=True)
    left_at = models.DateTimeField(null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='participant')
    is_muted = models.BooleanField(default=False)
    is_video_off = models.BooleanField(default=False)
    hand_raised = models.BooleanField(default=False)
    
    class Meta:
        unique_together = ['room', 'user']