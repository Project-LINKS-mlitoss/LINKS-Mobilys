import os

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from user.models import Access, Role, RoleAccessMap, UserDetail

User = get_user_model()


def _ensure_default_admin_user(command: BaseCommand) -> User:
    username = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
    email = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@example.com")
    password = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin")

    user, created = User.objects.get_or_create(
        username=username,
        defaults={
            "email": email,
            "is_staff": True,
            "is_superuser": True,
            "is_active": True,
        },
    )

    if created:
        user.set_password(password)
        user.save()
        command.stdout.write(
            command.style.SUCCESS(f'  Created default admin user "{username}"')
        )
        return user

    updated = False
    if not user.is_superuser:
        user.is_superuser = True
        updated = True
    if not user.is_staff:
        user.is_staff = True
        updated = True
    if not user.is_active:
        user.is_active = True
        updated = True

    if updated:
        user.save()
        command.stdout.write(
            command.style.NOTICE(f'  Updated default admin user permissions for "{username}"')
        )

    return user

class Command(BaseCommand):
    help = 'Populate initial data for Access, Role, RoleAccessMap, and UserDetail tables'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete all existing data before populating',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.HTTP_INFO('=' * 60))
        self.stdout.write(self.style.HTTP_INFO('Populating Initial Data'))
        self.stdout.write(self.style.HTTP_INFO('=' * 60))

        # === POPULATE ROLES ===
        self.stdout.write(self.style.HTTP_INFO('\n[1/4] Populating Roles...'))
        
        if options['clear']:
            count = Role.objects.count()
            Role.objects.all().delete()
            self.stdout.write(
                self.style.WARNING(f'Deleted {count} existing role records')
            )

        roles_data = [
            ('Super User', 'super_user', True, 'Full system access with all permissions'),
            ('Organizer', 'organizer', True, 'Can manage organization and its members'),
            ('User', 'user', True, 'Standard user with basic permissions'),
        ]

        roles_created = 0
        roles_skipped = 0

        for role_name, level, active, description in roles_data:
            if Role.objects.filter(level=level).exists():
                self.stdout.write(
                    self.style.WARNING(f'  Skipped: {role_name} ({level})')
                )
                roles_skipped += 1
            else:
                Role.objects.create(
                    role_name=role_name,
                    level=level,
                    active=active,
                    description=description
                )
                self.stdout.write(
                    self.style.SUCCESS(f'  Created: {role_name} ({level})')
                )
                roles_created += 1

        # === POPULATE ACCESS ===
        self.stdout.write(self.style.HTTP_INFO('\n[2/4] Populating Access...'))
        
        if options['clear']:
            count = Access.objects.count()
            Access.objects.all().delete()
            self.stdout.write(
                self.style.WARNING(f'Deleted {count} existing access records')
            )

        access_data = [
            ('GTFSデータインポート', 'import-data'),
            ('関連データインポート', 'additional-data'),
            ('シナリオ編集', 'edit-data'),
            ('運行頻度分析', 'number-of-bus-running-visualization'),
            ('到達圏分析（バッファ）', 'buffer-analysis'),
            ('到達圏分析（OSM）', 'road-network-analysis'),
            ('到達圏分析（DRM）', 'road-network-analysis-drm'),
            ('経路・時刻表', 'route-timetable'),
            ('公共交通圏域', 'stop-radius-analysis'),
            ('乗降分析', 'boarding-alighting-analysis'),
            ('ODデータ分析', 'od-analysis'),
            ('シミュレーションシ', 'simulation'),
            ('ホーム','scenarios'),
            ('パスワード変更', 'password-change'),
        ]

        access_created = 0
        access_skipped = 0

        for name, code in access_data:
            if Access.objects.filter(access_code=code).exists():
                self.stdout.write(
                    self.style.WARNING(f'  Skipped: {code}')
                )
                access_skipped += 1
            else:
                Access.objects.create(
                    access_name=name,
                    access_code=code,
                    description=None
                )
                self.stdout.write(
                    self.style.SUCCESS(f'  Created: {name} ({code})')
                )
                access_created += 1

        # === POPULATE ROLE ACCESS MAP ===
        self.stdout.write(self.style.HTTP_INFO('\n[3/4] Populating Role-Access Mappings...'))
        
        if options['clear']:
            count = RoleAccessMap.objects.count()
            RoleAccessMap.objects.all().delete()
            self.stdout.write(
                self.style.WARNING(f'Deleted {count} existing role-access mapping records')
            )

        # Get all roles and access
        all_roles = Role.objects.all()
        all_access = Access.objects.all()

        if not all_roles.exists():
            self.stdout.write(
                self.style.ERROR('  Error: No roles found. Please create roles first.')
            )
            return

        if not all_access.exists():
            self.stdout.write(
                self.style.ERROR('  Error: No access found. Please create access first.')
            )
            return

        mapping_created = 0
        mapping_skipped = 0

        # Map every role to every access
        for role in all_roles:
            for access in all_access:
                # Check whether the mapping already exists
                if RoleAccessMap.objects.filter(role=role, access=access).exists():
                    mapping_skipped += 1
                else:
                    RoleAccessMap.objects.create(
                        role=role,
                        access=access
                    )
                    self.stdout.write(
                        self.style.SUCCESS(f'  Mapped: {role.role_name} → {access.access_code}')
                    )
                    mapping_created += 1

        # === POPULATE USER DETAILS ===
        self.stdout.write(self.style.HTTP_INFO('\n[4/4] Populating User Details...'))
        
        if options['clear']:
            count = UserDetail.objects.count()
            UserDetail.objects.all().delete()
            self.stdout.write(
                self.style.WARNING(f'Deleted {count} existing user detail records')
            )

        # Get roles
        try:
            super_user_role = Role.objects.get(level='super_user')
            user_role = Role.objects.get(level='user')
        except Role.DoesNotExist:
            self.stdout.write(
                self.style.ERROR('  Error: Required roles not found. Please run roles creation first.')
            )
            return

        # Get all users
        all_users = list(User.objects.all())
        if not all_users:
            self.stdout.write(self.style.NOTICE("No users found; creating default admin user..."))
            admin_user = _ensure_default_admin_user(self)
            all_users = [admin_user] if admin_user else list(User.objects.all())

        if not all_users:
            self.stdout.write(
                self.style.WARNING('  No users found in auth_user table.')
            )
            user_detail_created = 0
            user_detail_skipped = 0
        else:
            user_detail_created = 0
            user_detail_skipped = 0
            for user in all_users:
                # Check whether the user already has a UserDetail
                if hasattr(user, 'user_detail'):
                    self.stdout.write(
                        self.style.WARNING(f'  Skipped: {user.username} (already has user detail)')
                    )
                    user_detail_skipped += 1
                else:
                    # Determine role according to is_superuser
                    assigned_role = super_user_role if user.is_superuser else user_role
                    
                    UserDetail.objects.create(
                        user=user,
                        role=assigned_role,
                        organization=None,
                        created_by=None,
                        description=f'Auto-generated user detail for {user.username}'
                    )
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'  Created: {user.username} → {assigned_role.role_name}'
                        )
                    )
                    user_detail_created += 1

        # === SUMMARY ===
        self.stdout.write(self.style.HTTP_INFO('\n' + '=' * 60))
        self.stdout.write(self.style.HTTP_INFO('Summary:'))
        self.stdout.write(self.style.SUCCESS(
            f'  Roles            - Created: {roles_created}, Skipped: {roles_skipped}'
        ))
        self.stdout.write(self.style.SUCCESS(
            f'  Access           - Created: {access_created}, Skipped: {access_skipped}'
        ))
        self.stdout.write(self.style.SUCCESS(
            f'  Role-Access Maps - Created: {mapping_created}, Skipped: {mapping_skipped}'
        ))
        self.stdout.write(self.style.SUCCESS(
            f'  User Details     - Created: {user_detail_created}, Skipped: {user_detail_skipped}'
        ))
        self.stdout.write(self.style.HTTP_INFO('=' * 60))
        self.stdout.write(self.style.SUCCESS('\n✓ Initial data population completed!'))
        
        total_roles = Role.objects.count()
        total_access = Access.objects.count()
        total_mappings = RoleAccessMap.objects.count()
        total_user_details = UserDetail.objects.count()
        total_users = User.objects.count()
        
        self.stdout.write(self.style.HTTP_INFO('\nCurrent Database State:'))
        self.stdout.write(f'  Total Users: {total_users}')
        self.stdout.write(f'  Total User Details: {total_user_details}')
        self.stdout.write(f'  Total Roles: {total_roles}')
        self.stdout.write(f'  Total Access: {total_access}')
        self.stdout.write(f'  Total Role-Access Mappings: {total_mappings}')
