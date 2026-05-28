// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import AccountCircleOutlined from "@mui/icons-material/AccountCircleOutlined";
import CameraAltOutlined from "@mui/icons-material/CameraAltOutlined";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import HelpOutlineOutlined from "@mui/icons-material/HelpOutlineOutlined";
import LoginOutlined from "@mui/icons-material/LoginOutlined";
import PeopleOutlineOutlined from "@mui/icons-material/PeopleOutlineOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import SensorsOutlined from "@mui/icons-material/SensorsOutlined";
import HealthAndSafetyOutlined from "@mui/icons-material/HealthAndSafetyOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import Search from "@mui/icons-material/Search";
import VideoLibraryOutlined from "@mui/icons-material/VideoLibraryOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";
import { Link, useLocation } from "react-router";
import { LoginState } from "../App";
import { shellTokens } from "../theme";

interface AppShellProps {
  activityMenuPart?: React.JSX.Element;
  children?: React.ReactNode;
  onLogout: () => void;
  loginState: LoginState;
  onRequestLogin: () => void;
  onChangePassword: () => void;
}

const navItems = [
  { label: "Dashboard", to: "/", icon: <DashboardOutlined /> },
  { label: "Archive", to: "/archive", icon: <VideoLibraryOutlined /> },
  { label: "Cameras", to: "/cameras", icon: <CameraAltOutlined /> },
  { label: "System Health", to: "/system", icon: <HealthAndSafetyOutlined /> },
  { label: "Signal Controls", to: "/signals", icon: <SensorsOutlined /> },
  { label: "Users", to: "/users", icon: <PeopleOutlineOutlined /> },
  { label: "Settings", to: "/settings", icon: <SettingsOutlined /> },
];

