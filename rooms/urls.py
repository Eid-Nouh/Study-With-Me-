from django.urls import path
from . import views

urlpatterns = [
    path('create/', views.CreateRoomView.as_view(), name='create-room'),
    path('join/', views.JoinRoomView.as_view(), name='join-room'),
    path('my-rooms/', views.MyRoomsView.as_view(), name='my-rooms'),
    path('<str:meeting_code>/', views.RoomDetailsView.as_view(), name='room-details'),
    path('<str:meeting_code>/leave/', views.LeaveRoomView.as_view(), name='leave-room'),
    path('<str:meeting_code>/hand/', views.RaiseHandView.as_view(), name='raise-hand'),
    path('<str:meeting_code>/mute/', views.MuteParticipantView.as_view(), name='mute-participant'),
    path('<str:meeting_code>/kick/', views.KickParticipantView.as_view(), name='kick-participant'),
    path('<str:meeting_code>/lock/', views.LockRoomView.as_view(), name='lock-room'),
]
