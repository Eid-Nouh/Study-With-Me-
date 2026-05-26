# rooms/admin.py

from django.contrib import admin
from .models import Room, Participant

@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ['title', 'meeting_code', 'created_by', 'created_at', 'is_active', 'is_locked']
    search_fields = ['title', 'meeting_code']
    list_filter = ['is_active', 'is_locked', 'created_at']

@admin.register(Participant)
class ParticipantAdmin(admin.ModelAdmin):
    list_display = ['room', 'user', 'role', 'joined_at', 'is_muted', 'hand_raised']
    list_filter = ['role', 'is_muted', 'hand_raised']