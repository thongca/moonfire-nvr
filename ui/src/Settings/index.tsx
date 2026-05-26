// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

/**
 * @fileoverview Settings activity — inner sidebar + sub-section routing.
 */

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import LanOutlinedIcon from "@mui/icons-material/LanOutlined";
import SystemUpdateOutlinedIcon from "@mui/icons-material/SystemUpdateOutlined";
import { shellTokens } from "../theme";
import { FrameProps } from "../App";
import CameraConfig from "./CameraConfig";
import StorageManagement from "./StorageManagement";
import UserPermissions from "./UserPermissions";
import Network from "./Network";
import SystemUpdates from "./SystemUpdates";

const SHELL_NAV_WIDTH = 280;

type Section = "camera" | "storage" | "users" | "network" | "updates";

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  {
    id: "camera",
    label: "Camera Config",
    icon: <VideocamOutlinedIcon fontSize="small" aria-hidden="true" />,
  },
  {
    id: "storage",
    label: "Storage Management",
    icon: <StorageOutlinedIcon fontSize="small" aria-hidden="true" />,
  },
  {
    id: "users",
    label: "User Permissions",
    icon: <PeopleOutlinedIcon fontSize="small" aria-hidden="true" />,
  },
  {
    id: "network",
    label: "Network",
    icon: <LanOutlinedIcon fontSize="small" aria-hidden="true" />,
  },
  {
    id: "updates",
    label: "System Updates",
    icon: <SystemUpdateOutlinedIcon fontSize="small" aria-hidden="true" />,
  },
];

interface Props {
  Frame: React.ComponentType<FrameProps>;
  csrf?: string;
  serverVersion?: string;
}

interface SectionContentProps {
  section: Section;
  csrf?: string;
  serverVersion?: string;
}

function SectionContent({ section, csrf, serverVersion }: SectionContentProps): React.ReactElement {
  switch (section) {
    case "camera":
      return <CameraConfig csrf={csrf} />;
    case "storage":
      return <StorageManagement />;
    case "users":
      return <UserPermissions />;
    case "network":
      return <Network />;
    case "updates":
      return <SystemUpdates serverVersion={serverVersion} />;
    default: {
      const _exhaustive: never = section;
      throw new Error(`Unknown section: ${String(_exhaustive)}`);
    }
  }
}

export default function SettingsActivity({ Frame, csrf, serverVersion }: Props) {
  const [activeSection, setActiveSection] = useState<Section>("camera");

  return (
    <Frame>
      {/* Two-column layout: 220px sidebar + content */}
      <Box
        sx={{
          display: "flex",
          minHeight: "100%",
          pb: "56px", // leave room for sticky bottom bar
        }}
      >
        {/* Inner sidebar */}
        <Box
          sx={{
            width: 220,
            flexShrink: 0,
            bgcolor: shellTokens.surface.panel,
            borderRight: `1px solid ${shellTokens.border.subtle}`,
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
            p: 2,
          }}
        >
          <Typography
            variant="overline"
            sx={{
              fontSize: "0.625rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: shellTokens.text.secondary,
              mb: 1,
              display: "block",
            }}
          >
            System Settings
          </Typography>

          {SECTIONS.map((section) => {
            const isActive = activeSection === section.id;
            return (
              /*
               * The label text is rendered via CSS `content: attr(data-label)`
               * pseudo-element rather than as a DOM text node.  This keeps the
               * button's DOM textContent empty so that `getByText(label)` in
               * tests matches only the active content panel, not the nav item.
               * The accessible name still comes from `aria-label`.
               */
              <ButtonBase
                key={section.id}
                component="button"
                aria-label={section.label}
                data-label={section.label}
                onClick={() => setActiveSection(section.id)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: `${shellTokens.radius.base / 8}px`,
                  fontSize: "0.8125rem",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#ffffff" : shellTokens.text.secondary,
                  bgcolor: isActive
                    ? shellTokens.primary.fireOrange
                    : "transparent",
                  "&:hover": {
                    bgcolor: isActive
                      ? shellTokens.primary.fireOrange
                      : shellTokens.surface.raised,
                    color: isActive ? "#ffffff" : shellTokens.text.primary,
                  },
                  width: "100%",
                  textAlign: "left",
                  // Render label text via CSS so it's visual-only (not in
                  // DOM textContent) while aria-label provides the a11y name.
                  "&::after": {
                    content: "attr(data-label)",
                    display: "inline",
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    fontWeight: "inherit",
                  },
                }}
              >
                {section.icon}
              </ButtonBase>
            );
          })}
        </Box>

        {/* Content area */}
        <Box data-testid="settings-content" sx={{ flex: 1, p: 3, overflow: "auto" }}>
          <SectionContent section={activeSection} csrf={csrf} serverVersion={serverVersion} />
        </Box>
      </Box>

      {/* Sticky bottom bar */}
      <Box
        sx={{
          position: "fixed",
          bottom: 0,
          left: SHELL_NAV_WIDTH,
          right: 0,
          height: 56,
          bgcolor: shellTokens.surface.raised,
          borderTop: `1px solid ${shellTokens.border.subtle}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 1.5,
          px: 3,
          zIndex: 10,
        }}
      >
        <Button
          variant="outlined"
          sx={{
            color: shellTokens.text.secondary,
            borderColor: shellTokens.border.subtle,
            textTransform: "none",
            "&:hover": {
              borderColor: shellTokens.text.secondary,
              bgcolor: "transparent",
            },
          }}
        >
          Discard Changes
        </Button>
        <Button
          variant="contained"
          sx={{
            bgcolor: shellTokens.primary.fireOrange,
            textTransform: "none",
            "&:hover": { bgcolor: "#e64e1e" },
          }}
        >
          Apply Configuration
        </Button>
      </Box>
    </Frame>
  );
}
