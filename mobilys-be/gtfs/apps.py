from django.apps import AppConfig


class ImportConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'gtfs'

    def ready(self):
        import gtfs.signals
