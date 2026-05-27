// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import AccessTimeIcon from "@mui/icons-material/AccessTime";
import GridViewIcon from "@mui/icons-material/GridView";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Camera } from "../types";

interface Props {
  cameras: Camera[];
  selectedCamera: Camera | null;
  onSelectCamera: (camera: Camera) => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  currentTime90k: number | null;
  timeZoneName: string;
}

const TopBar = ({
  cameras,
  selectedCamera,
  onSelectCamera,
  selectedDate,
  onSelectDate,
  currentTime90k,
  timeZoneName,
}: Props) => {
  const timeDisplay =
    currentTime90k != null
      ? format(
          toZonedTime(new Date(currentTime90k / 90), timeZoneName),
          "HH:mm"
        )
      : "--:--";

  return (
    <Box
      sx={{
        height: 64,
        bgcolor: "#1c1b1b",
        px: 2,
        borderBottom: "1px solid",
        borderColor: "divider",
        display: "flex",
        alignItems: "center",
        gap: 2,
      }}
    >
      {/* Title */}
      <Typography variant="h6" fontWeight="bold" noWrap>
        Xem lại bản ghi
      </Typography>

      {/* Date picker */}
      <DatePicker
        format="dd-MM-yyyy"
        value={selectedDate}
        onChange={(d) => d && onSelectDate(d)}
        slotProps={{
          textField: {
            size: "small",
            sx: { width: 160 },
          },
        }}
      />

      {/* Time display */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <AccessTimeIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        <Typography
          variant="body2"
          sx={{ fontFamily: "JetBrains Mono, monospace", color: "text.secondary" }}
        >
          {timeDisplay}
        </Typography>
      </Box>

      {/* Camera chips */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          alignItems: "center",
        }}
      >
        {cameras.map((cam, idx) => {
          const isActive = cam === selectedCamera;
          return (
            <Chip
              key={cam.uuid}
              label={`CAM ${String(idx + 1).padStart(2, "0")}`}
              size="small"
              onClick={() => onSelectCamera(cam)}
              sx={{
                bgcolor: isActive ? "#ff5722" : "transparent",
                color: isActive ? "#fff" : "text.secondary",
                border: isActive ? "none" : "1px solid #4b423b",
                "&:hover": {
                  bgcolor: isActive ? "#e64a19" : "rgba(255,87,34,0.08)",
                },
              }}
            />
          );
        })}
      </Box>

      {/* Grid icon button — placeholder */}
      <IconButton size="small">
        <GridViewIcon />
      </IconButton>
    </Box>
  );
};

export default TopBar;
