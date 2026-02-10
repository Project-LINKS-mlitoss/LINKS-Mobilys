# core/test_runner.py
from django.test.runner import DiscoverRunner

class NoDbTestRunner(DiscoverRunner):
    """Use the real DB (skip creating a test DB)."""
    def setup_databases(self, **kwargs):
        return None  # don't create test DB

    def teardown_databases(self, old_config, **kwargs):
        pass  # nothing to tear down
