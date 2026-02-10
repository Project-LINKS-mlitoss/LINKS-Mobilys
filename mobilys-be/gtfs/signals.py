from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from gtfs.models import Profile, Map

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        try:
            default_map = Map.objects.get(name="Pale Map（淡色地図）") 
        except Map.DoesNotExist:
            default_map = None

        Profile.objects.create(user=instance, map=default_map)
