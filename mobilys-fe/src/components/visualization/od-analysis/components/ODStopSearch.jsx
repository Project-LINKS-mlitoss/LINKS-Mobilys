import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";

export default function ODStopSearch({
  options,
  value,
  loading,
  onChange,
  inputValue,
  onInputChange,
  label,
  popperZIndex,
  sx,
}) {
  return (
    <Autocomplete
      options={options}
      value={value}
      loading={loading}
      onChange={onChange}
      inputValue={inputValue}
      onInputChange={onInputChange}
      isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
      getOptionLabel={(opt) => opt?.label ?? ""}
      clearOnEscape
      disablePortal
      slotProps={{ popper: { sx: { zIndex: popperZIndex } } }}
      sx={sx}
      renderInput={(params) => (
        <TextField {...params} size="small" label={label} />
      )}
      data-html2canvas-ignore
    />
  );
}

