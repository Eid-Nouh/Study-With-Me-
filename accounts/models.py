from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    full_name = models.CharField(max_length=255, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(auto_now=True)
    
    friends = models.ManyToManyField('self', symmetrical=False, blank=True, related_name='friend_of')
    blocked_users = models.ManyToManyField('self', symmetrical=False, blank=True, related_name='blocked_by')
    
    def __str__(self):
        return self.username
    
    class Meta:
        verbose_name = 'مستخدم'
        verbose_name_plural = 'المستخدمون'