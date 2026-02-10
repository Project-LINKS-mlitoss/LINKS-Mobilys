import { Box, Button } from "@mui/material";
import { useMemo } from "react";
import { BUTTONS } from "../../../strings";
import StopFormModal from "./StopFormModal";
import StopDeleteConfirmModal from "./StopDeleteConfirmationModal";
import StopGroupTable from "./StopGroupTable";
import StopFormChildModal from "./StopFormChildModal";

const StopEdit = ({
  stopGroups,
  action,
  setAction,
  onCreateChild,
  onCreate,
  onEdit,   // masih diterima, tapi untuk tombol Edit di bawah kita langsung pakai setAction agar bisa sisipkan label
  onDelete,
  onFormSubmit,
  groupingMethod,
  onGroupTypeChange,
}) => {
  const actionTypes = {
    EDIT: "edit",
    DELETE: "delete",
    CREATE: "create",
    CREATE_CHILD: "create_child",
  };

  // map: { [stop_id]: groupObjFrom_stops_groups_by_id }
  const stopIdToIdGroup = useMemo(() => {
    const map = {};
    (stopGroups?.stops_groups_by_id || []).forEach(g => {
      (g.stops || []).forEach(s => { map[s.stop_id] = g; });
    });
    return map;
  }, [stopGroups]);

  return (
    <Box
      sx={{
        maxWidth: "100",
        bgcolor: "#fff",
        borderRadius: 3,
      }}>
      <StopDeleteConfirmModal
        open={!!action && action.type === "delete"}
        stop={action?.payload}
        onClose={() => setAction(null)}
        onDelete={onDelete}
        loading={false}
      />

      <StopFormModal
        open={
          !!action &&
          (action.type === actionTypes.EDIT ||
            action.type === actionTypes.CREATE)
        }
        mode={action?.type === actionTypes.EDIT ? "edit" : "create"}
        initialValues={
          action?.type === actionTypes.EDIT
            ? {
              ...action.payload,
              translations: action.payload.translations || [],
            }
            : {
              // create mode -> kosongkan semua termasuk 2 label baru
              parent_stop_id_label: "",
              parent_stop_name_label: "",
              stop_name: "",
              stop_id: "",
              stop_lat: "",
              stop_lon: "",
              translations: [],
            }
        }
        onClose={() => setAction(null)}
        onSubmit={onFormSubmit}
        disableFields={
          action?.type === actionTypes.EDIT ? ["stop_id", "stop_name"] : []
        }
      />

      <StopFormChildModal
        stopIdGroupOptions={stopGroups?.stops_groups_by_id?.map((group) => ({
          value: group.stop_id_group_id,
          label: group.stop_id_group,
        }))}
        stopNameGroupOptions={stopGroups?.stops_groups_by_name?.map(
          (group) => ({
            value: group.group_id,
            label: group.stop_name_group,
          })
        )}
        open={!!action && action.type === actionTypes.CREATE_CHILD}
        initialValues={
          action?.type === actionTypes.CREATE_CHILD ? action.payload : {}
        }
        onClose={() => setAction(null)}
        onSubmit={onFormSubmit}
      />

      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
        }}></Box>

      {stopGroups && (
        <StopGroupTable
          data={stopGroups || []}
          groupType={groupingMethod}
          onGroupTypeChange={onGroupTypeChange}
          onCreateChild={onCreateChild}
          onCreate={onCreate}
          renderRowActions={(stop, group) => (
            <>
              {/* ACTION BUTTONS */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 1,
                }}
              >
                {/* EDIT */}
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  onClick={() => {
                    const groupedByName =
                      groupingMethod === "stop_names" || groupingMethod === "stop_name";

                    const parentStopNameLabel =
                      (groupedByName
                        ? (group?.stop_name_group ?? group?.group_key)
                        : (typeof stop.stop_name === "string"
                          ? stop.stop_name.split("_")[0]
                          : "")
                      ) || "";

                    const stopIdPrefix =
                      typeof stop.stop_id === "string" ? stop.stop_id.split("_")[0] : "";

                    const parentStopIdLabel =
                      groupedByName
                        ? (group?.stop_group_id_label || "")
                        : (group?.stop_id_group ?? stopIdPrefix);

                    setAction({
                      type: actionTypes.EDIT,
                      payload: {
                        ...stop,
                        translations: stop.translations || [],
                        parent_stop_name_label: parentStopNameLabel,
                        parent_stop_id_label: parentStopIdLabel,
                      },
                    });
                  }}
                >
                  {BUTTONS.common.edit}
                </Button>

                {/* DUPLICATE / CREATE_CHILD */}
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    const groupedByName =
                      groupingMethod === "stop_names" || groupingMethod === "stop_name";

                    const parentStopNameLabel =
                      (groupedByName
                        ? (group?.stop_name_group ?? group?.group_key)
                        : (typeof stop.stop_name === "string"
                          ? stop.stop_name.split("_")[0]
                          : "")
                      ) || "";

                    const stopIdPrefix =
                      typeof stop.stop_id === "string" ? stop.stop_id.split("_")[0] : "";

                    const parentStopIdLabel =
                      groupedByName
                        ? (group?.stop_group_id_label || "")
                        : (group?.stop_id_group ?? stopIdPrefix);

                    setAction({
                      type: actionTypes.CREATE_CHILD,
                      payload: {
                        parent_stop_name_label: parentStopNameLabel,
                        parent_stop_id_label: parentStopIdLabel,
                        parent_stop_source_id: stop.stop_id,
                        stop_id: String(stop.stop_id || ""),
                        stop_name: String(stop.stop_name || ""),
                        stop_lat: Number(stop.stop_lat),
                        stop_lon: Number(stop.stop_lon),
                        stop_code: stop.stop_code || "",
                      },
                    });
                  }}
                >
                  {BUTTONS.common.duplicate}
                </Button>

                {/* DELETE (icon) */}
                <Button
                  variant="outlined"
                  size="small"
                  color="primary"
                  onClick={() => setAction({ type: "delete", payload: stop })}
                  // or: onClick={() => setAction({ type: actionTypes.DELETE, payload: stop })}
                  aria-label={BUTTONS.common.delete}
                  sx={{
                    minWidth: 40,
                    px: 1.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span className="material-symbols-outlined outlined">
                    delete
                  </span>
                </Button>
              </Box>
            </>
          )}
        />
      )}
    </Box>
  );
};

export default StopEdit;