export default function AppShell({
  activityMenuPart,
  children,
  onLogout,
  loginState,
  onRequestLogin,
  onChangePassword,
}: AppShellProps) {
  const location = useLocation();
  const loggedIn = loginState === "logged-in";
  const [accountMenuAnchor, setAccountMenuAnchor] =
    React.useState<null | HTMLElement>(null);

  const handleAccountMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAccountMenuAnchor(event.currentTarget);
  };

  const closeAccountMenu = () => {
    setAccountMenuAnchor(null);
  };

  const handleLogout = () => {
    closeAccountMenu();
    onLogout();
  };

  const handleChangePassword = () => {
    closeAccountMenu();
    onChangePassword();
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: shellTokens.background.base,
        color: shellTokens.text.primary,
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        sx={{ minHeight: "100vh" }}
      >
        <Paper
          square
          sx={{
            width: { xs: "100%", md: 280 },
            bgcolor: shellTokens.surface.panel,
            borderRight: { xs: 0, md: "1px solid" },
            borderBottom: { xs: "1px solid", md: 0 },
            borderColor: shellTokens.border.subtle,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1,
                  bgcolor: shellTokens.primary.fireOrange,
                }}
              />
              <Box>
                <Typography
                  sx={{
                    color: shellTokens.text.primary,
                    fontSize: 14,
                    fontWeight: 700,
                    lineHeight: "18px",
                  }}
                >
                  Moonfire NVR
                </Typography>
                <Typography
                  sx={{ fontSize: 11, lineHeight: "14px" }}
                  color="text.secondary"
                >
                  Active
                </Typography>
              </Box>
            </Stack>
          </Box>

          <List
            sx={{
              display: { xs: "flex", md: "block" },
              gap: { xs: 0.5, md: 0 },
              overflowX: { xs: "auto", md: "visible" },
              px: 1.5,
              py: 0.5,
            }}
          >
            {navItems.map((item) => {
              const active =
                item.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.to);
              return (
                <ListItemButton
                  key={item.label}
                  component={Link}
                  to={item.to}
                  selected={active}
                  aria-current={active ? "page" : undefined}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    minHeight: 40,
                    py: 0.75,
                    flexShrink: { xs: 0, md: 1 },
                    color: active ? "#ffffff" : shellTokens.text.primary,
                    bgcolor: active
                      ? shellTokens.primary.fireOrange
                      : "transparent",
                    borderLeft: active
                      ? `4px solid ${shellTokens.text.primary}`
                      : "4px solid transparent",
                    "&.Mui-selected": {
                      bgcolor: shellTokens.primary.fireOrange,
                      color: "#ffffff",
                    },
                    "&.Mui-selected:hover": {
                      bgcolor: shellTokens.primary.fireOrange,
                    },
                    "&:hover": {
                      bgcolor: active
                        ? shellTokens.primary.fireOrange
                        : shellTokens.surface.raised,
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: "inherit",
                      minWidth: 34,
                      "& .MuiSvgIcon-root": { fontSize: 20 },
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: 13,
                      fontWeight: active ? 700 : 500,
                      lineHeight: "18px",
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>

          <Box
            sx={{
              display: { xs: "none", md: "block" },
              mt: "auto",
              p: 2.5,
              borderTop: `1px solid ${shellTokens.border.subtle}`,
            }}
          >
            <Button
              fullWidth
              variant="contained"
              sx={{
                mb: 2,
                bgcolor: shellTokens.primary.fireOrange,
                fontSize: 12,
              }}
            >
              Export Clip
            </Button>
            <Stack spacing={1}>
              <Button
                startIcon={<HelpOutlineOutlined />}
                sx={{
                  justifyContent: "flex-start",
                  color: shellTokens.text.primary,
                  fontSize: 12,
                }}
              >
                Support
              </Button>
              <Button
                startIcon={loggedIn ? <LogoutOutlined /> : <LoginOutlined />}
                onClick={loggedIn ? onLogout : onRequestLogin}
                sx={{
                  justifyContent: "flex-start",
                  color: shellTokens.text.primary,
                  fontSize: 12,
                }}
              >
                {loggedIn ? "Log Out" : "Log In"}
              </Button>
            </Stack>
          </Box>
        </Paper>

        <Box
          sx={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <Paper
            square
            sx={{
              minHeight: { xs: 56, md: 80 },
              px: { xs: 1.5, md: 3 },
              py: { xs: 1, md: 0 },
              display: "flex",
              alignItems: "center",
              gap: { xs: 1, md: 2 },
              bgcolor: shellTokens.surface.raised,
              borderBottom: "1px solid",
              borderColor: shellTokens.border.subtle,
            }}
          >
            <Paper
              sx={{
                px: 1.5,
                py: 0.75,
                display: "flex",
                alignItems: "center",
                flex: { xs: "1 1 auto", md: "0 0 320px" },
                minWidth: 0,
                maxWidth: { xs: "100%", md: 320 },
                bgcolor: shellTokens.surface.panel,
                border: `1px solid ${shellTokens.border.subtle}`,
              }}
            >
              <Search fontSize="small" />
              <InputBase
                placeholder="Search cameras..."
                inputProps={{ "aria-label": "Search cameras" }}
                sx={{ ml: 1, flexGrow: 1 }}
              />
            </Paper>
            <Box
              sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}
            >
              {activityMenuPart}
              {loggedIn ? (
                <>
                  <Tooltip title="Account">
                    <IconButton
                      size="small"
                      onClick={handleAccountMenu}
                      aria-label="Account"
                    >
                      <AccountCircleOutlined />
                    </IconButton>
                  </Tooltip>
                  <Menu
                    anchorEl={accountMenuAnchor}
                    open={Boolean(accountMenuAnchor)}
                    onClose={closeAccountMenu}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                  >
                    <MenuItem onClick={handleChangePassword}>
                      Change password
                    </MenuItem>
                    <MenuItem onClick={handleLogout}>Logout</MenuItem>
                  </Menu>
                </>
              ) : (
                <Tooltip title="Log in">
                  <IconButton
                    size="small"
                    onClick={onRequestLogin}
                    aria-label="Log in"
                  >
                    <LoginOutlined />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Paper>
          <Box sx={{ p: { xs: 2, md: 4 }, flexGrow: 1, minWidth: 0 }}>
            {children}
          </Box>
        </Box>
      </Stack>
    </Box>
  );
}
