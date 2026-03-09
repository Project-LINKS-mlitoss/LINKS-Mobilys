// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { Box, Typography, Button } from "@mui/material";
import uploadProgress from "../assets/photos/upload-progress.png";
import uploadError from "../assets/photos/upload-failed.png";
import { FILE_STATUS } from "../constant/file.js";
import { UI } from "../constant/ui.js";
import { trimText } from "../utils/text.js";
import { BUTTONS, LABELS, MESSAGES } from "../strings/index.js";

export default function FileUploadStatus({
  filename,
  status,
  errorMessage,
  onRetry,
}) {
  return (
    <Box
      sx={{
        width: UI.fileUploadStatus.widthPx,
        textAlign: "center",
        p: UI.fileUploadStatus.padding,
        borderRadius: UI.fileUploadStatus.borderRadius,
        background: UI.fileUploadStatus.backgroundColor,
      }}>
      <img
        src={
          status === FILE_STATUS.UPLOADING
            ? uploadProgress
            : status === FILE_STATUS.ERROR
              ? uploadError
              : uploadProgress
        }
        alt="upload-status"
        style={{
          width: UI.fileUploadStatus.imageWidthPx,
          opacity: UI.fileUploadStatus.imageOpacity,
        }}
      />

      <Typography sx={{ fontSize: 16, fontWeight: 500, mt: 2 }}>
        {trimText(
          filename || LABELS.uploader.selectFilePrompt,
          UI.fileUploadStatus.filenameTrimLength
        )}
      </Typography>
      {status === FILE_STATUS.UPLOADING && (
        <Typography sx={{ fontSize: 13, color: UI.fileUploadStatus.importingColor, my: 1 }}>
          {MESSAGES.fileUpload.importing}
        </Typography>
      )}

      {status === FILE_STATUS.SUCCESS && (
        <Typography sx={{ fontSize: 14, color: UI.fileUploadStatus.successColor, my: 2 }}>
          {MESSAGES.fileUpload.importComplete}
        </Typography>
      )}

      {status === FILE_STATUS.ERROR && (
        <>
          <Typography sx={{ fontSize: 14, color: UI.fileUploadStatus.errorColor, my: 2 }}>
            {errorMessage}
          </Typography>
          <Button onClick={onRetry} variant="outlined" size="small">
            {BUTTONS.common.retryImport}
          </Button>
        </>
      )}
    </Box>
  );
}
