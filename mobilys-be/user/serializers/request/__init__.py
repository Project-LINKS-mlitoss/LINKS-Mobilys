# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from user.serializers.request.user_request import (
    CreateUserRequestSerializer,
    UpdateUserRequestSerializer,
    ChangePasswordRequestSerializer,
    ListUsersRequestSerializer,
)
from user.serializers.request.project_request import (
    CreateProjectRequestSerializer,
    UpdateProjectRequestSerializer,
    AssignUsersRequestSerializer,
    ListProjectsRequestSerializer,
    AssignOrganizationUsersRequestSerializer,
)
from user.serializers.request.organization_request import (
    CreateOrganizationRequestSerializer,
    UpdateOrganizationRequestSerializer,
    ChangeOrganizerRequestSerializer,
    ListOrganizationsRequestSerializer,
    ListOrganizationsByOrganizerRequestSerializer,
)
from user.serializers.request.role_request import (
    CreateRoleRequestSerializer,
    UpdateRoleRequestSerializer,
    ListRolesRequestSerializer,
)
from user.serializers.request.access_request import (
    CreateAccessRequestSerializer,
    UpdateAccessRequestSerializer,
    ListAccessesRequestSerializer,
)

__all__ = [
    # User
    'CreateUserRequestSerializer',
    'UpdateUserRequestSerializer',
    'ChangePasswordRequestSerializer',
    'ListUsersRequestSerializer',
    # Project
    'CreateProjectRequestSerializer',
    'UpdateProjectRequestSerializer',
    'AssignUsersRequestSerializer',
    'ListProjectsRequestSerializer',
    'AssignOrganizationUsersRequestSerializer',
    # Organization
    'CreateOrganizationRequestSerializer',
    'UpdateOrganizationRequestSerializer',
    'ChangeOrganizerRequestSerializer',
    'ListOrganizationsRequestSerializer',
    'ListOrganizationsByOrganizerRequestSerializer',
    # Role
    'CreateRoleRequestSerializer',
    'UpdateRoleRequestSerializer',
    'ListRolesRequestSerializer',
    # Access
    'CreateAccessRequestSerializer',
    'UpdateAccessRequestSerializer',
    'ListAccessesRequestSerializer',
]
