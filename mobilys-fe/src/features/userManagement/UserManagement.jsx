import { Alert, Box, CircularProgress, Tab, Tabs, Typography } from "@mui/material";
import UsersTab from "../../components/user-management/user-tab/UsersTab";
import RolesTab from "../../components/user-management/role-tab/RolesTab";
import OrganizationTab from "../../components/user-management/organization-tab/OrganizationTab";
import ProjectTab from "../../components/user-management/project-tab/ProjectTab";
import { USER } from "../../strings";
import { useUserManagement } from "./hooks/useUserManagement";

export default function UserManagement() {
  const ui = USER.userManagement;
  const {
    tab,
    setTab,
    users,
    roles,
    orgs,
    projects,
    loadingAll,
    error,
    loadingProjects,
    loadingOrgs,
    refreshAll,
    createUser,
    updateUser,
    removeUser,
    toggleUserActive,
    createRole,
    updateRole,
    removeRole,
    fetchAccessListApi,
    createOrganization,
    updateOrganization,
    removeOrganization,
    toggleOrganizationActive,
    createProject,
    updateProject,
    removeProject,
    toggleProjectActiveApi,
    fetchUserProjectApi,
    addUserToProjectApi,
    addOrganizationToProjectApi,
    removeUserFromProjectApi,
    removeOrganizationFromProjectApi,
  } = useUserManagement();

  if (loadingAll) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box
      sx={{
        height: "86vh",
        boxSizing: "border-box",
        overflow: "visible",
        display: "flex",
        flexDirection: "column",
        mt: -4,
      }}
    >
      <Typography variant="h4" sx={{ fontWeight: 600, ml: 1, mb: 1 }}>
        {ui.title}
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        textColor="primary"
        indicatorColor="primary"
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 3,
          minHeight: 42,
          ".MuiTab-root": {
            textTransform: "none",
            fontSize: 16,
            minWidth: 0,
            px: 3,
            py: 1,
            color: "text.secondary",
          },
          ".Mui-selected": {
            color: "primary.main",
            fontWeight: 600,
          },
          ".MuiTabs-indicator": {
            height: 3,
            borderRadius: 1,
          },
        }}
      >
        <Tab label={ui.tabs.users} />
        <Tab label={ui.tabs.roles} />
        <Tab label={ui.tabs.organizations} />
        <Tab label={ui.tabs.projects} />
      </Tabs>

      {tab === 0 && (
        <UsersTab
          users={users}
          roles={roles}
          organizations={orgs}
          onRefresh={refreshAll}
          createUser={createUser}
          updateUser={updateUser}
          removeUser={removeUser}
          toggleUserActive={toggleUserActive}
        />
      )}

      {tab === 1 && (
        <RolesTab
          roles={roles}
          onRefresh={refreshAll}
          loading={loadingAll}
          createRole={createRole}
          updateRole={updateRole}
          removeRole={removeRole}
          fetchAccessListApi={fetchAccessListApi}
        />
      )}

      {tab === 2 && (
        <OrganizationTab
          orgs={orgs}
          users={users}
          onRefresh={refreshAll}
          loading={loadingOrgs}
          createOrganization={createOrganization}
          updateOrganization={updateOrganization}
          removeOrganization={removeOrganization}
          toggleOrganizationActive={toggleOrganizationActive}
        />
      )}

      {tab === 3 && (
        <ProjectTab
          projects={projects}
          users={users}
          organizations={orgs}
          onRefresh={refreshAll}
          loading={loadingProjects}
          createProject={createProject}
          updateProject={updateProject}
          removeProject={removeProject}
          toggleProjectActiveApi={toggleProjectActiveApi}
          fetchUserProjectApi={fetchUserProjectApi}
          addUserToProjectApi={addUserToProjectApi}
          addOrganizationToProjectApi={addOrganizationToProjectApi}
          removeUserFromProjectApi={removeUserFromProjectApi}
          removeOrganizationFromProjectApi={removeOrganizationFromProjectApi}
        />
      )}
    </Box>
  );
}
